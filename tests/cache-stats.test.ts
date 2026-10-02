import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../src/services/cache.js";

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
