/**
 * Serves the production build the way Vercel does: static files from dist/
 * (SPA fallback to index.html) and /v1/* + /api/* through the same handler as
 * api/router.ts. Use it to test a real build locally (no HMR, no dev tooling).
 *
 *   npm run build && npx tsx scripts/serve-prod.ts 5430
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { loadDotEnv } from "../server/env.js";

loadDotEnv(".env");
process.env.RUKO_DATA_DIR ??= ".data/store-prod";
const { getApp } = await import("../server/runtime.js");
const port = Number(process.argv[2] ?? 5430);
const root = join(process.cwd(), "dist");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/")) {
      const app = await getApp();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", req.socket.remoteAddress ?? "127.0.0.1");
      const r = await app.handle(
        new Request(url, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks) }),
      );
      res.statusCode = r.status;
      r.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) throw new Error("bad path");
    const s = await stat(file).catch(() => null);
    if (!s || s.isDirectory()) file = join(root, "index.html");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
}).listen(port, () => console.log(`Ruko production build on http://localhost:${port}`));
