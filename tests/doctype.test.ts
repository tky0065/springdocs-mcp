import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import * as toolsModule from "../src/tools/index.js";
import { fakeResponse, fixture } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async () => fakeResponse(200, fixture("listing.html")));
});
afterEach(() => vi.restoreAllMocks());

describe("docType (#14)", () => {
  it("rejette un docType inconnu avec un message explicite", async () => {
    await expect(new SpringBootDocsServiceOptimized().searchSpringDocs("boot", "api", 5))
      .rejects.toThrow(/Invalid docType "api".*guides, reference, projects, all/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("accepte projects", async () => {
    await expect(new SpringBootDocsServiceOptimized().searchSpringDocs("boot", "projects", 5)).resolves.toBeInstanceOf(Array);
  });

  it("l'enum du tool search_spring_docs correspond aux sources réelles", () => {
    const tool = toolsModule.ToolDefinitions.getToolList().find((t: any) => t.name === "search_spring_docs") as any;
    expect(tool.inputSchema.properties.docType.enum).toEqual(["guides", "reference", "projects", "all"]);
  });
});
