import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const BASE = "https://api.github.com/repos/spring-projects/spring-boot/releases";

const rel = (tag: string, body: string | null = `notes for ${tag}`) => ({
  tag_name: tag,
  published_at: "2025-05-22T10:00:00Z",
  html_url: `https://github.com/spring-projects/spring-boot/releases/tag/${tag}`,
  body,
});

/** Serves `pages` (1-based) for releases?per_page=100&page=N; any other page is empty. */
const servePages = (pages: unknown[][]) => {
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async (url: unknown) => {
    const page = Number(new URL(String(url)).searchParams.get("page") ?? "1");
    return fakeResponse(200, JSON.stringify(pages[page - 1] ?? []));
  });
};
const pagesRequested = () =>
  mockedFetch.mock.calls.map((c) => Number(new URL(String(c[0])).searchParams.get("page")));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const run = async <T>(promise: Promise<T>): Promise<T> => {
  const outcome = await settle(promise);
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
};

describe("AdvancedFeaturesService.compareVersions (#37)", () => {
  it("correspondance exacte : 3.5.0 ne matche pas 3.5.0-RC1", async () => {
    servePages([[rel("v3.5.0-RC1", "RC body"), rel("v3.5.0", "GA body"), rel("v3.4.0", "old body")]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(out).toContain("GA body");
    expect(out).not.toContain("RC body");
    expect(out).toContain("releases/tag/v3.5.0");
  });

  it("accepte un tag sans préfixe v", async () => {
    servePages([[rel("3.5.0", "bare body"), rel("v3.4.0")]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(out).toContain("bare body");
  });

  it("pagine (per_page=100) jusqu'à trouver les deux tags", async () => {
    servePages([[rel("v3.5.0", "page1 body")], [rel("v3.4.0", "page2 body")]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(out).toContain("page1 body");
    expect(out).toContain("page2 body");
    expect(pagesRequested()).toEqual([1, 2]);
    expect(String(mockedFetch.mock.calls[0][0])).toBe(`${BASE}?per_page=100&page=1`);
  });

  it("s'arrête sur une page vide et signale le format X.Y.Z", async () => {
    servePages([[rel("v3.5.0")]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4", "3.5.0"));
    expect(out).toContain("Unable to find release information");
    expect(out).toContain("X.Y.Z");
    expect(pagesRequested()).toEqual([1, 2]);
  });

  it("limite à 5 pages", async () => {
    const full = (n: number) => [rel(`v1.0.${n}`)];
    servePages([full(1), full(2), full(3), full(4), full(5), full(6), full(7)]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(out).toContain("Unable to find release information");
    expect(pagesRequested()).toEqual([1, 2, 3, 4, 5]);
  });

  it("gère un body nul", async () => {
    servePages([[rel("v3.5.0", null), rel("v3.4.0", null)]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0"));
    expect(out).toContain("# Spring Boot Version Comparison: 3.4.0 vs 3.5.0");
  });

  it("clés de cache distinctes pour des versions contenant ':'", async () => {
    const service = new AdvancedFeaturesService();
    servePages([[rel("a:b", "ab body"), rel("c", "c body"), rel("a", "a body"), rel("b:c", "bc body")]]);
    const first = await run(service.compareVersions("a:b", "c"));
    const second = await run(service.compareVersions("a", "b:c"));
    expect(first).toContain("ab body");
    expect(second).toContain("a body");
    expect(second).toContain("bc body");
    expect(second).not.toBe(first);
  });

  it("propage les erreurs HTTP sans les mettre en cache", async () => {
    const service = new AdvancedFeaturesService();
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async () => fakeResponse(404, ""));
    const outcome = await settle(service.compareVersions("3.4.0", "3.5.0"));
    expect(outcome.ok).toBe(false);
    servePages([[rel("v3.5.0", "ok body"), rel("v3.4.0")]]);
    expect(await run(service.compareVersions("3.4.0", "3.5.0"))).toContain("ok body");
  });
});

describe("AdvancedFeaturesService.compareVersions : focus", () => {
  const BODY = ["## New Features", "* Add virtual threads #1", "## Bug Fixes", "* Remove deprecated `foo` #2", "* Binding is no longer lenient #3"].join("\n");

  it("new-features : applique le filtre de release-notes aux deux versions", async () => {
    servePages([[rel("v3.5.0", BODY), rel("v3.4.0", BODY)]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0", "new-features"));
    expect(out).toContain("virtual threads");
    expect(out).not.toContain("no longer lenient");
    expect(out).toContain("**Focus:** new-features");
  });

  it("breaking-changes : ne garde que les lignes correspondantes", async () => {
    servePages([[rel("v3.5.0", BODY), rel("v3.4.0", BODY)]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0", "breaking-changes"));
    expect(out).toContain("no longer lenient");
    expect(out).not.toContain("virtual threads");
  });

  it("indique l'absence d'entrées pour le focus demandé", async () => {
    servePages([[rel("v3.5.0", "* nothing relevant"), rel("v3.4.0", "* nothing relevant")]]);
    const out = await run(new AdvancedFeaturesService().compareVersions("3.4.0", "3.5.0", "deprecations"));
    expect(out).toContain("No deprecations entries found");
  });

  it("des focus différents ont des entrées de cache distinctes", async () => {
    const service = new AdvancedFeaturesService();
    servePages([[rel("v3.5.0", BODY), rel("v3.4.0", BODY)]]);
    const a = await run(service.compareVersions("3.4.0", "3.5.0", "new-features"));
    const b = await run(service.compareVersions("3.4.0", "3.5.0", "breaking-changes"));
    expect(a).not.toBe(b);
  });
});
