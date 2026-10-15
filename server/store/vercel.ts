import { getCache } from "@vercel/functions";
import type { KV } from "./store.js";

/**
 * Vercel Runtime Cache: a regional key-value cache shared by all function
 * instances in the region. Pin the function to one region (vercel.json) so every
 * request reads the same cache. Entries are ephemeral, so finished checks are
 * also archived to Blob when a token is configured (see archive.ts).
 */
export class RuntimeCacheStore implements KV {
  readonly kind = "vercel-runtime-cache";
  private cache = getCache({ namespace: "ruko" });

  async get<T>(key: string): Promise<T | null> {
    const v = await this.cache.get(key);
    return (v ?? null) as T | null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(key, value as unknown, { ttl: ttlSeconds ?? 7 * 24 * 3600, name: key.split(":")[0] });
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }
}
