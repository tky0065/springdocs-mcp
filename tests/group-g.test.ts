import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { SearchIndex } from "../src/services/search-index.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { ToolDefinitions } from "../src/tools/index.js";
import { formatSearchResults } from "../src/format.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const GUIDE_PAGE = fixture("guide-page.html");
const WIKI = fixture("boot-wiki-migration-guide.html");

const longGuide = (marker: string) =>
  `<html><body><div class="ascii-doc"><h1>Titre</h1><p>${"Texte de remplissage du guide. ".repeat(500)}</p><h2>Fin</h2><p>${marker}</p></div></body></html>`;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("SearchIndex.has", () => {
  it("indique si un document est indexé", () => {
    const index = new SearchIndex();
    expect(index.has("a")).toBe(false);
    index.add("a", { title: "A", url: "u", text: "texte" });
    expect(index.has("a")).toBe(true);
  });
});

describe("index plein texte : guides (G1)", () => {
  it("une lecture summary n'écrase pas le texte complet indexé", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, longGuide("zebrapassage")));
    const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), new SearchIndex());
    await service.getGuide("big", "full");
    await service.getGuide("big", "summary");
    const hits = await service.searchSpringDocs("zebrapassage", "content", 5);
    expect(hits[0]).toMatchObject({ type: "content" });
    expect(hits[0].description).toContain("zebrapassage");
  });

  it("l'indexation d'une lecture summary seule contient le texte complet", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, longGuide("zebrapassage")));
    const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), new SearchIndex());
    await service.getGuide("big", "summary");
    const hits = await service.searchSpringDocs("zebrapassage", "content", 5);
    expect(hits[0]).toMatchObject({ type: "content" });
  });
});

describe("index plein texte : réindexation sur cache hit (G2)", () => {
  const projectHtml = `<main><h1>Batch</h1><p>${"retry policy ".repeat(20)}</p></main>`;

  it("projet : réindexe depuis le cache quand l'index a perdu la page", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, projectHtml));
    const cache = new CacheService();
    await new SpringBootDocsServiceOptimized(undefined, cache, new SearchIndex()).getSpringProject("spring-batch");
    const fresh = new SearchIndex();
    mockedFetch.mockClear();
    await new SpringBootDocsServiceOptimized(undefined, cache, fresh).getSpringProject("spring-batch");
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(fresh.has("project:spring-batch")).toBe(true);
  });

  it("référence : réindexe depuis le cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, `<main><h1>Web</h1><p>${"servlet filter ".repeat(20)}</p></main>`));
    const cache = new CacheService();
    await new SpringBootDocsServiceOptimized(undefined, cache, new SearchIndex()).getSpringReference("boot", "web");
    const fresh = new SearchIndex();
    mockedFetch.mockClear();
    await new SpringBootDocsServiceOptimized(undefined, cache, fresh).getSpringReference("boot", "web");
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(fresh.size).toBe(1);
  });

  it("guide : réindexe le texte complet depuis le cache, même après une lecture summary", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, longGuide("zebrapassage")));
    const cache = new CacheService();
    const first = new SpringBootDocsServiceOptimized(undefined, cache, new SearchIndex());
    await first.getGuide("big", "full");
    await first.getGuide("big", "summary");
    const fresh = new SearchIndex();
    mockedFetch.mockClear();
    const service = new SpringBootDocsServiceOptimized(undefined, cache, fresh);
    await service.getGuide("big", "summary");
    expect(mockedFetch).not.toHaveBeenCalled();
    const hits = await service.searchSpringDocs("zebrapassage", "content", 5);
    expect(hits[0]).toMatchObject({ type: "content" });
  });

  it("ne réindexe pas un document déjà présent", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, projectHtml));
    const index = new SearchIndex();
    const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), index);
    await service.getSpringProject("spring-batch");
    const add = vi.spyOn(index, "add");
    await service.getSpringProject("spring-batch");
    expect(add).not.toHaveBeenCalled();
  });
});

describe("index plein texte : get_migration_guide (G3)", () => {
  it("indexe la page, y compris sur cache hit ; la section demandée ne restreint pas l'index", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, WIKI));
    const cache = new CacheService();
    const index = new SearchIndex();
    const service = new SpringBootDocsServiceOptimized(undefined, cache, index);
    await service.getMigrationGuide("3.0", "auto", "Before You Start");
    expect(index.has("migration:migration-guide:3.0")).toBe(true);
    const hits = index.search("Before You Start", 5);
    expect(hits[0].url).toContain("Spring-Boot-3.0-Migration-Guide");

    const fresh = new SearchIndex();
    mockedFetch.mockClear();
    await new SpringBootDocsServiceOptimized(undefined, cache, fresh).getMigrationGuide("3.0");
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(fresh.has("migration:migration-guide:3.0")).toBe(true);
  });
});

describe("formatSearchResults : note hors numérotation (G4)", () => {
  it("numérote les résultats et laisse la note non numérotée", () => {
    const out = formatSearchResults([
      { type: "project", title: "Batch", url: "https://x/y", description: "d" },
      { type: "note", title: "Content index is empty", description: "read a page first" },
    ]);
    expect(out).toMatch(/^1\. \*\*Batch\*\*/);
    expect(out).not.toMatch(/2\. /);
    expect(out).toContain("**Content index is empty**");
    expect(out).toContain("read a page first");
  });

  it("une note seule n'est pas numérotée", () => {
    const out = formatSearchResults([{ type: "note", title: "Vide", description: "desc" }]);
    expect(out).not.toMatch(/\d\. /);
    expect(out).toContain("Vide");
  });

  it("liste vide inchangée", () => {
    expect(formatSearchResults([])).toBe("No results found.");
  });
});

describe("contenu de guide quasi vide (G5)", () => {
  it("rejette un extrait JSON de 150 caractères", async () => {
    const json = '{"componentChunkName":"component---src-templates-guide","path":"/guides/gs/rest-service/","result":{"pageContext":{}}}';
    mockedFetch.mockImplementation(async () => fakeResponse(200, `<html><body><main>${json}</main></body></html>`));
    await expect(new SpringBootDocsServiceOptimized().getGuide("rest-service")).rejects.toThrow(/no content/i);
  });

  it("rejette un contenu de quelques caractères", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, `<html><body><main><p>Chargement…</p></main></body></html>`));
    await expect(new SpringBootDocsServiceOptimized().getGuide("tiny")).rejects.toThrow(/no content/i);
  });

  it("accepte la fixture de guide courte mais réelle", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE_PAGE));
    await expect(new SpringBootDocsServiceOptimized().getGuide("rest-service")).resolves.toContain("What You Will Build");
  });
});

describe("search_spring_concepts : paramètre category (G6)", () => {
  it("n'expose plus de paramètre category (la page de référence n'a pas de catégories)", () => {
    const tool = (ToolDefinitions.getToolList() as any[]).find(t => t.name === "search_spring_concepts");
    expect(Object.keys(tool.inputSchema.properties)).toEqual(["concept", "version"]);
    expect(tool.description).not.toMatch(/catégorie/i);
  });
});
