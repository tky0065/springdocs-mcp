/**
 * Intelligent caching service for Spring documentation
 */
export class CacheService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly LONG_TTL = 24 * 60 * 60 * 1000; // 24 hours for stable content
  private readonly MAX_ENTRIES = 500;

  constructor() {
    // Drop expired entries every hour; unref so the timer never keeps the process alive
    setInterval(() => this.cleanup(), 60 * 60 * 1000).unref();
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Refresh recency: Map iterates in insertion order, so re-insert at the end
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Store data in cache with optional custom TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.delete(key);
    while (this.cache.size >= this.MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Store data with long TTL for stable content
   */
  setLongTerm<T>(key: string, data: T): void {
    this.set(key, data, this.LONG_TTL);
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; expired: number; maxEntries: number } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
    }

    return { size: this.cache.size, expired, maxEntries: this.MAX_ENTRIES };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries or everything; returns how many entries were removed
   */
  purge(mode: "expired" | "all"): number {
    const before = this.cache.size;
    if (mode === "all") {
      this.clear();
    } else {
      this.cleanup();
    }
    return before - this.cache.size;
  }

  /**
   * Markdown report of the cache state, optionally purging first
   */
  statsReport(purge: "none" | "expired" | "all" = "none"): string {
    const removed = purge === "none" ? null : this.purge(purge);
    const { size, expired, maxEntries } = this.getStats();
    const lines = [
      "# Cache statistics",
      "",
      `- Entries: ${size} / ${maxEntries}`,
      `- Expired (awaiting cleanup): ${expired}`,
    ];
    if (removed !== null) {
      lines.push(`- Removed by purge (${purge}): ${removed}`);
    }
    return lines.join("\n");
  }
}