import { describe, expect, it } from "vitest";
import { bank, customer, device, makeApp, payment, req, tool } from "./helpers.js";

async function heldCheck(app: ReturnType<typeof makeApp>, lang: "en" | "hi" = "en") {
  const r = await app.handle(req("POST", "/v1/checks", { payment: payment(), customer: customer({ language: lang }), device: device() }, bank()));
  return r.json();
}

const call = (app: ReturnType<typeof makeApp>, name: string, args: Record<string, unknown>, headers: Record<string, string> = tool()) =>
  app.handle(req("POST", `/v1/bolna/tools/${name}`, args, headers));

describe("Bolna custom function endpoints", () => {
  it("reject calls without the tool token", async () => {
    const app = makeApp();
    const c = await heldCheck(app);
    expect((await call(app, "get_check_context", { check_id: c.id }, {})).status).toBe(401);
    expect((await call(app, "get_check_context", { check_id: c.id }, { Authorization: "Bearer nope" })).status).toBe(401);
  });

  it("enforce Bolna's source IPs when configured", async () => {
    const app = makeApp({ enforceBolnaIps: true });
    const c = await heldCheck(app);
    const blocked = await call(app, "get_check_context", { check_id: c.id }, { ...tool(), "X-Forwarded-For": "203.0.113.9" });
    expect(blocked.status).toBe(403);
    const allowed = await call(app, "get_check_context", { check_id: c.id }, { ...tool(), "X-Forwarded-For": "13.203.39.153" });
    expect(allowed.status).toBe(200);
  });

  it("get_check_context returns context and links the execution to the check", async () => {
    const app = makeApp();
    const c = await heldCheck(app);
    const exec = "6f1c2a3b-1111-4222-8333-944455556666";
    const r = await call(app, "get_check_context", { check_id: c.id, execution_id: exec });
    const j = await r.json();
    expect(j.payee).toBe("Safe Custody Account RBI");
    expect(j.amount).toBe("1 lakh 90 thousand rupees");
    expect(j.trusted_contact_on_file).toBe("Ravi (son)");
    expect(j.reminder).toMatch(/Never ask for OTP/);
    expect(await app.checks.checkIdForExecution(exec)).toBe(c.id);
  });

  it("record_signal stores evidence, scrubs numbers and returns the truth sentence once a pattern is clear", async () => {
    const app = makeApp();
    const c = await heldCheck(app);
    const first = await (await call(app, "record_signal", { check_id: c.id, signal: "authority_threat", evidence: "CBI officer said arrest, my OTP is 482913", confidence: "high", pattern_hint: "digital_arrest" })).json();
    expect(first.recorded).toBe(true);
    expect(first.likely_pattern).toBe("Digital arrest");
    expect(first.say_this).toMatch(/no 'digital arrest' in Indian law/);
    const stored = await app.checks.require(c.id);
    expect(stored.signals[0].evidence).not.toMatch(/482913/);
    expect(stored.signals[0].evidence).toMatch(/\[number removed\]/);
  });

  it("record_signal is idempotent for the same quote, and rejects unknown signal names politely", async () => {
    const app = makeApp();
    const c = await heldCheck(app);
    const a = { check_id: c.id, signal: "secrecy_demand", evidence: "told not to tell my son", confidence: "high" };
    await call(app, "record_signal", a);
    const again = await (await call(app, "record_signal", a)).json();
    expect(again.duplicate).toBe(true);
    expect((await app.checks.require(c.id)).signals).toHaveLength(1);
    const bad = await (await call(app, "record_signal", { ...a, signal: "made_up" })).json();
    expect(bad.recorded).toBe(false);
  });

  it("answers in Hindi for Hindi customers", async () => {
    const app = makeApp();
    const c = await heldCheck(app, "hi");
    const j = await (await call(app, "record_signal", { check_id: c.id, signal: "authority_threat", evidence: "पुलिस ने कहा गिरफ्तार होंगे", confidence: "high" })).json();
    expect(j.say_this).toMatch(/डिजिटल अरेस्ट/);
  });

  it("set_decision applies the policy, not just the agent's word", async () => {
    const app = makeApp();
    const c = await heldCheck(app);
    await call(app, "record_signal", { check_id: c.id, signal: "coached_on_call", evidence: "officer on video call", confidence: "high" });
    await call(app, "record_signal", { check_id: c.id, signal: "authority_threat", evidence: "said I'd be arrested", confidence: "high" });
    const j = await (await call(app, "set_decision", { check_id: c.id, recommendation: "release", reason: "customer says it's fine" })).json();
    expect(j.final_decision).toBe("block");
    expect(j.tell_customer).toMatch(/stopped/);
    const stored = await app.checks.require(c.id);
    expect(stored.decision?.escalated_over_agent).toBe(true);
    expect(stored.status).toBe("decided");
  });

  it("call_trusted_contact needs consent, and rings the contact in the browser when phone calls are off", async () => {
    const app = makeApp({ agents: { check: "a1", contact: "a2" }, allowPhoneCalls: false, contactWebRing: true });
    const c = await heldCheck(app);
    const no = await (await call(app, "call_trusted_contact", { check_id: c.id, customer_consent: "no" })).json();
    expect(no.status).toBe("not_called");
    // Data minimisation: no warning sign recorded yet, so the contact is not called.
    const early = await (await call(app, "call_trusted_contact", { check_id: c.id, customer_consent: "yes" })).json();
    expect(early.status).toBe("not_needed");
    await call(app, "record_signal", { check_id: c.id, signal: "secrecy_demand", evidence: "told to keep it secret", confidence: "high", pattern_hint: "none" });
    const yes = await (await call(app, "call_trusted_contact", { check_id: c.id, customer_consent: "yes" })).json();
    expect(yes.next).toMatch(/set_decision/);
    expect(yes.status).toBe("ringing_web");
    expect((await app.checks.require(c.id)).contact?.status).toBe("ringing_web");
  });

  it("a contact's confirmation re-decides a delayed payment", async () => {
    const app = makeApp({ agents: { check: "a1", contact: "a2" }, contactWebRing: true });
    const c = await heldCheck(app);
    await call(app, "record_signal", { check_id: c.id, signal: "urgency_pressure", evidence: "hospital needs it today", confidence: "high" });
    await call(app, "call_trusted_contact", { check_id: c.id, customer_consent: "yes" });
    const d = await (await call(app, "set_decision", { check_id: c.id, recommendation: "delay", reason: "waiting for son" })).json();
    expect(d.final_decision).toBe("delay");
    const out = await (await call(app, "report_contact_outcome", { check_id: c.id, knows_about_payment: "yes", concern_raised: "no", will_call_customer: "yes", notes: "knows, it's for dad's surgery" })).json();
    expect(out.decision_now).toBe("release");
  });

  it("returns a speakable error for a malformed or unknown check", async () => {
    const app = makeApp();
    const bad = await (await call(app, "get_check_context", { check_id: "{check_id}" })).json();
    expect(bad.error).toMatch(/check_id/);
    const missing = await (await call(app, "get_check_context", { check_id: "chk_ZZZZZZZZZZ" })).json();
    expect(missing.error).toMatch(/not found/);
    expect((await call(app, "nope", {})).status).toBe(404);
  });

  it("public line tools match patterns and log anonymised reports", async () => {
    const app = makeApp();
    const m = await (await call(app, "lookup_pattern", { description: "someone says my parcel from FedEx has drugs and customs will arrest me", language: "en" })).json();
    expect(["courier_parcel", "digital_arrest"]).toContain(m.pattern_id);
    await call(app, "log_report", { pattern_id: "courier_parcel", summary: "Caller got a parcel threat call from +91 98765 43210", language: "en" });
    const reports = await (await app.handle(req("GET", "/api/console/reports"))).json();
    expect(reports.data[0].summary).not.toMatch(/98765/);
  });
});
