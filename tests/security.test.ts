import { describe, expect, it } from "vitest";
import { rateLimitAddress } from "../server/http.js";
import { bank, customer, device, fakeBolna, makeApp, payment, req, TOOL_TOKEN } from "./helpers.js";

/**
 * Abuse controls in front of paid calls: limits keyed on the client IP alone, a daily
 * budget for wrong access codes, caps that hold under concurrent requests, and CORS
 * restricted to Ruko's own origins on the live-call and sandbox routes.
 */
const CODE = "JUDGE-2026";
let runs = 0;
const session = () => ({
  run_id: `run-sec-${String(++runs).padStart(6, "0")}`,
  agent_id: "agent-check",
  sip_username: "u",
  sip_password: "p",
  sip_domain: "d",
  wss_url: "wss://x",
  sip_register: false,
  expires_in: 60,
  ice_servers: [],
});

function liveApp(over: Record<string, unknown> = {}) {
  const fb = fakeBolna({
    // A slow wallet read widens any race between concurrent mints.
    "GET /user/me": () => ({ wallet: 480 }),
    "POST /web-call/freeswitch-session": () => session(),
  });
  return makeApp({ bolnaApiKey: "bn-test", agents: { check: "agent-check", contact: "agent-contact", line: "agent-line" }, ...over }, fb.client);
}

type App = ReturnType<typeof makeApp>;
const newCheck = async (app: App) =>
  (await app.handle(req("POST", "/v1/checks", { payment: payment(), customer: customer({ language: "en" }), device: device() }, bank()))).json();
const verify = (app: App, code: string, ip = "203.0.113.9", ua = "ua-1") =>
  app.handle(req("POST", "/api/live/verify", { access_code: code }, { "x-forwarded-for": ip, "user-agent": ua }));
const mint = (app: App, c: { id: string; client_secret: string }, code = CODE, ip = "203.0.113.9") =>
  app.handle(req("POST", `/api/demo/checks/${c.id}/session`, { access_code: code }, { "X-Client-Secret": c.client_secret, "x-forwarded-for": ip }));

describe("rate limits are keyed on the IP alone", () => {
  it("changing the user agent does not reset the limit", async () => {
    const app = liveApp();
    for (let i = 0; i < 20; i++) expect((await verify(app, CODE, "198.51.100.20", `agent-${i}`)).status).toBe(200);
    const r = await verify(app, CODE, "198.51.100.20", "a-brand-new-agent");
    expect(r.status).toBe(429);
    expect((await r.json()).error.code).toBe("rate_limited");
    // A different address has its own bucket.
    expect((await verify(app, CODE, "198.51.100.21")).status).toBe(200);
  });

  it("groups IPv6 addresses by /64 and unwraps IPv4-mapped addresses", () => {
    expect(rateLimitAddress("2001:db8:abcd:12:1::5")).toBe(rateLimitAddress("2001:db8:abcd:12:ffff:ffff:ffff:1"));
    expect(rateLimitAddress("2001:db8:abcd:12::1")).not.toBe(rateLimitAddress("2001:db8:abcd:13::1"));
    expect(rateLimitAddress("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(rateLimitAddress("198.51.100.7")).toBe("198.51.100.7");
  });
});

describe("wrong access codes are budgeted per IP per day", () => {
  it("allows ten wrong codes, then answers 429 to everything from that address", async () => {
    const app = liveApp();
    for (let i = 0; i < 10; i++) expect(await (await verify(app, `WRONG-${i}`)).json()).toEqual({ valid: false });
    const blocked = await verify(app, "WRONG-X");
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("rate_limited");
    // Even the right code: the answer must stop being an oracle.
    expect((await verify(app, CODE)).status).toBe(429);
    // Another address is unaffected.
    expect(await (await verify(app, CODE, "198.51.100.30")).json()).toEqual({ valid: true });
  });

  it("a right code never uses the budget", async () => {
    const app = liveApp();
    for (let i = 0; i < 9; i++) await verify(app, `WRONG-${i}`);
    for (let i = 0; i < 5; i++) expect(await (await verify(app, CODE)).json()).toEqual({ valid: true });
    expect(await (await verify(app, "WRONG-9")).json()).toEqual({ valid: false });
    expect((await verify(app, CODE)).status).toBe(429);
  });

  it("is shared by the mint routes", async () => {
    const app = liveApp({ dailyCallCap: 50, perCodeDailyCap: 50 });
    const c = await newCheck(app);
    for (let i = 0; i < 10; i++) {
      const r = await mint(app, c, `WRONG-${i}`);
      expect(r.status).toBe(403);
      expect((await r.json()).error.code).toBe("access_code_invalid");
    }
    const r = await mint(app, c, CODE);
    expect(r.status).toBe(429);
    expect((await r.json()).error.code).toBe("rate_limited");
    expect((await verify(app, CODE)).status).toBe(429);
  });
});

describe("caps hold under concurrent requests", () => {
  it("two simultaneous mints for the last slot: exactly one succeeds", async () => {
    const app = liveApp({ dailyCallCap: 2, perCodeDailyCap: 10 });
    expect((await mint(app, await newCheck(app))).status).toBe(200);
    const [a, b] = [await newCheck(app), await newCheck(app)];
    const results = await Promise.all([mint(app, a, CODE, "198.51.100.41"), mint(app, b, CODE, "198.51.100.42")]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 429]);
    const denied = results.find((r) => r.status === 429)!;
    expect((await denied.json()).error.code).toBe("daily_cap");
    expect((await (await app.handle(req("GET", "/api/live/status"))).json()).calls_left_today).toBe(0);
  });

  it("the per-code cap holds too", async () => {
    const app = liveApp({ dailyCallCap: 10, perCodeDailyCap: 1 });
    const [a, b] = [await newCheck(app), await newCheck(app)];
    const results = await Promise.all([mint(app, a, CODE, "198.51.100.51"), mint(app, b, CODE, "198.51.100.52")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
    // The denied request's reservation was rolled back: one slot used today.
    expect((await (await app.handle(req("GET", "/api/live/status"))).json()).calls_left_today).toBe(9);
  });

  it("two simultaneous contact sessions for the last try: exactly one succeeds", async () => {
    const app = liveApp({ dailyCallCap: 10, perCodeDailyCap: 10 });
    const c = await newCheck(app);
    expect((await mint(app, c)).status).toBe(200);
    const toolHeaders = { Authorization: `Bearer ${TOOL_TOKEN}` };
    await app.handle(req("POST", "/v1/bolna/tools/record_signal", { check_id: c.id, signal: "authority_threat", evidence: "said he is CBI", confidence: "high", pattern_hint: "digital_arrest" }, toolHeaders));
    await app.handle(req("POST", "/v1/bolna/tools/call_trusted_contact", { check_id: c.id, customer_consent: "yes" }, toolHeaders));
    const contact = () => app.handle(req("POST", `/api/demo/checks/${c.id}/contact-session`, {}, { "X-Client-Secret": c.client_secret }));
    expect((await contact()).status).toBe(200);
    const results = await Promise.all([contact(), contact()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
    expect((await contact()).status).toBe(429);
  });
});

describe("CORS on the live-call and sandbox routes", () => {
  const EVIL = "https://evil.example";
  const PROD = "https://ruko-symphony.vercel.app";

  it("gives no CORS header to another site, and refuses its writes", async () => {
    const app = liveApp();
    const get = await app.handle(req("GET", "/api/live/status", undefined, { Origin: EVIL }));
    expect(get.headers.get("access-control-allow-origin")).toBeNull();
    const post = await app.handle(req("POST", "/api/live/verify", { access_code: CODE }, { Origin: EVIL }));
    expect(post.status).toBe(403);
    expect((await post.json()).error.code).toBe("forbidden_origin");
    expect(post.headers.get("access-control-allow-origin")).toBeNull();
    const pay = await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest" }, { Origin: EVIL }));
    expect(pay.status).toBe(403);
    const pre = await app.handle(req("OPTIONS", "/api/public/session", undefined, { Origin: EVIL }));
    expect(pre.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers Ruko's own origins, same-origin pages and non-browser clients", async () => {
    const app = liveApp();
    const prod = await app.handle(req("POST", "/api/live/verify", { access_code: CODE }, { Origin: PROD }));
    expect(prod.status).toBe(200);
    expect(prod.headers.get("access-control-allow-origin")).toBe(PROD);
    expect(prod.headers.get("vary")).toContain("Origin");
    const local = await app.handle(req("GET", "/api/demo/scenarios", undefined, { Origin: "http://localhost:5410" }));
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:5410");
    // The deployment's own host (a preview URL, say) is always allowed.
    const self = await app.handle(req("POST", "/api/live/verify", { access_code: CODE }, { Origin: "https://ruko.test" }));
    expect(self.status).toBe(200);
    // No Origin header: not a browser cross-site request.
    expect((await app.handle(req("POST", "/api/live/verify", { access_code: CODE }))).status).toBe(200);
  });

  it("leaves the bank API and the public library open", async () => {
    const app = liveApp();
    const health = await app.handle(req("GET", "/v1/health", undefined, { Origin: EVIL }));
    expect(health.headers.get("access-control-allow-origin")).toBe("*");
    expect(await health.json()).toEqual({ ok: true, service: "ruko" });
    const patterns = await app.handle(req("GET", "/v1/patterns", undefined, { Origin: EVIL }));
    expect(patterns.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("console view", () => {
  it("does not expose the Bolna agent id", async () => {
    const app = liveApp({ dailyCallCap: 10, perCodeDailyCap: 10 });
    const c = (await (
      await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest", language: "en" }, { "x-forwarded-for": "198.51.100.60" }))
    ).json()) as { id: string; client_secret: string };
    expect((await mint(app, c, CODE, "198.51.100.60")).status).toBe(200);
    const view = await (await app.handle(req("GET", `/api/console/checks/${c.id}`))).json();
    expect(view.call).toBeTruthy();
    expect(view.call.agent_id).toBeUndefined();
  });
});
