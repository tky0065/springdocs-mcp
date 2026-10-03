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
  it("getStats expose les octets utilisés et le budget max (64 MiB par défaut)", () => {
    expect(new CacheService().getStats()).toEqual({ size: 0, expired: 0, bytes: 0, maxBytes: 64 * 1024 * 1024 });
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
    expect(text).toContain("Entries: 2");
    expect(text).toContain("/ 64.0 MiB");
    expect(text).toMatch(/expired.*1/i);
    expect(text).not.toMatch(/removed/i);
    expect(cache.getStats().size).toBe(2);
  });

  it("statsReport avec purge indique les entrées supprimées et les stats après purge", () => {
    const cache = filled();
    const text = cache.statsReport("expired");
    expect(text).toMatch(/removed.*1/i);
    expect(text).toContain("Entries: 1");
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

describe("CacheService budget en octets", () => {
  it("évince les entrées les moins récemment utilisées pour respecter le budget", () => {
    const cache = new CacheService({ maxBytes: 1000 });
    cache.set("a", "x".repeat(400));
    cache.set("b", "y".repeat(400));
    cache.get("a"); // a devient la plus récente
    cache.set("c", "z".repeat(400)); // dépasse : b (la plus ancienne) part
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).not.toBeNull();
    expect(cache.get("c")).not.toBeNull();
    const { bytes, maxBytes } = cache.getStats();
    expect(maxBytes).toBe(1000);
    expect(bytes).toBeLessThanOrEqual(1000);
  });

  it("ne met pas en cache une valeur plus grosse que le budget et conserve le reste", () => {
    const cache = new CacheService({ maxBytes: 1000 });
    cache.set("small", "ok");
    cache.set("huge", "x".repeat(5000));
    expect(cache.get("huge")).toBeNull();
    expect(cache.get("small")).toBe("ok");
  });

  it("une valeur trop grosse remplaçant une clé existante retire l'ancienne valeur", () => {
    const cache = new CacheService({ maxBytes: 1000 });
    cache.set("k", "old");
    cache.set("k", "x".repeat(5000));
    expect(cache.get("k")).toBeNull();
    expect(cache.getStats().bytes).toBe(0);
  });

  it("estime la taille des objets JSON et suit les remplacements, purges et clear", () => {
    const cache = new CacheService({ maxBytes: 10_000 });
    cache.set("o", { list: ["a".repeat(100)] });
    const first = cache.getStats().bytes;
    expect(first).toBeGreaterThan(100);
    cache.set("o", { list: ["a".repeat(100)] });
    expect(cache.getStats().bytes).toBe(first);
    cache.purge("all");
    expect(cache.getStats().bytes).toBe(0);
  });

  it("le budget par défaut est configurable via MCP_CACHE_MAX_MB", () => {
    vi.stubEnv("MCP_CACHE_MAX_MB", "8");
    expect(new CacheService().getStats().maxBytes).toBe(8 * 1024 * 1024);
    vi.stubEnv("MCP_CACHE_MAX_MB", "abc");
    expect(new CacheService().getStats().maxBytes).toBe(64 * 1024 * 1024);
    vi.unstubAllEnvs();
  });

  it("statsReport affiche l'occupation mémoire", () => {
    const cache = new CacheService({ maxBytes: 2 * 1024 * 1024 });
    cache.set("a", "x".repeat(1024));
    expect(cache.statsReport()).toMatch(/Memory \(estimated\): 0\.0 MiB \/ 2\.0 MiB/);
  });
});
