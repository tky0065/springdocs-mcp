import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../src/services/cache.js";
import { ToolDefinitions } from "../src/tools/index.js";
import { validateToolArguments } from "../src/validation.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function filled() {
  const cache = new CacheService();
  cache.set("short", "a", 1000);
  cache.set("long", "b", 60 * 60 * 1000);
  vi.advanceTimersByTime(2000); // "short" expire
  return cache;
}

describe("CacheService stats et purge (#49)", () => {
  it("getStats expose la capacité max", () => {
    expect(new CacheService().getStats()).toEqual({ size: 0, expired: 0, maxEntries: 500 });
  });

  it("purge('expired') ne retire que les entrées expirées", () => {
    const cache = filled();
    expect(cache.purge("expired")).toBe(1);
    expect(cache.getStats()).toMatchObject({ size: 1, expired: 0 });
    expect(cache.get("long")).toBe("b");
  });

  it("purge('all') vide tout et renvoie le nombre supprimé", () => {
    const cache = filled();
    expect(cache.purge("all")).toBe(2);
    expect(cache.getStats().size).toBe(0);
  });

  it("purge('all') sur cache vide renvoie 0", () => {
    expect(new CacheService().purge("all")).toBe(0);
  });

  it("statsReport sans purge est en lecture seule", () => {
    const cache = filled();
    const text = cache.statsReport();
    expect(text).toContain("2 / 500");
    expect(text).toMatch(/expired.*1/i);
    expect(text).not.toMatch(/removed/i);
    expect(cache.getStats().size).toBe(2);
  });

  it("statsReport avec purge indique les entrées supprimées et les stats après purge", () => {
    const cache = filled();
    const text = cache.statsReport("expired");
    expect(text).toMatch(/removed.*1/i);
    expect(text).toContain("1 / 500");
    expect(text).toMatch(/expired.*0/i);
  });
});

describe("tool spring_cache_stats (#49)", () => {
  it("est défini avec un enum fermé pour purge", () => {
    const tool = ToolDefinitions.getToolList().find((t: any) => t.name === "spring_cache_stats") as any;
    expect(tool.inputSchema.properties.purge.enum).toEqual(["none", "expired", "all"]);
    expect(tool.inputSchema.required ?? []).toEqual([]);
  });

  it("accepte l'absence d'argument et les trois modes", () => {
    expect(() => validateToolArguments("spring_cache_stats", {})).not.toThrow();
    for (const purge of ["none", "expired", "all"]) {
      expect(validateToolArguments("spring_cache_stats", { purge })).toEqual({ purge });
    }
  });

  it("rejette une purge invalide", () => {
    expect(() => validateToolArguments("spring_cache_stats", { purge: "everything" })).toThrow();
    expect(() => validateToolArguments("spring_cache_stats", { purge: 1 })).toThrow();
  });
});
