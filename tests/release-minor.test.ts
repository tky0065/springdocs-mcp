import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { normalizeReleaseVersion } from "../src/services/release-notes.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const rel = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: tag,
  published_at: "2025-05-22T10:00:00Z",
  html_url: `https://github.com/spring-projects/spring-boot/releases/tag/${tag}`,
  prerelease: false,
  body: `notes ${tag}`,
  ...extra,
});
const serve = (pages: unknown[][]) => {
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async (url: unknown) => {
    const page = Number(new URL(String(url)).searchParams.get("page") ?? "1");
    return fakeResponse(200, JSON.stringify(pages[page - 1] ?? []));
  });
};
const run = async <T>(p: Promise<T>) => {
  const o = await settle(p);
  if (!o.ok) throw o.error;
  return o.value;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("normalizeReleaseVersion", () => {
  it("accepte X.Y et vX.Y", () => {
    expect(normalizeReleaseVersion("3.5")).toBe("3.5");
    expect(normalizeReleaseVersion("v3.5")).toBe("3.5");
  });
  it("traite null comme absent", () => {
    expect(normalizeReleaseVersion(null as any)).toBeUndefined();
  });
  it.each([42, 3.5, {}, [], true])("rejette proprement la valeur non-string %j", (value) => {
    expect(() => normalizeReleaseVersion(value as any)).toThrow(/Invalid version/);
  });
});

describe("get_release_notes avec une version X.Y", () => {
  it("résout la dernière release stable de la mineure", async () => {
    serve([[
      rel("v3.6.0-M1", { prerelease: true }),
      rel("v3.5.2"),
      rel("v3.5.10"),
      rel("v3.5.1"),
      rel("v3.5.0-RC1", { prerelease: true }),
      rel("v3.4.9"),
    ]]);
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5"));
    expect(out).toContain("v3.5.10");
    expect(out).toContain("notes v3.5.10");
    expect(String(mockedFetch.mock.calls[0][0])).toBe("https://api.github.com/repos/spring-projects/spring-boot/releases?per_page=100&page=1");
  });

  it("pagine jusqu'à trouver la mineure", async () => {
    serve([[rel("v3.6.0")], [rel("v3.5.4")]]);
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5"));
    expect(out).toContain("v3.5.4");
  });

  it("ne confond pas 3.1 avec 3.10", async () => {
    serve([[rel("v3.10.2"), rel("v3.1.7")]]);
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("boot", "3.1"));
    expect(out).toContain("v3.1.7");
    expect(out).not.toContain("3.10.2");
  });

  it("message explicite si la mineure est introuvable", async () => {
    serve([[rel("v3.6.0")]]);
    await expect(run(new AdvancedFeaturesService().getReleaseNotes("boot", "9.9"))).rejects.toThrow(/No release found.*9\.9/);
  });

  it("gère un préfixe de tag vide (Spring AI) et applique focus", async () => {
    serve([[rel("1.0.3", { body: "## New Features\n* shiny" }), rel("1.0.2")]]);
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("ai", "1.0", "new-features"));
    expect(out).toContain("shiny");
  });
});
