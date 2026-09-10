/**
 * cacheManager.ts
 *
 * Lightweight, zero-dependency in-memory session cache manager.
 * Keeps data alive for the entire duration of the browser tab session (until tab close / refresh).
 * Automatically updates / invalidates whenever any record is created, updated, or deleted.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number | null; // null = persistent for the browser tab session
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  // null = Session lifetime (held in memory until browser tab is closed/refreshed)
  private defaultTTL: number | null = null;

  /**
   * Get cached data if present and unexpired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // If an expiry was explicitly set and has passed, remove entry
    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL (ms).
   * Passing null or omitting ttlMs keeps it for the whole tab session.
   */
  set<T>(key: string, data: T, ttlMs: number | null = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiry: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  /**
   * Invalidate a specific key or all keys starting with prefix (e.g., 'employees', 'reports')
   */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Fetch with cache and automatic in-flight deduplication.
   * If cached value is valid and !forceRefresh, returns immediately without network request.
   * If a fetch for the same key is already in-flight, awaits that same promise.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number | null = this.defaultTTL,
    forceRefresh: boolean = false
  ): Promise<T> {
    if (!forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const pending = this.inFlight.get(key);
      if (pending) {
        return pending as Promise<T>;
      }
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlMs);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const cacheManager = new CacheManager();
