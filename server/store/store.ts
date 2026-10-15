/**
 * Minimal key-value store used by the API. Three implementations:
 * - MemoryStore: tests and the eval harness.
 * - FileStore: local development (survives dev-server reloads).
 * - RuntimeCacheStore: on Vercel, backed by the Vercel Runtime Cache (regional,
 *   shared by every function instance in the region), with an optional durable
 *   archive of finished checks in Vercel Blob.
 */
export interface KV {
  readonly kind: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryStore implements KV {
  readonly kind = "memory";
  private m = new Map<string, { v: string; exp: number | null }>();
  async get<T>(key: string): Promise<T | null> {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp < Date.now()) {
      this.m.delete(key);
      return null;
    }
    return JSON.parse(e.v) as T;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.m.set(key, { v: JSON.stringify(value), exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }
  async delete(key: string): Promise<void> {
    this.m.delete(key);
  }
}
