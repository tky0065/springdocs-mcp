import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

const PAGE = `
<div class="card"><h2>Widget no link</h2><p>widget without href</p></div>
<div class="card"><h2>Widget linked</h2><p>widget with href</p><a href="/projects/widget">go</a></div>`;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, PAGE));
});
afterEach(() => vi.restoreAllMocks());

const expectOnlyLinked = (items: Array<{ url: string }>) => {
  expect(items.map((i) => i.url)).toEqual(["https://spring.io/projects/widget"]);
};

describe("entrées sans lien (#15)", () => {
  it("SpringBootDocsServiceOptimized.searchSpringProjects", async () => {
    expectOnlyLinked(await new SpringBootDocsServiceOptimized().searchSpringProjects("widget", 10));
  });
  it("SpringBootDocsServiceOptimized.getAllSpringGuides", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, JSON.stringify({ result: { data: { guides: { nodes: [
      { title: "Widget no link", description: "widget without path", category: [] },
      { title: "Widget linked", description: "widget with path", path: "/guides/widget", category: [] },
    ] } } } })));
    const guides = await new SpringBootDocsServiceOptimized().getAllSpringGuides(undefined, 10);
    expect(guides.map((g) => g.url)).toEqual(["https://spring.io/guides/widget"]);
  });
  it("AdvancedFeaturesService.searchProjects", async () => {
    expectOnlyLinked(await (new AdvancedFeaturesService() as any).searchProjects("widget", 10));
  });
  it("AdvancedFeaturesService.searchGuides", async () => {
    expectOnlyLinked(await (new AdvancedFeaturesService() as any).searchGuides("widget", 10));
  });
});
