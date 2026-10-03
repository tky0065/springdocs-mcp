import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { InitializrService } from "../src/services/initializr.js";
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";
import { fakeResponse, settle } from "./helpers.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const METADATA = read("initializr.json");
const DEPENDENCIES = read("initializr-dependencies.json");
const DEPENDENCIES_URL = "https://start.spring.io/dependencies";

const route = (overrides: { dependencies?: any } = {}) =>
  mockedFetch.mockImplementation(async (url: string) =>
    (url.split("?")[0] === DEPENDENCIES_URL
      ? (overrides.dependencies ?? fakeResponse(200, DEPENDENCIES))
      : fakeResponse(200, METADATA)) as any);

beforeEach(() => {
  vi.useFakeTimers();
  mockedFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InitializrService.findDependency (#51)", () => {
  it("trouve data-jpa avec ses snippets Maven et Gradle (données réelles)", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa");
    expect(text).toContain("## `data-jpa`");
    expect(text).toContain("org.springframework.boot:spring-boot-starter-data-jpa");
    expect(text).toContain("```xml");
    expect(text).toContain("```gradle");
  });

  it("build=maven ne produit que le snippet Maven", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa", "maven");
    expect(text).toContain("```xml");
    expect(text).not.toContain("```gradle");
  });

  it("need sans mot exploitable : erreur avant tout réseau", async () => {
    route();
    const service = new InitializrService(new CacheService());
    await expect(service.findDependency("the for spring")).rejects.toThrow(/searchable word/i);
    await expect(service.findDependency(".*(")).rejects.toThrow(/searchable word/i);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("aucune correspondance : message explicite", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("zzzzzzqq");
    expect(text).toMatch(/No dependency matches "zzzzzzqq"/);
  });

  it("need non ASCII : pas de crash", async () => {
    route();
    await expect(new InitializrService(new CacheService()).findDependency("base de données")).resolves.toBeTypeOf("string");
  });

  it("deux recherches : un fetch par source, pas plus", async () => {
    route();
    const service = new InitializrService(new CacheService());
    await service.findDependency("jpa");
    await service.findDependency("web");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("erreur HTTP sur /dependencies : propagée, rien de /dependencies en cache", async () => {
    route({ dependencies: fakeResponse(503, "") });
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).findDependency("jpa"));
    expect(outcome.ok).toBe(false);
    expect(cache.get("initializr:dependencies")).toBeNull();
  });

  it("réponse /dependencies sans dependencies : erreur claire, rien en cache", async () => {
    route({ dependencies: fakeResponse(200, "{}") });
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).findDependency("jpa"));
    expect(outcome.ok).toBe(false);
    expect(String((outcome as any).error)).toMatch(/unexpected response/i);
    expect(cache.get("initializr:dependencies")).toBeNull();
  });

  it("boms et repositories absents : tolérés", async () => {
    route({ dependencies: fakeResponse(200, JSON.stringify({ bootVersion: "4.1.1", dependencies: JSON.parse(DEPENDENCIES).dependencies })) });
    await expect(new InitializrService(new CacheService()).findDependency("jpa")).resolves.toContain("`data-jpa`");
  });
});

describe("find_spring_dependency : bootVersion et titre", () => {
  it("interroge /dependencies?bootVersion=", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa", "both", "4.0.8");
    expect(mockedFetch).toHaveBeenCalledWith("https://start.spring.io/dependencies?bootVersion=4.0.8", expect.anything());
    expect(text).toContain("`data-jpa`");
  });

  it("refuse un format hors X.Y.Z avant tout réseau", async () => {
    route();
    const service = new InitializrService(new CacheService());
    for (const bad of ["4.0", "4.0.8.RELEASE", "4.0.8&x=1", "latest", "4.0.8/../x", ""]) {
      await expect(service.findDependency("jpa", "both", bad)).rejects.toThrow(/X\.Y\.Z/);
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("le cache distingue les versions", async () => {
    route();
    const service = new InitializrService(new CacheService());
    await service.findDependency("jpa", "both", "4.0.8");
    await service.findDependency("jpa", "both", "4.1.1");
    await service.findDependency("jpa", "both", "4.0.8");
    const urls = mockedFetch.mock.calls.map(c => String(c[0]));
    expect(urls.filter(u => u.startsWith(DEPENDENCIES_URL))).toHaveLength(2);
  });

  it("need multi-lignes : titre sur une seule ligne, markdown neutralisé", async () => {
    route();
    const text = await new InitializrService(new CacheService()).findDependency("jpa\n# pwn [x](y)");
    expect(text.split("\n")[0]).toBe('# Dependencies for "jpa \\# pwn \\[x\\](y)" (Spring Boot 4.1.1)');
  });

  it("getInitializr : query neutralisée dans le message sans résultat", async () => {
    route();
    const text = await new InitializrService(new CacheService()).getInitializr("dependencies", "zzqq\n# pwn");
    expect(text).toBe('No dependency matches "zzqq \\# pwn".');
  });
});

describe("tool find_spring_dependency (#51)", () => {
  it("est défini avec need borné et build en enum", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "find_spring_dependency") as any;
    expect(tool.inputSchema.required).toEqual(["need"]);
    expect(tool.inputSchema.properties.need.maxLength).toBe(100);
    expect(tool.inputSchema.properties.build.enum).toEqual(["maven", "gradle", "both"]);
    expect(tool.inputSchema.properties.bootVersion.maxLength).toBe(20);
  });

  it("valide les arguments", () => {
    expect(validateToolArguments("find_spring_dependency", { need: "jpa" })).toEqual({ need: "jpa" });
    expect(validateToolArguments("find_spring_dependency", { need: "jpa", build: "gradle" })).toEqual({ need: "jpa", build: "gradle" });
    expect(() => validateToolArguments("find_spring_dependency", {})).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "  " })).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "x".repeat(101) })).toThrow();
    expect(() => validateToolArguments("find_spring_dependency", { need: "jpa", build: "ant" })).toThrow();
  });
});
