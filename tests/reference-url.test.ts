import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringProjectsConfig } from "../src/services/spring-projects-config.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const config = new SpringProjectsConfig();

describe("buildReferenceUrl (#16)", () => {
  it.each([
    ["boot", "web", undefined, "https://docs.spring.io/spring-boot/reference/web/index.html"],
    ["boot", "web", "servlet", "https://docs.spring.io/spring-boot/reference/web/servlet.html"],
    ["boot", "deployment", undefined, "https://docs.spring.io/spring-boot/how-to/deployment/index.html"],
    ["boot", "native-image", undefined, "https://docs.spring.io/spring-boot/reference/packaging/native-image/index.html"],
    ["boot", "application-properties", undefined, "https://docs.spring.io/spring-boot/appendix/application-properties/index.html"],
    ["framework", "core", undefined, "https://docs.spring.io/spring-framework/reference/core.html"],
    ["framework", "core", "beans", "https://docs.spring.io/spring-framework/reference/core/beans.html"],
    ["ai", "chatclient", undefined, "https://docs.spring.io/spring-ai/reference/api/chatclient.html"],
  ])("%s / %s / %s -> %s", (project, section, subsection, expected) => {
    expect(config.buildReferenceUrl(project, section, subsection)).toBe(expected);
  });

  it("toutes les sections déclarées produisent une URL https sans version figée", () => {
    for (const project of config.getAllProjects()) {
      for (const section of project.referenceSections ?? []) {
        const url = config.buildReferenceUrl(project.id, section);
        expect(url).toMatch(/^https:\/\/docs\.spring\.io\/[a-z-]+\//);
        expect(url).not.toContain("/html/");
      }
    }
  });
});

describe("getSpringReference utilise subsection (#16)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async () => fakeResponse(200, "<main><h1>Servlet</h1><p>contenu</p></main>"));
  });
  afterEach(() => vi.restoreAllMocks());

  it("récupère la page de la sous-section et la cache séparément", async () => {
    const service = new SpringBootDocsServiceOptimized();
    const text = await service.getSpringReference("boot", "web", "servlet");
    expect(mockedFetch.mock.calls[0][0]).toBe("https://docs.spring.io/spring-boot/reference/web/servlet.html");
    expect(text).toContain("https://docs.spring.io/spring-boot/reference/web/servlet.html");

    await service.getSpringReference("boot", "web");
    expect(mockedFetch.mock.calls[1][0]).toBe("https://docs.spring.io/spring-boot/reference/web/index.html");
  });
});
