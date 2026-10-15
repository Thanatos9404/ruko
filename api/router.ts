import { getApp } from "../server/runtime.js";

/**
 * The single Vercel Function behind /v1/* and /api/* (see vercel.json rewrites).
 * One function keeps the Hobby plan's function count low and lets every route
 * share the same warm instance.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const app = await getApp();
    return app.handle(restoreOriginalPath(request));
  },
};

/**
 * vercel.json rewrites /v1/<rest> to /api/router?__p=/v1/<rest>. If the platform
 * already passes the original path through, __p is simply absent.
 */
export function restoreOriginalPath(request: Request): Request {
  const url = new URL(request.url);
  const p = url.searchParams.get("__p");
  if (url.pathname !== "/api/router" || !p) return request;
  url.searchParams.delete("__p");
  url.pathname = p.startsWith("/") ? p : `/${p}`;
  return new Request(url, request);
}
