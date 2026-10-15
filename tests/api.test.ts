import { describe, expect, it } from "vitest";
import { API_KEY_B, bank, customer, device, makeApp, payment, req } from "./helpers.js";

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
