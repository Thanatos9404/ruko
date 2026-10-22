import { describe, expect, it } from "vitest";
import { decide, DELAY_CRITICAL_MIN, DELAY_HIGH_MIN, DELAY_NO_ANSWER_MIN } from "../server/engine/decision.js";
import { signalDef } from "../shared/signals.js";
import type { Check, Confidence, Signal } from "../shared/types.js";
import { assessRisk } from "../server/engine/policy.js";
import { customer, device, payment } from "./helpers.js";

let n = 0;
const sig = (type: string, evidence = "quote", confidence: Confidence = "high", pattern_hint?: string): Signal => ({
  id: `sig_${++n}`,
  type,
  severity: signalDef(type)!.severity,
  confidence,
  evidence,
  pattern_hint,
  at: "2026-10-16T08:31:00.000Z",
  source: "agent",
});

function check(signals: Signal[], over: Partial<Check> = {}): Pick<Check, "signals" | "contact" | "risk" | "customer" | "payment" | "call"> {
  const p = payment();
  const c = customer({ language: "en" });
  return { signals, contact: { status: "not_requested" }, risk: assessRisk(p, c, device()), customer: c, payment: p, ...over };
}

/** An ordinary hold: a new payee and a larger-than-usual amount, no call, no hard rule. */
function ordinary(signals: Signal[]): Pick<Check, "signals" | "contact" | "risk" | "customer" | "payment" | "call"> {
  const p = payment({ amount_inr: 30_000, payee: { name: "Sharma Traders", handle: "sharma@okdemo", is_new: true, prior_payments: 0 } });
  const c = customer({ language: "en" });
  return { signals, contact: { status: "not_requested" }, risk: assessRisk(p, c, device({ active_call: false })), customer: c, payment: p };
}

describe("post-call decision policy", () => {
  it("blocks when a critical sign is backed by another strong sign, and names the pattern", () => {
    const d = decide({
      check: check([sig("authority_threat", "said CBI will arrest me"), sig("coached_on_call", "officer is on video call"), sig("secrecy_demand", "told not to tell my son")]),
      agentRecommendation: "block",
    });
    expect(d.outcome).toBe("block");
    expect(d.pattern?.id).toBe("digital_arrest");
    expect(d.reasons[0].code).toBe("MULTIPLE_STRONG_SIGNS");
    expect(d.customer_message).toMatch(/1930/);
  });

  it("delays 24h on a single critical sign", () => {
    const d = decide({ check: check([sig("coached_on_call", "someone on the line is telling me")]), agentRecommendation: "delay" });
    expect(d.outcome).toBe("delay");
    expect(d.delay_minutes).toBe(DELAY_CRITICAL_MIN);
  });

  it("releases an explained payment with no warning signs", () => {
    const d = decide({ check: check([sig("knows_payee", "my landlord of 3 years"), sig("own_initiative", "my own rent")]), agentRecommendation: "release" });
    expect(d.outcome).toBe("release");
    expect(d.pattern).toBeNull();
    expect(d.escalated_over_agent).toBe(false);
  });

  it("never lets the agent de-escalate: a coached customer who talks the agent round stays held", () => {
    const d = decide({ check: check([sig("authority_threat"), sig("urgency_pressure")]), agentRecommendation: "release" });
    expect(d.outcome).toBe("block");
    expect(d.escalated_over_agent).toBe(true);
    expect(d.reasons.map((r) => r.code)).toContain("POLICY_OVERRODE_AGENT");
  });

  it("an agent 'block' with no recorded evidence becomes a delay", () => {
    const d = decide({ check: ordinary([]), agentRecommendation: "block" });
    expect(d.outcome).toBe("delay");
    expect(d.reasons.map((r) => r.code)).toContain("AGENT_CAUTION");
  });

  it("ignores low-confidence signals", () => {
    const d = decide({ check: ordinary([sig("coached_on_call", "maybe", "low")]), agentRecommendation: "release" });
    expect(d.outcome).toBe("release");
  });

  describe("safe default on critical pre-call risk", () => {
    it("never releases on a cover story alone: delays and escalates to the fraud desk", () => {
      // Safe-custody payee and an active call: critical risk. The customer only says it's their own decision.
      const d = decide({ check: check([sig("own_initiative", "it's my own decision"), sig("purpose_consistent", "it's an investment")]), agentRecommendation: "release" });
      expect(d.outcome).toBe("delay");
      expect(d.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["SAFE_DEFAULT_CRITICAL_RISK", "ESCALATED_TO_FRAUD_DESK"]));
    });

    it("releases on positive evidence: the customer checked the payee independently", () => {
      const d = decide({ check: check([sig("verified_independently", "I visited the office and have the signed agreement")]), agentRecommendation: "release" });
      expect(d.outcome).toBe("release");
    });

    it("releases when the customer knows the payee personally and the purpose fits", () => {
      const d = decide({ check: check([sig("knows_payee", "my cousin Arjun"), sig("purpose_consistent", "his wedding hall booking")]), agentRecommendation: "release" });
      expect(d.outcome).toBe("release");
    });

    it("medium-confidence answers are not positive evidence", () => {
      const d = decide({ check: check([sig("verified_independently", "I think I checked", "medium")]), agentRecommendation: "release" });
      expect(d.outcome).toBe("delay");
    });

    it("an ordinary hold still releases on a consistent explanation", () => {
      const d = decide({ check: ordinary([sig("own_initiative", "my own order"), sig("purpose_consistent", "stock for my shop")]), agentRecommendation: "release" });
      expect(d.outcome).toBe("release");
    });
  });

  it("delays when the assistant itself tagged a scam pattern but heard no warning sign", () => {
    const d = decide({ check: ordinary([sig("purpose_consistent", "it's my part-time job payment", "high", "task_job")]), agentRecommendation: "release" });
    expect(d.outcome).toBe("delay");
    expect(d.reasons.map((r) => r.code)).toContain("PATTERN_SUSPECTED");
  });

  it("delays briefly when the customer could not be reached", () => {
    const d = decide({ check: check([]), noConversation: true });
    expect(d.outcome).toBe("delay");
    expect(d.delay_minutes).toBe(DELAY_NO_ANSWER_MIN);
  });

  it("blocks when the customer asks to cancel", () => {
    const d = decide({ check: check([sig("wants_to_cancel", "please stop it")]), agentRecommendation: "delay" });
    expect(d.outcome).toBe("block");
  });

  it("a trusted contact's confirmation lifts a delay that came only from high signs", () => {
    const base = check([sig("urgency_pressure", "hospital needs it today")]);
    expect(decide({ check: base }).outcome).toBe("delay");
    const confirmed = decide({ check: { ...base, contact: { status: "reached", outcome: { reached: true, knows_about_payment: true, concern_raised: false } } } });
    expect(confirmed.outcome).toBe("release");
    expect(confirmed.reasons.map((r) => r.code)).toContain("CONTACT_CONFIRMED");
  });

  it("a trusted contact's concern escalates", () => {
    const d = decide({
      check: check([sig("coached_on_call")], { contact: { status: "reached", outcome: { reached: true, knows_about_payment: false, concern_raised: true } } }),
    });
    expect(d.outcome).toBe("block");
  });

  it("two high signs without a critical one delay for 4 hours", () => {
    const d = decide({ check: check([sig("promised_returns", "30% a month"), sig("payee_unknown", "don't know who they are")]) });
    expect(d.outcome).toBe("delay");
    expect(d.delay_minutes).toBe(DELAY_HIGH_MIN);
    expect(d.pattern?.id).toBe("investment_trading");
  });

  it("speaks Hindi to Hindi customers", () => {
    const c = check([sig("authority_threat"), sig("secrecy_demand")]);
    c.customer = { ...c.customer, language: "hi" };
    const d = decide({ check: c });
    expect(d.customer_message).toMatch(/रोक दिया गया/);
  });
});
