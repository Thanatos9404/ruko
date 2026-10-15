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

export class Router {
  private routes: Route[] = [];

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
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    let pathMatched = false;
    for (const r of this.routes) {
      const m = url.pathname.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      const params: Params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      try {
        return await r.handler(req, params, url);
      } catch (e) {
        return errorResponse(e);
      }
    }
    return json({ error: { code: pathMatched ? "method_not_allowed" : "not_found", message: `${req.method} ${url.pathname}` } }, pathMatched ? 405 : 404);
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

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
