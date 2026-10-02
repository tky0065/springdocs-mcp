import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

import fetch from "node-fetch";
import { CacheService } from "../src/services/cache.js";
import { InitializrService, formatDependencies, formatOptions } from "../src/services/initializr.js";
import { fakeResponse, settle } from "./helpers.js";
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";

const mockedFetch = vi.mocked(fetch) as unknown as ReturnType<typeof vi.fn>;
const meta = JSON.parse(readFileSync(new URL("./fixtures/initializr.json", import.meta.url), "utf8"));
const URL_ = "https://start.spring.io/metadata/client";

beforeEach(() => { vi.useFakeTimers(); mockedFetch.mockReset(); });
afterEach(() => vi.useRealTimers());

describe("formatOptions", () => {
  it("liste types, Java, langages, packaging et versions de Boot avec les défauts", () => {
    const text = formatOptions(meta);
    expect(text).toContain("# Spring Initializr options");
    expect(text).toMatch(/Build type/);
    expect(text).toMatch(/Java version/);
    expect(text).toMatch(/Language/);
    expect(text).toMatch(/Packaging/);
    expect(text).toMatch(/Spring Boot version/);
    expect(text).toContain(`\`${meta.javaVersion.default}\` (default)`);
    expect(text).toContain(`\`${meta.bootVersion.default}\` (default)`);
  });

  it("marque les versions SNAPSHOT et milestone", () => {
    const text = formatOptions(meta);
    expect(text).toContain("`4.2.0.BUILD-SNAPSHOT` (snapshot)");
    expect(text).toContain("`4.2.0.M2` (milestone)");
  });
});

describe("formatDependencies", () => {
  it("sans query : groupé par catégorie, id et nom, sans description", () => {
    const text = formatDependencies(meta);
    expect(text).toContain("## Web");
    expect(text).toContain("`web`");
    expect(text).not.toContain(meta.dependencies.values[0].values[0].description);
  });

  it("query : filtre par id, nom ou description, insensible à la casse, avec description", () => {
    const text = formatDependencies(meta, "JPA");
    expect(text).toContain("`data-jpa`");
    expect(text).not.toContain("`security`");
    expect(text).toMatch(/Spring Data JPA/i);
  });

  it("query : caractères spéciaux traités littéralement", () => {
    expect(() => formatDependencies(meta, ".*(")).not.toThrow();
    expect(formatDependencies(meta, ".*")).toMatch(/No dependency matches/);
  });

  it("query vide ou blanche : équivaut à l'absence de query", () => {
    expect(formatDependencies(meta, "   ")).toBe(formatDependencies(meta));
  });

  it("aucune correspondance : message explicite", () => {
    expect(formatDependencies(meta, "zzzzzz")).toMatch(/No dependency matches "zzzzzz"/);
  });

  it("plus de 30 correspondances : plafonné avec un message", () => {
    const many = {
      dependencies: { values: [{ name: "Big", values: Array.from({ length: 35 }, (_, i) => ({ id: `dep-${i}`, name: `Dep ${i}`, description: "x" })) }] },
    };
    const text = formatDependencies(many as any, "dep");
    expect(text.match(/`dep-\d+`/g)).toHaveLength(30);
    expect(text).toMatch(/5 more matches/);
  });

  it("métadonnées sans dependencies : erreur claire", () => {
    expect(() => formatDependencies({} as any)).toThrow(/unexpected response/i);
  });
});

describe("InitializrService", () => {
  const ok = () => mockedFetch.mockResolvedValue(fakeResponse(200, JSON.stringify(meta)) as any);

  it("récupère l'URL des métadonnées et formate les options par défaut", async () => {
    ok();
    const text = await new InitializrService(new CacheService()).getInitializr();
    expect(mockedFetch.mock.calls[0][0]).toBe(URL_);
    expect(text).toContain("# Spring Initializr options");
  });

  it("un seul fetch pour deux appels, options puis dependencies", async () => {
    ok();
    const service = new InitializrService(new CacheService());
    await service.getInitializr("options");
    await service.getInitializr("dependencies", "web");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("propage l'erreur HTTP et ne met rien en cache", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(503, "") as any);
    const cache = new CacheService();
    const service = new InitializrService(cache);
    const outcome = await settle(service.getInitializr());
    expect(outcome.ok).toBe(false);
    expect(cache.getStats().size).toBe(0);
    ok();
    await expect(service.getInitializr()).resolves.toContain("options");
  });

  it("métadonnées incomplètes (options ou groupes sans values) : erreur claire, rien en cache", async () => {
    const broken = [
      { ...meta, type: undefined },
      { ...meta, javaVersion: { default: "17" } },
      { ...meta, dependencies: { values: [{ name: "Web" }] } },
    ];
    for (const body of broken) {
      mockedFetch.mockResolvedValue(fakeResponse(200, JSON.stringify(body)) as any);
      const cache = new CacheService();
      const outcome = await settle(new InitializrService(cache).getInitializr("options"));
      expect(outcome.ok).toBe(false);
      expect(String((outcome as any).error)).toMatch(/unexpected response/i);
      expect(cache.getStats().size).toBe(0);
    }
  });

  it("JSON invalide ou inattendu : erreur, rien en cache", async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, "{}") as any);
    const cache = new CacheService();
    const outcome = await settle(new InitializrService(cache).getInitializr("dependencies"));
    expect(outcome.ok).toBe(false);
    expect(cache.getStats().size).toBe(0);
  });
});

describe("tool get_spring_initializr (#50)", () => {
  it("est défini avec enum section et maxLength sur query", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "get_spring_initializr") as any;
    expect(tool.inputSchema.properties.section.enum).toEqual(["options", "dependencies"]);
    expect(tool.inputSchema.properties.query.maxLength).toBe(100);
    expect(tool.inputSchema.required ?? []).toEqual([]);
  });

  it("valide les arguments", () => {
    expect(() => validateToolArguments("get_spring_initializr", {})).not.toThrow();
    expect(validateToolArguments("get_spring_initializr", { section: "dependencies", query: "web" }))
      .toEqual({ section: "dependencies", query: "web" });
    expect(() => validateToolArguments("get_spring_initializr", { section: "all" })).toThrow();
    expect(() => validateToolArguments("get_spring_initializr", { query: "x".repeat(101) })).toThrow();
  });
});
