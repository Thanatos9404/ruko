import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Serves the Ruko API (/v1/*, /api/*) from the same dev server, using the exact
 * handler that runs on Vercel. Server code is loaded through Vite's SSR loader,
 * so edits reload without restarting.
 */
function rukoApi(): Plugin {
  return {
    name: "ruko-api",
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? "/";
        if (!url.startsWith("/v1/") && !url.startsWith("/api/")) return next();
        try {
          const { getApp } = (await server.ssrLoadModule("/server/runtime.ts")) as typeof import("./server/runtime");
          const app = await getApp();
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          headers.set("x-forwarded-for", req.socket.remoteAddress ?? "127.0.0.1");
          const request = new Request(`http://${req.headers.host ?? "localhost"}${url}`, {
            method: req.method,
            headers,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
          });
          const response = await app.handle(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { code: "dev_server", message: String(e) } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rukoApi()],
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    // Pre-bundle everything the lazy routes use, so a late discovery can't split React into two copies.
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "motion/react", "lucide-react", "lenis", "ogl", "@bolna/web-call"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { NODE_ENV: "test" },
  },
} as Parameters<typeof defineConfig>[0]);
