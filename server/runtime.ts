import { createApp, type RukoApp } from "./app.js";
import { loadConfig } from "./config.js";
import { MemoryStore, type KV } from "./store/store.js";
import { FileStore } from "./store/file.js";
import { blobArchive, noArchive } from "./store/archive.js";

/**
 * Picks the store for where we're running and builds the app once per process.
 * Vercel: Runtime Cache (+ Blob archive if a token is set). Local: .data/ files.
 */
let app: RukoApp | null = null;

export async function getApp(): Promise<RukoApp> {
  if (app) return app;
  const config = loadConfig();
  let kv: KV;
  let defer: ((p: Promise<unknown>) => void) | undefined;
  if (process.env.VERCEL) {
    const { RuntimeCacheStore } = await import("./store/vercel.js");
    const { waitUntil } = await import("@vercel/functions");
    kv = new RuntimeCacheStore();
    defer = (p) => waitUntil(p.catch((e) => console.error("[ruko] deferred", e)));
  } else if (process.env.NODE_ENV === "test") {
    kv = new MemoryStore();
  } else {
    kv = new FileStore(process.env.RUKO_DATA_DIR ?? ".data/store");
  }
  app = createApp({ kv, config, archive: config.blobToken ? blobArchive(config.blobToken) : noArchive, defer });
  return app;
}
