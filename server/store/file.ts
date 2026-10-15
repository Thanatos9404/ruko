import { mkdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { KV } from "./store.js";

/** JSON files under a directory. For local development only. */
export class FileStore implements KV {
  readonly kind = "file";
  constructor(private dir: string) {}

  private path(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
    const h = createHash("sha1").update(key).digest("hex").slice(0, 8);
    return join(this.dir, `${safe}.${h}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await readFile(this.path(key), "utf8");
      const e = JSON.parse(raw) as { v: T; exp: number | null };
      if (e.exp !== null && e.exp < Date.now()) return null;
      return e.v;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const p = this.path(key);
    const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify({ v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null }));
    await rename(tmp, p);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
