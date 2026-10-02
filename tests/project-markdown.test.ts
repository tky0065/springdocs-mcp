import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const HTML = "<main><h1>Spring Boot</h1><p>Contenu du projet.</p></main>";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, HTML) as any);
});

describe("getProjectMarkdown (#47)", () => {
  it("renvoie le markdown complet et l'URL source", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    const { markdown, url } = await docs.getProjectMarkdown("spring-boot");
    expect(markdown).toContain("Contenu du projet.");
    expect(url).toBe("https://spring.io/projects/spring-boot");
  });

  it("un seul fetch partagé avec getSpringProject", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    await docs.getProjectMarkdown("spring-boot");
    const paged = await docs.getSpringProject("spring-boot");
    expect(paged).toMatch(/^# spring-boot\n/);
    expect(paged).toContain("For complete project info, visit: https://spring.io/projects/spring-boot");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejette un nom dangereux avant tout fetch", async () => {
    const docs = new SpringBootDocsServiceOptimized(undefined, new CacheService());
    await expect(docs.getProjectMarkdown("../x")).rejects.toThrow();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("projet introuvable : erreur et rien en cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404, "") as any);
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache);
    await expect(docs.getProjectMarkdown("spring-nope")).rejects.toThrow(/not found/i);
    expect(cache.getStats().size).toBe(0);
  });
});
