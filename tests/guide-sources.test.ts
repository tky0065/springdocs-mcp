import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import * as toolsModule from "../src/tools/index.js";
import { fakeResponse } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const GUIDE_HTML = "<main><h1>Building a REST service</h1><p>Contenu du guide</p></main>";
const requested = () => mockedFetch.mock.calls.map(call => call[0] as string);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedFetch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("getGuide sources (#17)", () => {
  it("essaie /guides/gs/<id>/ en premier", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE_HTML));
    await new SpringBootDocsServiceOptimized().getGuide("rest-service");
    expect(requested()).toEqual(["https://spring.io/guides/gs/rest-service/"]);
  });

  it("normalise l'identifiant de style gs-rest-service", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE_HTML));
    await new SpringBootDocsServiceOptimized().getGuide("gs-rest-service");
    expect(requested()).toEqual(["https://spring.io/guides/gs/rest-service/"]);
  });

  it("retombe sur /guides/<id>/ puis échoue sans jamais appeler GitHub", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(404));
    await expect(new SpringBootDocsServiceOptimized().getGuide("unknown-guide")).rejects.toThrow(/Guide not found/);
    expect(requested()).toEqual([
      "https://spring.io/guides/gs/unknown-guide/",
      "https://spring.io/guides/unknown-guide/",
    ]);
  });

  it("partage le cache entre gs-<id> et <id>", async () => {
    mockedFetch.mockImplementation(async () => fakeResponse(200, GUIDE_HTML));
    const service = new SpringBootDocsServiceOptimized();
    await service.getGuide("gs-rest-service");
    await service.getGuide("rest-service");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("l'exemple du schéma du tool ne contient plus le préfixe gs-", () => {
    const tool = toolsModule.ToolDefinitions.getToolList().find((t: any) => t.name === "get_spring_guide") as any;
    expect(tool.inputSchema.properties.guideId.description).not.toContain("gs-rest-service");
  });
});

describe("getGuide identifiant vide (#17)", () => {
  it("rejette 'gs-' sans appel réseau", async () => {
    await expect(new SpringBootDocsServiceOptimized().getGuide("gs-")).rejects.toThrow(/Invalid guideId/);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
