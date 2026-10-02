import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { SpringProjectsConfig, springProjectsConfig } from "../src/services/spring-projects-config.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const API = "https://api.github.com/repos";

const BODY = [
  "## :star: New Features",
  "",
  "* Add support for virtual threads in the web server #12345",
  "* Improve startup time #12346",
  "",
  "## :lady_beetle: Bug Fixes",
  "",
  "* Fix NPE in actuator endpoint #12347",
  "* Remove deprecated `server.foo` property #12348",
  "* Deprecate `spring.bar.enabled` in favor of `spring.bar.mode` #12349",
  "* Binding is no longer case sensitive #12350",
  "",
  "## :hammer: Dependency Upgrades",
  "",
  "* Upgrade to Jackson 2.19 #12351",
].join("\n");

const HTML_URL = "https://github.com/spring-projects/spring-boot/releases/tag/v3.5.0";
const release = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    tag_name: "v3.5.0",
    name: "v3.5.0",
    published_at: "2025-05-22T10:00:00Z",
    html_url: HTML_URL,
    prerelease: false,
    body: BODY,
    ...overrides,
  });

const respondWith = (status: number, body = "") => {
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(status, body));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  respondWith(200, release());
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
const failure = async (promise: Promise<unknown>): Promise<string> => {
  const outcome = await settle(promise);
  expect(outcome.ok, "expected the call to reject").toBe(false);
  return outcome.ok ? "" : (outcome.error as Error).message;
};

describe("AdvancedFeaturesService.getReleaseNotes (#33)", () => {
  it("appelle l'URL exacte du tag et formate la sortie", async () => {
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5.0"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(String(mockedFetch.mock.calls[0][0])).toBe(`${API}/spring-projects/spring-boot/releases/tags/v3.5.0`);
    expect(out).toContain("# Spring Boot v3.5.0");
    expect(out).toContain("**Released:** 2025-05-22");
    expect(out).toContain(HTML_URL);
    expect(out).toContain("**Focus:** all");
    expect(out).toContain("virtual threads");
    expect(out).not.toContain("Pre-release");
  });

  it("ignore le v initial et n'ajoute pas de préfixe pour security", async () => {
    await run(new AdvancedFeaturesService().getReleaseNotes("security", "v6.5.0"));
    expect(String(mockedFetch.mock.calls[0][0])).toBe(`${API}/spring-projects/spring-security/releases/tags/6.5.0`);
  });

  it("utilise releases/latest sans version", async () => {
    await run(new AdvancedFeaturesService().getReleaseNotes("boot"));
    expect(String(mockedFetch.mock.calls[0][0])).toBe(`${API}/spring-projects/spring-boot/releases/latest`);
  });

  it("applique le filtre focus", async () => {
    const service = new AdvancedFeaturesService();
    const breaking = await run(service.getReleaseNotes("boot", "3.5.0", "breaking-changes"));
    expect(breaking).toContain("no longer case sensitive");
    expect(breaking).not.toContain("virtual threads");
    const features = await run(service.getReleaseNotes("boot", "3.5.0", "new-features"));
    expect(features).toContain("virtual threads");
  });

  it("met la release brute en cache : un seul fetch pour deux focus", async () => {
    const service = new AdvancedFeaturesService();
    await run(service.getReleaseNotes("boot", "3.5.0", "all"));
    await run(service.getReleaseNotes("boot", "3.5.0", "deprecations"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [404, /Release not found: Spring Boot 9\.9\.9/],
    [403, /rate limit/],
    [429, /rate limit/],
    [500, /Failed to fetch release data/],
  ])("rejette le statut %i sans mettre l'échec en cache", async (status, message) => {
    const service = new AdvancedFeaturesService();
    respondWith(status);
    expect(await failure(service.getReleaseNotes("boot", "9.9.9"))).toMatch(message);

    mockedFetch.mockClear();
    respondWith(200, release());
    await run(service.getReleaseNotes("boot", "9.9.9"));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("gère un corps null et un filtre sans correspondance", async () => {
    respondWith(200, release({ body: null }));
    const service = new AdvancedFeaturesService();
    const all = await run(service.getReleaseNotes("boot", "3.5.0"));
    expect(all).toContain("# Spring Boot v3.5.0");
    const none = await run(service.getReleaseNotes("boot", "3.5.0", "breaking-changes"));
    expect(none).toContain("No breaking-changes entries found");
    expect(none).toContain(HTML_URL);
  });

  it("signale une pré-release", async () => {
    respondWith(200, release({ prerelease: true }));
    const out = await run(new AdvancedFeaturesService().getReleaseNotes("boot", "3.5.0"));
    expect(out).toContain("**Pre-release:** yes");
  });

  it("rejette les versions invalides avant tout appel réseau et les projets inconnus", async () => {
    const service = new AdvancedFeaturesService();
    for (const bad of ["../x", "3.5", "3.5.0/../x", "v", "3.5.0 "]) {
      expect(await failure(service.getReleaseNotes("boot", bad)), bad).toMatch(/Invalid version/);
    }
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(await failure(service.getReleaseNotes("nope"))).toMatch(/Unknown Spring project/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejette un projet sans githubRepo", async () => {
    const { githubRepo, githubTagPrefix, ...bare } = springProjectsConfig.getProject("boot");
    const config = new SpringProjectsConfig(new Map([["boot", bare]]));
    const service = new AdvancedFeaturesService(undefined, config);
    expect(await failure(service.getReleaseNotes("boot", "3.5.0"))).toMatch(/Release notes are not available/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("validation de get_release_notes (#33)", () => {
  it("accepte {} et refuse un project hors enum", () => {
    expect(() => validateToolArguments("get_release_notes", {})).not.toThrow();
    expect(() => validateToolArguments("get_release_notes", { project: "nope" })).toThrow();
    expect(validateToolArguments("get_release_notes", { project: "kafka", version: "4.1.1" }))
      .toMatchObject({ project: "kafka", version: "4.1.1" });
  });
});
