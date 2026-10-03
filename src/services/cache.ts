/**
 * Intelligent caching service for Spring documentation
 */
const MIB = 1024 * 1024;
const DEFAULT_MAX_MB = 64;

export interface CacheOptions {
  /** Memory budget in bytes (estimated size of keys and values); default 64 MiB or MCP_CACHE_MAX_MB */
  maxBytes?: number;
}

function defaultMaxBytes(): number {
  const mb = Number(process.env.MCP_CACHE_MAX_MB);
  return Number.isFinite(mb) && mb > 0 ? Math.floor(mb * MIB) : DEFAULT_MAX_MB * MIB;
}

/** Estimated size in bytes: UTF-8 length for strings, of the JSON form otherwise */
function estimateBytes(key: string, data: unknown): number {
  let size = Buffer.byteLength(key);
  if (typeof data === "string") return size + Buffer.byteLength(data);
  try {
    size += Buffer.byteLength(JSON.stringify(data) ?? "");
  } catch {
    size += 1024; // not serialisable (cycles, BigInt): flat estimate
  }
  return size;
}

export class CacheService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number; bytes: number }>();
  private totalBytes = 0;
  private readonly maxBytes: number;
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly LONG_TTL = 24 * 60 * 60 * 1000; // 24 hours for stable content

  constructor(options: CacheOptions = {}) {
    this.maxBytes = options.maxBytes && options.maxBytes > 0 ? options.maxBytes : defaultMaxBytes();
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
      this.remove(key);
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
    this.remove(key);
    const bytes = estimateBytes(key, data);
    if (bytes > this.maxBytes) return; // larger than the whole budget: never cached
    while (this.totalBytes + bytes > this.maxBytes) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
      bytes,
    });
    this.totalBytes += bytes;
  }

  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.cache.delete(key);
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
        this.remove(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; expired: number; bytes: number; maxBytes: number } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
    }

    return { size: this.cache.size, expired, bytes: this.totalBytes, maxBytes: this.maxBytes };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.totalBytes = 0;
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
    const { size, expired, bytes, maxBytes } = this.getStats();
    const mib = (n: number) => (n / MIB).toFixed(1);
    const lines = [
      "# Cache statistics",
      "",
      `- Entries: ${size}`,
      `- Memory (estimated): ${mib(bytes)} MiB / ${mib(maxBytes)} MiB`,
      `- Expired (awaiting cleanup): ${expired}`,
    ];
    if (removed !== null) {
      lines.push(`- Removed by purge (${purge}): ${removed}`);
    }
    return lines.join("\n");
  }
}