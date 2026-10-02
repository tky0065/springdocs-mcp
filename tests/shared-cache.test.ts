import { describe, it, expect, vi, afterEach } from "vitest";
import { CacheService } from "../src/services/cache.js";
import { SpringBootDocsServiceOptimized } from "../src/services/springboot-docs-optimized.js";
import { AdvancedFeaturesService } from "../src/services/advanced-features.js";

afterEach(() => vi.restoreAllMocks());

describe("cache partagé (#27)", () => {
  it("partage les entrées entre services construits avec le même cache", () => {
    const cache = new CacheService();
    const docs = new SpringBootDocsServiceOptimized(undefined, cache) as any;
    const advanced = new AdvancedFeaturesService(cache) as any;
    expect(docs.cache).toBe(cache);
    expect(advanced.cache).toBe(cache);
  });

  it("isole les caches quand aucun n'est fourni", () => {
    const a = new AdvancedFeaturesService() as any;
    const b = new AdvancedFeaturesService() as any;
    expect(a.cache).not.toBe(b.cache);
  });

  it("démarre un cleanup qui ne retient pas le process", () => {
    const unref = vi.fn();
    const spy = vi.spyOn(globalThis, "setInterval").mockReturnValue({ unref } as any);
    new CacheService();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
  });
});
