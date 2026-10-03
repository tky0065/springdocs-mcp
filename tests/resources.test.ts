import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { ResourcesService, parseResourceUri } from "../src/resources.js";
import { springProjectsConfig } from "../src/services/spring-projects-config.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

function setup() {
  const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
  return { docs, resources: new ResourcesService(docs) };
}

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) {
    expect(e).toBeInstanceOf(McpError);
    return (e as McpError).code;
  }
  throw new Error("aucune erreur levée");
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, "<main><h1>Titre</h1><p>Corps du document. Texte suffisamment long pour représenter une vraie page de documentation.</p></main>") as any);
});

describe("parseResourceUri", () => {
  it("accepte projet et guide", () => {
    expect(parseResourceUri("spring://project/spring-boot")).toEqual({ kind: "project", id: "spring-boot" });
    expect(parseResourceUri("spring://guide/rest-service")).toEqual({ kind: "guide", id: "rest-service" });
    expect(parseResourceUri("spring://guide/gs-rest.service_2")).toEqual({ kind: "guide", id: "gs-rest.service_2" });
  });

  it.each([
    "spring://project/../x", "spring://project/spring-boot?x=1", "spring://project/spring-boot#a",
    "spring://project/spring-boot/extra", "spring://project/Spring-Boot", "spring://project/", "spring://project",
    "spring://guide/a/b", "spring://guide/..", "spring://guide/a..b", "spring://guide/",
    "spring://other/x", "http://spring.io", "", "spring://project/spring-boot\n", " spring://project/spring-boot",
  ])("rejette %j en InvalidParams", (uri) => {
    expect(code(() => parseResourceUri(uri))).toBe(ErrorCode.InvalidParams);
  });
});

describe("listResources / listTemplates", () => {
  it("liste les 11 projets du registre avec des URI uniques bien formées", () => {
    const list = setup().resources.listResources();
    expect(list).toHaveLength(springProjectsConfig.getAllProjects().length);
    expect(list).toHaveLength(11);
    expect(new Set(list.map((r) => r.uri)).size).toBe(11);
    for (const r of list) {
      expect(() => parseResourceUri(r.uri)).not.toThrow();
      expect(r.uri.startsWith("spring://project/spring-")).toBe(true);
      expect(r.mimeType).toBe("text/markdown");
      expect(r.name).toBeTruthy();
    }
    expect(list.map((r) => r.uri)).toContain("spring://project/spring-boot");
  });

  it("expose les templates projet et guide", () => {
    const templates = setup().resources.listTemplates();
    expect(templates.map((t) => t.uriTemplate)).toEqual(["spring://project/{name}", "spring://guide/{id}"]);
    for (const t of templates) expect(t.mimeType).toBe("text/markdown");
  });
});

describe("readResource", () => {
  it("lit un projet : markdown complet, mimeType et source", async () => {
    const { contents } = await setup().resources.readResource("spring://project/spring-boot");
    expect(contents).toHaveLength(1);
    expect(contents[0].uri).toBe("spring://project/spring-boot");
    expect(contents[0].mimeType).toBe("text/markdown");
    expect(contents[0].text).toContain("Corps du document.");
    expect(contents[0].text).toContain("Source: https://spring.io/projects/spring-boot");
  });

  it("lit un guide", async () => {
    const { contents } = await setup().resources.readResource("spring://guide/rest-service");
    expect(contents[0].mimeType).toBe("text/markdown");
    expect(contents[0].text).toContain("Corps du document.");
  });

  it("une URI invalide ne déclenche aucun fetch", async () => {
    await expect(setup().resources.readResource("spring://project/../x")).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("un échec de récupération devient une McpError InternalError, sans cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "") as any);
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache);
    await expect(new ResourcesService(docs).readResource("spring://project/spring-nope"))
      .rejects.toMatchObject({ code: ErrorCode.InternalError });
    expect(cache.getStats().size).toBe(0);
  });

  it("partage le cache avec les tools : un seul fetch", async () => {
    const { docs, resources } = setup();
    await docs.getSpringProject("spring-boot");
    await resources.readResource("spring://project/spring-boot");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
