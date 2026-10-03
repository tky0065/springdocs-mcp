import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, fixture, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const LISTING_HTML = fixture("listing.html");
const RELEASES_JSON = fixture("releases.json");
const GUIDES_JSON = fixture("guides-page-data.json");

/** URL substrings that answer 503; everything else answers with the fixtures. */
let down: string[] = [];
const ALL = ["spring.io", "github.com"];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  down = [];
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async (url: string) => {
    if (down.some((fragment) => String(url).includes(fragment))) return fakeResponse(503);
    const target = String(url);
    if (target.includes("page-data/guides")) return fakeResponse(200, GUIDES_JSON);
    return fakeResponse(200, target.includes("api.github.com") ? RELEASES_JSON : LISTING_HTML);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const rejected = async (promise: Promise<unknown>) => {
  const outcome = await settle(promise);
  expect(outcome.ok, "expected the call to reject").toBe(false);
};
const value = async <T>(promise: Promise<T>): Promise<T> => {
  const outcome = await settle(promise);
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
};

describe("SpringBootDocsServiceOptimized", () => {
  it("rejects when every source is down and does not cache the failure", async () => {
    const service = new SpringBootDocsServiceOptimized();
    down = ALL;
    await rejected(service.searchSpringDocs("boot", "all", 10));

    down = [];
    const results = await value(service.searchSpringDocs("boot", "all", 10));
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns partial results without caching them when one source is down", async () => {
    const service = new SpringBootDocsServiceOptimized();
    down = ["spring.io/projects"];
    const partial = await value(service.searchSpringDocs("boot", "all", 10));
    expect(partial.length).toBeGreaterThan(0);

    down = [];
    mockedFetch.mockClear();
    const complete = await value(service.searchSpringDocs("boot", "all", 10));
    expect(mockedFetch).toHaveBeenCalled();
    expect(complete.length).toBeGreaterThan(partial.length);
  });

  it("caches a fully successful search", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await value(service.searchSpringDocs("boot", "all", 10));

    mockedFetch.mockClear();
    await value(service.searchSpringDocs("boot", "all", 10));
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["getAllSpringGuides", (s: SpringBootDocsServiceOptimized) => s.getAllSpringGuides(undefined, 5)],
    ["searchSpringProjects", (s: SpringBootDocsServiceOptimized) => s.searchSpringProjects("boot", 5)],
    ["searchSpringConcepts", (s: SpringBootDocsServiceOptimized) => s.searchSpringConcepts("boot")],
  ])("%s rejects when the network is down", async (_name, run) => {
    down = ALL;
    await rejected(run(new SpringBootDocsServiceOptimized()));
  });
});

describe("AdvancedFeaturesService", () => {
  it("rejects when the only selected source is down and does not cache the failure", async () => {
    const service = new AdvancedFeaturesService();
    down = ALL;
    await rejected(service.searchEcosystem("boot", "guides", 5));

    down = [];
    const result = await value(service.searchEcosystem("boot", "guides", 5));
    expect(result).not.toContain("No results found");
  });

  it("warns about unavailable sources and does not cache a partial result", async () => {
    const service = new AdvancedFeaturesService();
    down = ["spring.io/projects"];
    const partial = await value(service.searchEcosystem("boot", "all", 5));
    expect(partial).toContain("Some sources were unavailable: projects");

    down = [];
    mockedFetch.mockClear();
    const complete = await value(service.searchEcosystem("boot", "all", 5));
    expect(mockedFetch).toHaveBeenCalled();
    expect(complete).not.toContain("unavailable");
  });

  it("caches a fully successful ecosystem search", async () => {
    const service = new AdvancedFeaturesService();
    await value(service.searchEcosystem("boot", "all", 5));

    mockedFetch.mockClear();
    await value(service.searchEcosystem("boot", "all", 5));
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["getTutorial", (s: AdvancedFeaturesService) => s.getTutorial("boot")],
    ["compareVersions", (s: AdvancedFeaturesService) => s.compareVersions("3.4", "3.5")],
    ["getBestPractices", (s: AdvancedFeaturesService) => s.getBestPractices("testing")],
    // diagnoseIssues is local now: covered by tests/diagnose-offline.test.ts
  ])("%s rejects when the network is down", async (_name, run) => {
    down = ALL;
    await rejected(run(new AdvancedFeaturesService()));
  });
});
