import { describe, expect, it } from "vitest";
import { bank, customer, device, fakeBolna, makeApp, payment, req, WEBHOOK_TOKEN } from "./helpers.js";

/**
 * The live-call gate: caps per access code (not per IP), a contact call that
 * doesn't spend a judge's slot, slots refunded when a call never connects, and
 * Bolna's own capacity errors kept meaningful.
 */
const CODE = "JUDGE-2026";
let runs = 0;
const session = () => ({
  run_id: `run-${String(++runs).padStart(8, "0")}`,
  agent_id: "agent-check",
  sip_username: "u",
  sip_password: "p",
  sip_domain: "d",
  wss_url: "wss://x",
  sip_register: false,
  expires_in: 60,
  ice_servers: [],
});

function setup(routes: Record<string, (b: unknown) => unknown> = {}, over: Record<string, unknown> = {}) {
  const fb = fakeBolna({
    "GET /user/me": () => ({ wallet: 480 }),
    "POST /web-call/freeswitch-session": () => session(),
    ...routes,
  });
  const app = makeApp({ bolnaApiKey: "bn-test", agents: { check: "agent-check", contact: "agent-contact", line: "agent-line" }, dailyCallCap: 4, perCodeDailyCap: 2, ...over }, fb.client);
  return { app, fb };
}

async function newCheck(app: ReturnType<typeof makeApp>) {
  return (await app.handle(req("POST", "/v1/checks", { payment: payment(), customer: customer({ language: "en" }), device: device() }, bank()))).json();
}

const mint = (app: ReturnType<typeof makeApp>, c: { id: string; client_secret: string }, code = CODE, ip = "203.0.113.7") =>
  app.handle(req("POST", `/v1/checks/${c.id}/web-session`, { access_code: code }, { "X-Client-Secret": c.client_secret, "x-forwarded-for": ip }));

const left = async (app: ReturnType<typeof makeApp>) => (await (await app.handle(req("GET", "/api/live/status"))).json()).calls_left_today as number;

describe("live-call gate", () => {
  it("caps per access code, not per IP, so judges behind one NAT don't lock each other out", async () => {
    const { app } = setup({}, { accessCodes: [CODE, "JUDGE-B"] });
    expect((await mint(app, await newCheck(app), CODE, "198.51.100.1")).status).toBe(200);
    expect((await mint(app, await newCheck(app), CODE, "198.51.100.2")).status).toBe(200);
    const third = await mint(app, await newCheck(app), CODE, "198.51.100.3");
    expect(third.status).toBe(429);
    expect((await third.json()).error.code).toBe("code_cap");
    // Same network, different judge's code: still allowed.
    expect((await mint(app, await newCheck(app), "JUDGE-B", "198.51.100.1")).status).toBe(200);
  });

  it("reads the wallet once per mint", async () => {
    const { app, fb } = setup();
    await mint(app, await newCheck(app));
    expect(fb.calls.filter((c) => c.path === "/user/me")).toHaveLength(1);
  });

  it("refunds the slot when minting fails, and reports Bolna's 429 as at_capacity with its scope", async () => {
    const { app } = setup({ "POST /web-call/freeswitch-session": () => ({ __status: 429, body: { message: "too many", scope: "customer" } }) });
    const before = await left(app);
    const r = await mint(app, await newCheck(app));
    expect(r.status).toBe(429);
    const j = await r.json();
    expect(j.error.code).toBe("at_capacity");
    expect(j.error.scope).toBe("customer");
    expect(await left(app)).toBe(before);
  });

  it("refunds a slot the browser releases when Bolna confirms the call never connected", async () => {
    const { app } = setup({
      "POST /web-call/freeswitch-session": () => ({ ...session(), run_id: "run-never" }),
      "GET /executions/run-never": () => ({ __status: 404, body: { message: "not found" } }),
    });
    const before = await left(app);
    expect(before).toBeGreaterThan(0);
    expect((await mint(app, await newCheck(app))).status).toBe(200);
    expect(await left(app)).toBe(before - 1);
    const rel = await (await app.handle(req("POST", "/api/live/release", { run_id: "run-never" }))).json();
    expect(rel.refunded).toBe(true);
    expect(await left(app)).toBe(before);
    // A second release is a no-op.
    expect((await (await app.handle(req("POST", "/api/live/release", { run_id: "run-never" }))).json()).refunded).toBe(false);
  });

  it("keeps the slot when the call did connect", async () => {
    const { app } = setup({
      "POST /web-call/freeswitch-session": () => ({ ...session(), run_id: "run-talked" }),
      "GET /executions/run-talked": () => ({ id: "run-talked", status: "completed", conversation_duration: 41, transcript: "assistant: hi\nuser: hello\n" }),
    });
    const before = await left(app);
    await mint(app, await newCheck(app));
    const rel = await (await app.handle(req("POST", "/api/live/release", { run_id: "run-talked" }))).json();
    expect(rel.refunded).toBe(false);
    expect(await left(app)).toBe(before - 1);
  });

  it("refunds through the webhook when a terminal execution had no conversation", async () => {
    const { app } = setup({
      "POST /web-call/freeswitch-session": () => ({ ...session(), run_id: "run-silent" }),
      "GET /executions/run-silent": () => ({ id: "run-silent", agent_id: "agent-check", status: "failed", conversation_duration: 0, transcript: "" }),
    });
    const before = await left(app);
    await mint(app, await newCheck(app));
    expect(await left(app)).toBe(before - 1);
    await app.handle(req("POST", `/v1/bolna/webhook?token=${WEBHOOK_TOKEN}`, { id: "run-silent", status: "failed" }));
    expect(await left(app)).toBe(before);
  });

  it("lets the trusted contact answer without spending a judge's slot", async () => {
    const { app } = setup({ "POST /web-call/freeswitch-session": () => session() });
    const c = await newCheck(app);
    expect((await mint(app, c)).status).toBe(200);
    const after = await left(app);
    // The engine rings the contact in the browser.
    await app.handle(req("POST", "/v1/bolna/tools/record_signal", { check_id: c.id, signal: "authority_threat", evidence: "said he is CBI", confidence: "high", pattern_hint: "digital_arrest" }, { Authorization: "Bearer tooltoken_test_123456" }));
    await app.handle(req("POST", "/v1/bolna/tools/call_trusted_contact", { check_id: c.id, customer_consent: "yes" }, { Authorization: "Bearer tooltoken_test_123456" }));
    const r = await app.handle(req("POST", `/api/demo/checks/${c.id}/contact-session`, {}, { "X-Client-Secret": c.client_secret }));
    expect(r.status).toBe(200);
    expect(await left(app)).toBe(after);
  });

  it("refuses a contact call that isn't part of an authorised live demo", async () => {
    const { app } = setup();
    const c = await newCheck(app);
    const r = await app.handle(req("POST", `/api/demo/checks/${c.id}/contact-session`, {}, { "X-Client-Secret": c.client_secret }));
    expect(r.status).toBe(409);
  });
});
