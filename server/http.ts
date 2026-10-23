/** A tiny router over the Web Fetch API (Request -> Response). */

export type Params = Record<string, string>;
export type Handler = (req: Request, params: Params, url: URL) => Promise<Response> | Response;

interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "error",
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Cross-origin policy. Most routes are open (the bank API is called server-to-server and
 * the pattern library is public), but the routes that mint paid calls, check access codes or
 * drive the sandbox only answer browsers on Ruko's own origins.
 */
export interface CorsPolicy {
  restricted: (pathname: string) => boolean;
  /** Allowed browser origins, e.g. "https://ruko-symphony.vercel.app". The API's own host is always allowed. */
  origins: string[];
}

export function originAllowed(origin: string, url: URL, origins: string[]): boolean {
  if (origins.includes(origin)) return true;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

export class Router {
  private routes: Route[] = [];

  constructor(private readonly cors?: CorsPolicy) {}

  on(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const re = new RegExp(
      "^" +
        path.replace(/\/:([a-zA-Z_]+)/g, (_, k: string) => {
          keys.push(k);
          return "/([^/]+)";
        }) +
        "/?$",
    );
    this.routes.push({ method, re, keys, handler });
    return this;
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const restricted = this.cors?.restricted(url.pathname) ?? false;
    const origin = req.headers.get("origin");
    const allowed = !restricted || !origin || originAllowed(origin, url, this.cors?.origins ?? []);
    // Restricted routes: only allowed origins get CORS headers back, and a write from any
    // other site is refused outright (a "simple" cross-site POST would otherwise still run).
    const finish = (res: Response): Response => {
      if (!restricted) return res;
      const out = new Response(res.body, res); // headers of a fetched Response are immutable
      out.headers.delete("Access-Control-Allow-Origin");
      if (origin && allowed) {
        out.headers.set("Access-Control-Allow-Origin", origin);
        out.headers.append("Vary", "Origin");
      }
      return out;
    };
    if (req.method === "OPTIONS") return finish(new Response(null, { status: 204, headers: corsHeaders() }));
    if (!allowed && req.method !== "GET" && req.method !== "HEAD")
      return finish(json({ error: { code: "forbidden_origin", message: "This endpoint only accepts requests from Ruko's own site." } }, 403));
    let pathMatched = false;
    for (const r of this.routes) {
      const m = url.pathname.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      const params: Params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      try {
        return finish(await r.handler(req, params, url));
      } catch (e) {
        return finish(errorResponse(e));
      }
    }
    return finish(json({ error: { code: pathMatched ? "method_not_allowed" : "not_found", message: `${req.method} ${url.pathname}` } }, pathMatched ? 405 : 404));
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key,X-Client-Secret,X-Access-Code",
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(), ...headers },
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message, ...(e.extra ?? {}) } }, e.status);
  const name = (e as Error)?.constructor?.name;
  if (name === "ValidationError") return json({ error: { code: "invalid_request", message: (e as Error).message, field: (e as { field?: string }).field } }, 400);
  if (name === "ConflictError") return json({ error: { code: "idempotency_conflict", message: (e as Error).message } }, 409);
  if (name === "NotFoundError") return json({ error: { code: "not_found", message: (e as Error).message } }, 404);
  console.error("[ruko] unhandled", e);
  return json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large", "too_large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Body must be JSON", "invalid_json");
  }
}

/** The client address. On Vercel the platform sets x-forwarded-for (first entry) and x-real-ip. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * The address rate limits are keyed on: IPv4 as is, IPv4-mapped IPv6 as its IPv4 address,
 * and other IPv6 addresses by their /64 prefix (one subscriber usually holds a whole /64,
 * so rotating the low bits must not buy a fresh budget).
 */
export function rateLimitAddress(ip: string): string {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!v.includes(":")) return v;
  const [head, tail = ""] = v.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = v.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
