import { describe, expect, it } from "vitest";
import { API_KEY_B, bank, customer, device, makeApp, payment, req } from "./helpers.js";
import { loadConfig } from "../server/config.js";

const body = () => ({ payment: payment(), customer: customer(), device: device() });

describe("bank API: POST /v1/checks", () => {
  it("requires an API key", async () => {
    const app = makeApp();
    const r = await app.handle(req("POST", "/v1/checks", body()));
    expect(r.status).toBe(401);
  });

  it("holds a risky payment and returns a code word, client secret and reasons", async () => {
    const app = makeApp();
    const r = await app.handle(req("POST", "/v1/checks", body(), bank()));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.id).toMatch(/^chk_[A-Z0-9]{10}$/);
    expect(j.action).toBe("hold");
    expect(j.code_word).toMatch(/^[A-Z]+ \d{2}$/);
    expect(j.client_secret).toMatch(/^cs_/);
    expect(j.risk.reasons.length).toBeGreaterThan(2);
  });

  it("allows a routine payment with no code word", async () => {
    const app = makeApp();
    const r = await app.handle(
      req(
        "POST",
        "/v1/checks",
        {
          payment: payment({ amount_inr: 900, payee: { name: "Corner Kirana", handle: "kirana@okdemo", is_new: false, prior_payments: 30, in_contacts: true } }),
          customer: customer({ max_amount_90d: 5000 }),
          device: {},
        },
        bank(),
      ),
    );
    const j = await r.json();
    expect(j.action).toBe("allow");
    expect(j.code_word).toBeUndefined();
  });

  it("rejects a full account number in the payee handle", async () => {
    const app = makeApp();
    const b = body();
    b.payment.payee.handle = "123456789012";
    const r = await app.handle(req("POST", "/v1/checks", b, bank()));
    expect(r.status).toBe(400);
    expect((await r.json()).error.field).toBe("payment.payee.handle");
  });

  it("is idempotent: a retry returns the same check, a different body conflicts", async () => {
    const app = makeApp();
    const h = { ...bank(), "Idempotency-Key": "pay-7781" };
    const a = await app.handle(req("POST", "/v1/checks", body(), h));
    const b = await app.handle(req("POST", "/v1/checks", body(), h));
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.headers.get("Idempotent-Replayed")).toBe("true");
    const ja = await a.json();
    const jb = await b.json();
    expect(jb.id).toBe(ja.id);
    expect(jb.client_secret).toBeUndefined();
    const changed = body();
    changed.payment.amount_inr = 5;
    const c = await app.handle(req("POST", "/v1/checks", changed, h));
    expect(c.status).toBe(409);
  });

  it("keeps tenants apart", async () => {
    const app = makeApp();
    const j = await (await app.handle(req("POST", "/v1/checks", body(), bank()))).json();
    const other = await app.handle(req("GET", `/v1/checks/${j.id}`, undefined, bank(API_KEY_B)));
    expect(other.status).toBe(404);
    const own = await app.handle(req("GET", `/v1/checks/${j.id}`, undefined, bank()));
    expect(own.status).toBe(200);
    expect((await own.json()).client_secret_hash).toBeUndefined();
  });

  it("serves the app status only with the client secret", async () => {
    const app = makeApp();
    const j = await (await app.handle(req("POST", "/v1/checks", body(), bank()))).json();
    expect((await app.handle(req("GET", `/v1/checks/${j.id}/app-status`))).status).toBe(404);
    expect((await app.handle(req("GET", `/v1/checks/${j.id}/app-status?cs=wrong`))).status).toBe(404);
    const ok = await app.handle(req("GET", `/v1/checks/${j.id}/app-status`, undefined, { "X-Client-Secret": j.client_secret }));
    expect(ok.status).toBe(200);
    const s = await ok.json();
    expect(s.code_word).toBe(j.code_word);
    expect(s.status).toBe("holding");
  });

  it("refuses a live web session without an access code, without touching Bolna", async () => {
    const app = makeApp({ agents: { check: "agent-x" } });
    const j = await (await app.handle(req("POST", "/v1/checks", body(), bank()))).json();
    const r = await app.handle(req("POST", `/v1/checks/${j.id}/web-session`, {}, { "X-Client-Secret": j.client_secret }));
    expect([429, 403]).toContain(r.status);
  });

  it("publishes the pattern library with sources", async () => {
    const app = makeApp();
    const r = await app.handle(req("GET", "/v1/patterns"));
    const j = await r.json();
    expect(j.data.length).toBeGreaterThanOrEqual(10);
    for (const p of j.data) {
      expect(p.sources.length).toBeGreaterThan(0);
      expect(p.sources[0].url).toMatch(/^https:\/\//);
    }
  });

  it("computes metrics for the tenant", async () => {
    const app = makeApp();
    await app.handle(req("POST", "/v1/checks", body(), bank()));
    const m = await (await app.handle(req("GET", "/v1/metrics", undefined, bank()))).json();
    expect(m.checks).toBe(1);
    expect(m.held).toBe(1);
  });
});

describe("public text check", () => {
  it("matches a digital-arrest story and returns official advice", async () => {
    const app = makeApp();
    const r = await app.handle(req("POST", "/api/public/text-check", { text: "A CBI officer on video call said I am under digital arrest for money laundering", language: "en" }));
    const j = await r.json();
    expect(j.matches[0].id).toBe("digital_arrest");
    expect(j.matches[0].truth).toMatch(/no 'digital arrest' in Indian law/);
  });
});

describe("demo tenant provenance", () => {
  it("seeds the console with eval replays and keeps sandbox traffic in its own tenant", async () => {
    const app = makeApp();
    await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest" }));
    const demo = await (await app.handle(req("GET", "/api/console/checks?limit=200"))).json();
    expect(demo.data.length).toBeGreaterThan(40);
    expect(demo.data.every((c: { origin?: string }) => c.origin === "eval-replay")).toBe(true);
    const outcomes = new Set(demo.data.map((c: { decision?: { outcome: string } | null; risk: { action: string } }) => (c.risk.action === "allow" ? "allowed" : c.decision?.outcome)));
    expect([...outcomes]).toEqual(expect.arrayContaining(["allowed", "release", "block"]));
    const sandbox = await (await app.handle(req("GET", "/api/console/checks?tenant=sandbox"))).json();
    expect(sandbox.data).toHaveLength(1);
    expect(sandbox.data[0].origin).toBe("sandbox");
    const detail = await app.handle(req("GET", `/api/console/checks/${sandbox.data[0].id}`));
    expect(detail.status).toBe(200);
  });
});

describe("console data hygiene", () => {
  it("never shows a code word, a full phone number, or a real caller's transcript", async () => {
    const app = makeApp({ agents: { check: "agent-check" } });
    const pay = await (await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest", language: "en" }))).json();
    await app.checks.attachCall(pay.id, { channel: "web", status: "completed", transcript: [{ role: "customer", text: "my real words" }] });
    const v = await (await app.handle(req("GET", `/api/console/checks/${pay.id}`))).json();
    expect(v.code_word).toBeUndefined();
    expect(String(v.customer.phone_e164)).not.toMatch(/\d{6,}/);
    expect(v.call.transcript).toBeUndefined();
    expect(v.call.transcript_withheld).toBe(true);
  });

  it("refuses an API key that names the demo or sandbox tenant", () => {
    const cfg = loadConfig({ NODE_ENV: "test", RUKO_API_KEYS: "demo-bank:rk_test_x1234567890,sandbox:rk_test_y1234567890,pilot-bank:rk_test_z1234567890" });
    expect([...cfg.apiKeys.values()]).toEqual(["pilot-bank"]);
  });
});
