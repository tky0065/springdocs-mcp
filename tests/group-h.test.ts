import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { SearchIndex } from "../src/services/search-index.js";
import { CacheService } from "../src/services/cache.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

const NAV = (prefix: string) =>
  `<nav><a class="nav-link" href="${prefix}web/index.html">Web Applications</a><a class="nav-link" href="${prefix}data/index.html">Data</a></nav>
   <main><h2>Web Applications</h2><div><p>Servlet stack text</p></div></main>`;

describe("search_spring_concepts avec version", () => {
  beforeEach(() => { quiet(); mockedFetch.mockReset(); mockedFetch.mockImplementation(async () => fakeResponse(200, NAV(""))); });
  afterEach(() => vi.restoreAllMocks());

  it("sans version : URL actuelle inchangée", async () => {
    await new SpringBootDocsServiceOptimized().searchSpringConcepts("web");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/docs/current/reference/html/");
  });

  it("3.4.2 -> doc 3.4 (patch ignoré) ; current = dernière", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.searchSpringConcepts("web", "3.4.2");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/3.4/reference/index.html");
    await service.searchSpringConcepts("data", "current");
    expect(mockedFetch.mock.calls[1][0]).toBe("https://docs.spring.io/spring-boot/docs/current/reference/html/");
  });

  it("cache distinct par version", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await service.searchSpringConcepts("web", "3.3");
    await service.searchSpringConcepts("web", "3.4");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    await service.searchSpringConcepts("web", "3.4.1");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("404 avec version -> message dédié ; version invalide sans réseau", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "nope"));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.searchSpringConcepts("web", "9.9")).rejects.toThrow("Spring Boot documentation for version 9.9 not found");
    mockedFetch.mockClear();
    await expect(service.searchSpringConcepts("web", "x")).rejects.toThrow("Invalid version");
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("search_spring_docs avec version", () => {
  beforeEach(() => { quiet(); mockedFetch.mockReset(); });
  afterEach(() => vi.restoreAllMocks());

  it("reference versionnée : URL de la version, liens résolus, cache par version", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, NAV("./")));
    const service = new SpringBootDocsServiceOptimized();
    const out = await service.searchSpringDocs("web", "reference", 10, "3.4");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/3.4/reference/index.html");
    expect(out[0].url).toBe("https://docs.spring.io/spring-boot/3.4/reference/web/index.html");
    await service.searchSpringDocs("web", "reference", 10, "3.4.9");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await service.searchSpringDocs("web", "reference", 10);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("404 de la version -> message dédié", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "nope"));
    await expect(new SpringBootDocsServiceOptimized().searchSpringDocs("web", "reference", 10, "9.9"))
      .rejects.toThrow(/version 9\.9/);
  });

  it("content : ne mélange pas les pages Boot de versions différentes", async () => {
    const index = new SearchIndex();
    index.add("reference:boot:3.3:web:main", { title: "Boot web", url: "u33", text: "servlet filters" });
    index.add("reference:boot:3.4:web:main", { title: "Boot web", url: "u34", text: "servlet filters" });
    index.add("guide:rest", { title: "Guide", url: "ug", text: "servlet filters" });
    const service = new SpringBootDocsServiceOptimized(undefined, new CacheService(), index);
    const urls = (await service.searchSpringDocs("servlet", "content", 10, "3.4")).map((r) => r.url);
    expect(urls).toContain("u34");
    expect(urls).toContain("ug");
    expect(urls).not.toContain("u33");
    const all = (await service.searchSpringDocs("servlet", "content", 10)).map((r) => r.url);
    expect(all).toContain("u33");
  });

  it("schémas : version acceptée (max 20), documentée comme ignorée par guides/projets", async () => {
    expect(validateToolArguments("search_spring_docs", { query: "q", version: "3.4" }).version).toBe("3.4");
    expect(validateToolArguments("search_spring_concepts", { concept: "q", version: "3.4" }).version).toBe("3.4");
    expect(() => validateToolArguments("search_spring_concepts", { concept: "q", version: "1".repeat(21) })).toThrow(/too long/);
    const { ToolDefinitions } = await import("../src/tools/index.js");
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "search_spring_docs") as any;
    expect(tool.inputSchema.properties.version.description).toMatch(/guides|projets/);
  });
});

const WIKI = "https://raw.githubusercontent.com/wiki/spring-projects/";
const FW = "## Upgrading From Spring Framework 6.1\n\n### Baseline Upgrades\n\nJava 17\n\n```\n## not a heading\n```\n\n### Removed APIs\n\nGone.\n";
const BATCH = "This document is meant to help you migrate to Spring Batch 5.0.\n\n# Major changes\n\n## Java 17\n\nrequired\n";

describe("get_migration_guide multi-projets", () => {
  beforeEach(() => { quiet(); mockedFetch.mockReset(); });
  afterEach(() => vi.restoreAllMocks());

  it("Framework : notes de version du wiki en markdown brut, titre synthétisé", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, FW));
    const out = await new SpringBootDocsServiceOptimized().getMigrationGuide("6.2.3", "auto", undefined, 0, "spring-framework");
    expect(mockedFetch.mock.calls[0][0]).toBe(`${WIKI}spring-framework/Spring-Framework-6.2-Release-Notes.md`);
    expect(out).toContain("# Spring Framework 6.2 Release Notes");
    expect(out).toContain("Baseline Upgrades");
  });

  it("Batch : guide de migration ; section filtrée sans compter les fences", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, BATCH));
    const out = await new SpringBootDocsServiceOptimized().getMigrationGuide("5.0", "auto", "java", 0, "spring-batch");
    expect(mockedFetch.mock.calls[0][0]).toBe(`${WIKI}spring-batch/Spring-Batch-5.0-Migration-Guide.md`);
    expect(out).toContain("# Spring Batch 5.0 Migration Guide (section: java)");
    expect(out).toContain("required");
    mockedFetch.mockImplementation(async () => fakeResponse(200, FW));
    await expect(new SpringBootDocsServiceOptimized().getMigrationGuide("6.2", "auto", "not a heading", 0, "spring-framework"))
      .rejects.toThrow("No section matching");
  });

  it("404 -> page absente ; contenu HTML (accueil) -> rejeté ; rien n'est caché en cache", async () => {
    const service = new SpringBootDocsServiceOptimized();
    mockedFetch.mockImplementation(async () => fakeResponse(404, "404: Not Found"));
    await expect(service.getMigrationGuide("4.0", "auto", undefined, 0, "spring-batch")).rejects.toThrow(/not found/i);
    mockedFetch.mockImplementation(async () => fakeResponse(200, "<!DOCTYPE html><html><title>Home</title></html>"));
    await expect(service.getMigrationGuide("4.0", "auto", undefined, 0, "spring-batch")).rejects.toThrow(/not found/i);
    mockedFetch.mockImplementation(async () => fakeResponse(200, BATCH));
    await expect(service.getMigrationGuide("4.0", "auto", undefined, 0, "spring-batch")).resolves.toContain("Spring Batch 4.0");
  });

  it("document incompatible avec le projet -> erreur claire sans réseau", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getMigrationGuide("6.2", "migration-guide", undefined, 0, "spring-framework")).rejects.toThrow(/release-notes/);
    await expect(service.getMigrationGuide("5.0", "release-notes", undefined, 0, "spring-batch")).rejects.toThrow(/migration-guide/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("projet inconnu -> rejet ; cache par projet ; pagination et indexation", async () => {
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getMigrationGuide("6.2", "auto", undefined, 0, "spring-foo" as any)).rejects.toThrow(/Unknown project/);
    const big = "# Big\n\n" + "Paragraphe de remplissage pour la pagination.\n\n".repeat(300);
    mockedFetch.mockImplementation(async () => fakeResponse(200, big));
    const first = await service.getMigrationGuide("6.2", "auto", undefined, 0, "spring-framework");
    expect(first).toMatch(/offset=\d+/);
    const second = await service.getMigrationGuide("6.2", "auto", undefined, 4000, "spring-framework");
    expect(second).not.toBe(first);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const hits = await service.searchSpringDocs("remplissage", "content");
    expect(hits.some((h) => h.title === "Spring Framework 6.2 Release Notes")).toBe(true);
  });

  it("Boot reste le défaut (URL wiki GitHub HTML inchangée)", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, ""));
    await expect(new SpringBootDocsServiceOptimized().getMigrationGuide("3.0")).rejects.toThrow();
    expect(mockedFetch.mock.calls[0][0]).toBe("https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide");
  });

  it("schéma : project énuméré, défaut spring-boot", () => {
    expect(validateToolArguments("get_migration_guide", { version: "6.2", project: "spring-framework" }).project).toBe("spring-framework");
    expect(() => validateToolArguments("get_migration_guide", { version: "6.2", project: "nope" })).toThrow();
  });
});
