import { describe, expect, it } from "vitest";
import { MemoryStore } from "../server/store/store.js";
import { CheckService, HOLD_MINUTES, validateCreate } from "../server/engine/checks.js";
import { DEFAULT_POLICY } from "../server/engine/policy.js";
import { runTool, type ToolDeps } from "../server/engine/toolHandlers.js";
import { bank, customer, device, fakeBolna, makeApp, payment, req, tool, WEBHOOK_TOKEN } from "./helpers.js";

/** Holes a judge could find with one question. Each is closed and pinned here. */
function setup(over: { device?: Parameters<typeof device>[0] } = {}) {
  let t = Date.parse("2026-10-23T09:00:00Z");
  const kv = new MemoryStore();
  const checks = new CheckService(kv, DEFAULT_POLICY, () => new Date(t));
  const deps: ToolDeps = { checks, kv, contact: { dial: async () => ({ status: "dialing", channel: "text-eval" }) } };
  const make = async () => {
    const input = validateCreate({ payment: { ...payment(), initiated_at: new Date(t).toISOString() }, customer: customer({ language: "en" }), device: device(over.device) });
    return (await checks.create("bank-a", input)).check;
  };
  return { checks, deps, make, tick: (ms: number) => (t += ms) };
}

describe("policy holes", () => {
  it("a hold never expires under a live call (clock test)", async () => {
    const { checks, make, tick } = setup();
    const c = await make();
    // The judge answers 14 minutes after Pay; the call runs past the original 15-minute hold.
    const answeredAt = tick(14 * 60_000);
    await checks.attachCall(c.id, { channel: "web", status: "in-progress", execution_id: "run-live-0001", started_at: new Date(answeredAt).toISOString() });
    await checks.extendHold(c.id, 210);
    tick(4 * 60_000); // past both the original hold and the extension, call still live
    const mid = await checks.get(c.id);
    expect(mid?.decision ?? null).toBeNull();
    expect(mid?.events.some((e) => e.type === "call.retry")).toBe(false);
  });

  it("a later set_decision can't lift the agent's own earlier block", async () => {
    const { deps, make } = setup();
    const c = await make();
    await runTool(deps, "record_signal", { check_id: c.id, signal: "authority_threat", evidence: "said CBI", confidence: "high", pattern_hint: "digital_arrest" });
    await runTool(deps, "set_decision", { check_id: c.id, recommendation: "block", reason: "digital arrest" });
    const r = await runTool(deps, "set_decision", { check_id: c.id, recommendation: "release", reason: "customer insists" });
    expect(r.body.final_decision).toBe("block");
  });

  it("a trusted contact who is unsure doesn't wipe the delay; 'reached' needs a placed call", async () => {
    const { checks, deps, make } = setup();
    const c = await make();
    await runTool(deps, "record_signal", { check_id: c.id, signal: "urgency_pressure", evidence: "told to pay in 10 minutes", confidence: "high", pattern_hint: "none" });
    await runTool(deps, "set_decision", { check_id: c.id, recommendation: "delay", reason: "pressure" });
    // No contact call was ever placed: the outcome can't claim the contact was reached.
    const noCall = await checks.reportContactOutcome(c.id, { reached: true, knows_about_payment: undefined, concern_raised: false, will_call_customer: false });
    expect(noCall.contact?.outcome?.reached).toBe(false);
    expect(noCall.decision?.outcome).toBe("delay");
    // Now a call is placed and the contact answers "unsure".
    await runTool(deps, "call_trusted_contact", { check_id: c.id, customer_consent: "yes" });
    const after = await runTool(deps, "report_contact_outcome", { check_id: c.id, knows_about_payment: "unsure", concern_raised: "no", will_call_customer: "no", notes: "not sure" });
    expect(after.body.decision_now).toBe("delay");
  });

  it("'family is on the call' while the caller isn't in contacts records a story conflict", async () => {
    const { deps, make, checks } = setup({ device: { active_call: true, caller_in_contacts: false } });
    const c = await make();
    await runTool(deps, "record_signal", { check_id: c.id, signal: "family_helping", evidence: "my nephew is guiding me", confidence: "high", pattern_hint: "none" });
    const s = await checks.require(c.id);
    expect(s.signals.find((x) => x.type === "story_conflict")?.severity).toBe("high");
  });

  it("a wrong check_id is recovered from the call's execution id", async () => {
    const { deps, make, checks } = setup();
    const c = await make();
    await runTool(deps, "get_check_context", { check_id: c.id, execution_id: "4b6c1a2e-0000-4000-8000-000000000001" });
    const r = await runTool(deps, "record_signal", { check_id: "chk_WRONG00", execution_id: "4b6c1a2e-0000-4000-8000-000000000001", signal: "authority_threat", evidence: "CBI", confidence: "high", pattern_hint: "digital_arrest" });
    expect(r.body.recorded).toBe(true);
    expect((await checks.require(c.id)).signals).toHaveLength(1);
  });

  it("a delay never auto-releases, and self-confirmation is off after a hard rule", async () => {
    const { deps, make } = setup();
    const c = await make(); // safe-custody payee: a hard rule
    await runTool(deps, "record_signal", { check_id: c.id, signal: "own_initiative", evidence: "my decision", confidence: "high", pattern_hint: "none" });
    const r = await runTool(deps, "set_decision", { check_id: c.id, recommendation: "release", reason: "says it's fine" });
    expect(r.body.final_decision).toBe("delay");
    const s = await deps.checks.require(c.id);
    expect(s.decision?.on_expiry).toBe("fraud_desk_callback");
    expect(s.decision?.self_confirm_allowed).toBe(false);
  });
});

describe("execution ownership", () => {
  it("the replay route can't link a recorded execution id to a check", async () => {
    const app = makeApp();
    const pay = await (await app.handle(req("POST", "/api/demo/pay", { scenario: "digital-arrest", language: "en" }))).json();
    const exec = "9d1e7c55-0000-4000-8000-00000000abcd";
    await app.handle(req("POST", `/api/demo/checks/${pay.id}/replay`, { tool: "get_check_context", args: { execution_id: exec } }, { "X-Client-Secret": pay.client_secret }));
    const c = await app.checks.require(pay.id);
    expect(c.call?.execution_id).not.toBe(exec);
  });

  it("the webhook refuses an execution whose user data names a different check", async () => {
    const EXEC = "b7140255-af33-4608-8e97-04dd944b8e00";
    const fb = fakeBolna({ [`GET /executions/${EXEC}`]: () => ({ id: EXEC, status: "completed", conversation_duration: 30, transcript: "assistant: hi\nuser: hello\n", context_details: { recipient_data: { check_id: "chk_OTHER123" } } }) });
    const app = makeApp({ agents: { check: "agent-check" } }, fb.client);
    const c = await (await app.handle(req("POST", "/v1/checks", { payment: payment(), customer: customer({ language: "en" }), device: device() }, bank()))).json();
    await app.handle(req("POST", "/v1/bolna/tools/get_check_context", { check_id: c.id, execution_id: EXEC }, tool()));
    const r = await (await app.handle(req("POST", `/v1/bolna/webhook?token=${WEBHOOK_TOKEN}`, { id: EXEC, status: "completed" }))).json();
    expect(r.handled).toBe(false);
    expect(String(r.reason)).toMatch(/disagree/);
  });
});
