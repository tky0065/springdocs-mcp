import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, "<main><h1>ok</h1><p>content</p></main>"));
});
afterEach(() => vi.restoreAllMocks());

describe("segments d'URL fournis par l'utilisateur (#19)", () => {
  it.each(["../x", "a?b", "a#b", "a/b"])("getSpringProject rejette %j sans requête réseau", async (name) => {
    await expect(new SpringBootDocsServiceOptimized().getSpringProject(name)).rejects.toThrow(/project name/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("getSpringProject accepte un nom avec espaces", async () => {
    await new SpringBootDocsServiceOptimized().getSpringProject("Spring Boot");
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/spring-boot$/);
  });

  it.each(["../x", "a?b", "a/b"])("getSpringReference rejette la section %j", async (section) => {
    await expect(new SpringBootDocsServiceOptimized().getSpringReference("boot", section)).rejects.toThrow(/Invalid section: "/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("getSpringReference ignore une subsection vide", async () => {
    await expect(new SpringBootDocsServiceOptimized().getSpringReference("boot", "web", "")).resolves.toBeTypeOf("string");
  });

  it("getSpringReference rejette une subsection invalide", async () => {
    await expect(new SpringBootDocsServiceOptimized().getSpringReference("boot", "intro", "a#b")).rejects.toThrow(/subsection/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
