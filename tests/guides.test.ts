import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const PAGE_DATA = fixture("guides-page-data.json");
const GUIDE_PAGE = fixture("guide-page.html");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("getAllSpringGuides (page-data.json)", () => {
  it("lit la liste dans page-data.json et ignore les nœuds sans chemin", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, PAGE_DATA));
    const guides = await new SpringBootDocsServiceOptimized().getAllSpringGuides(undefined, 10);
    expect(mockedFetch.mock.calls[0][0]).toBe("https://spring.io/page-data/guides/page-data.json");
    expect(guides).toEqual([
      { type: "spring-guide", title: "Scheduling Tasks", description: "Learn how to schedule tasks with Spring.", category: "IO", url: "https://spring.io/guides/gs/scheduling-tasks/" },
      { type: "spring-guide", title: "Building a RESTful Web Service", description: "Learn how to build a RESTful service.", category: "Web, REST", url: "https://spring.io/guides/gs/rest-service/" },
    ]);
  });

  it("filtre par catégorie et applique limit après le filtre", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, PAGE_DATA));
    const service = new SpringBootDocsServiceOptimized();
    expect((await service.getAllSpringGuides("rest", 10)).map(g => g.title)).toEqual(["Building a RESTful Web Service"]);
    expect(await service.getAllSpringGuides(undefined, 1)).toHaveLength(1);
  });

  it("rejette un JSON de forme inattendue sans le mettre en cache", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, '{"result":{}}'));
    const service = new SpringBootDocsServiceOptimized();
    await expect(service.getAllSpringGuides(undefined, 5)).rejects.toThrow(/guides/i);
    mockedFetch.mockImplementation(async () => fakeResponse(200, PAGE_DATA));
    expect(await service.getAllSpringGuides(undefined, 5)).toHaveLength(2);
  });

  it("rejette un corps qui n'est pas du JSON", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, "<html></html>"));
    await expect(new SpringBootDocsServiceOptimized().getAllSpringGuides(undefined, 5)).rejects.toThrow(/guides/i);
  });
});

describe("getGuide (contenu .ascii-doc)", () => {
  it("extrait le guide et ignore les cartes <article> annexes", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE_PAGE));
    const text = await new SpringBootDocsServiceOptimized().getGuide("rest-service", "full");
    expect(text).toContain("Building a RESTful Web Service");
    expect(text).toContain("What You Will Build");
    expect(text).not.toContain("Carte annexe");
    expect(text).not.toContain("menu");
  });

  it("échoue clairement si aucun contenu n'est extrait", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, "<html><body><script>x</script></body></html>"));
    await expect(new SpringBootDocsServiceOptimized().getGuide("empty-guide")).rejects.toThrow(/no content/i);
  });
});
