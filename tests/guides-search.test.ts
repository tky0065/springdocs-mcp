import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const PAGE_DATA = fixture("guides-page-data.json");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async (url: unknown) =>
    String(url) === "https://spring.io/page-data/guides/page-data.json"
      ? fakeResponse(200, PAGE_DATA)
      : fakeResponse(200, "<html><body>client-side rendered, no links</body></html>"));
});
afterEach(() => vi.restoreAllMocks());

describe("search_spring_ecosystem : guides via page-data.json", () => {
  it("scope guides renvoie les guides de la liste page-data", async () => {
    const out = await new AdvancedFeaturesService().searchEcosystem("rest", "guides", 5);
    expect(out).toContain("Building a RESTful Web Service");
    expect(out).toContain("https://spring.io/guides/gs/rest-service/");
    expect(mockedFetch.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://spring.io/page-data/guides/page-data.json",
    ]);
  });

  it("filtre sur le titre ou la description, et applique limit", async () => {
    const service = new AdvancedFeaturesService() as any;
    expect((await service.searchGuides("schedule", 5)).map((g: any) => g.title)).toEqual(["Scheduling Tasks"]);
    expect(await service.searchGuides("learn how", 1)).toHaveLength(1);
  });

  it("un JSON de forme inattendue fait échouer la source", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, '{"result":{}}'));
    await expect(new AdvancedFeaturesService().searchEcosystem("rest", "guides", 5)).rejects.toThrow();
  });
});
