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
      .rejects.toThrow(/Invalid docType "api".*guides, reference, projects, content, all/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("accepte projects", async () => {
    await expect(new SpringBootDocsServiceOptimized().searchSpringDocs("boot", "projects", 5)).resolves.toBeInstanceOf(Array);
  });

  it("l'enum du tool search_spring_docs correspond aux sources réelles", () => {
    const tool = toolsModule.ToolDefinitions.getToolList().find((t: any) => t.name === "search_spring_docs") as any;
    expect(tool.inputSchema.properties.docType.enum).toEqual(["guides", "reference", "projects", "content", "all"]);
  });
});

describe("sources de recherche en parallèle (#31)", () => {
  it("lance les sources sans attendre la précédente et conserve l'ordre guides, projects, reference", async () => {
    const service = new SpringBootDocsServiceOptimized() as any;
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    service.getAllSpringGuides = async () => { started.push("guides"); await gate; return [{ title: "boot guide", description: "" }]; };
    service.searchSpringProjects = async () => { started.push("projects"); return [{ title: "boot project" }]; };
    service.searchInReference = async () => { started.push("reference"); return [{ title: "boot ref" }]; };

    const pending = service.searchSpringDocs("boot", "all", 10);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(started).toEqual(["guides", "projects", "reference"]);
    release();
    const results = await pending;
    expect(results.filter((r: any) => r.type !== "note").map((r: any) => r.title)).toEqual(["boot guide", "boot project", "boot ref"]);
  });
});
