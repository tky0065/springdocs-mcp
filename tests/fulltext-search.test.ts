import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { SearchIndex } from "../src/services/search-index.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

const PROJECT_HTML = `<html><body><main><h1>Spring Batch</h1>
<p>Chunk-oriented processing with a configurable retry policy and skip limit.</p></main></body></html>`;

function make(index = new SearchIndex()) {
  const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), index);
  return { service, index };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, PROJECT_HTML));
});
afterEach(() => vi.restoreAllMocks());

describe("recherche plein texte (#52)", () => {
  it("à froid, docType=content renvoie une note d'index vide sans appel réseau", async () => {
    const { service } = make();
    const results = await service.searchSpringDocs("retry policy", "content", 10);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("note");
    expect(results[0].description).toMatch(/read a page first/i);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("trouve par son contenu une page lue juste avant", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    const results = await service.searchSpringDocs("retry policy", "content", 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: "content", url: "https://spring.io/projects/spring-batch" });
    expect(results[0].description).toMatch(/retry policy/i);
  });

  it("une requête de stopwords renvoie une liste vide, sans note si l'index est alimenté", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    expect(await service.searchSpringDocs("the of", "content", 10)).toEqual([]);
  });

  it("all fusionne titres et contenu sans doublon d'URL", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    vi.spyOn(service as any, "searchSpringProjects").mockResolvedValue([
      { type: "project", title: "Batch", url: "https://spring.io/projects/spring-batch", description: "d" },
    ]);
    vi.spyOn(service as any, "getAllSpringGuides").mockResolvedValue([]);
    vi.spyOn(service as any, "searchInReference").mockResolvedValue([]);
    const results = await service.searchSpringDocs("retry", "all", 10);
    expect(results.filter(r => r.url === "https://spring.io/projects/spring-batch")).toHaveLength(1);
    expect(results[0].type).toBe("project");
  });

  it("ne met pas en cache les résultats content", async () => {
    const { service } = make();
    expect(await service.searchSpringDocs("retry", "content", 10)).toHaveLength(1); // note d'index vide
    mockedFetch.mockClear();
    await service.getSpringProject("spring-batch");
    const results = await service.searchSpringDocs("retry", "content", 10);
    expect(results[0].type).toBe("content");
  });

  it("une exception de l'index ne casse pas la lecture d'une page", async () => {
    const index = new SearchIndex();
    vi.spyOn(index, "add").mockImplementation(() => { throw new Error("boom"); });
    const { service } = make(index);
    await expect(service.getSpringProject("spring-batch")).resolves.toContain("Spring Batch");
  });

  it("limit : le contenu ne prend que les places laissées libres ou la moitié", async () => {
    const { service } = make();
    await service.getSpringProject("spring-batch");
    vi.spyOn(service as any, "searchSpringProjects").mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({ type: "project", title: `p${i}`, url: `https://x/${i}`, description: "" })));
    vi.spyOn(service as any, "getAllSpringGuides").mockResolvedValue([]);
    vi.spyOn(service as any, "searchInReference").mockResolvedValue([]);
    const results = await service.searchSpringDocs("retry", "all", 4);
    expect(results.map(r => r.type)).toEqual(["project", "project", "project", "content"]);
  });
});
