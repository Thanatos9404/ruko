import { describe, expect, it } from "vitest";
import { assessRisk, looksLikeSafeAccount, localHour } from "../server/engine/policy.js";
import { customer, device, payment } from "./helpers.js";

describe("pre-payment risk policy", () => {
  it("hard-holds a 'safe account' payee with an active call, with every reason explained", () => {
    const r = assessRisk(payment(), customer(), device());
    expect(r.action).toBe("hold");
    expect(r.band).toBe("high");
    const codes = r.reasons.map((x) => x.code);
    expect(codes).toEqual(expect.arrayContaining(["SAFE_ACCOUNT_PAYEE", "ACTIVE_CALL_DURING_PAYMENT", "NEW_PAYEE", "AMOUNT_FAR_ABOVE_USUAL"]));
    for (const reason of r.reasons) {
      expect(reason.title.length).toBeGreaterThan(3);
      expect(reason.detail.length).toBeGreaterThan(10);
    }
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("allows a routine rent payment to an established payee", () => {
    const r = assessRisk(
      payment({ amount_inr: 28_000, rail: "UPI", payee: { name: "Suresh Iyer", handle: "suresh@okdemo", is_new: false, prior_payments: 11, in_contacts: true } }),
      customer({ max_amount_90d: 28_000, avg_amount_90d: 9_000, digital_tenure_days: 1800 }),
      { active_call: false },
    );
    expect(r.action).toBe("allow");
    expect(r.band).toBe("low");
  });

  it("holds a remote-access session even for a small amount", () => {
    const r = assessRisk(
      payment({ amount_inr: 2_000, payee: { name: "A Kumar", handle: "ak@okdemo", is_new: false, prior_payments: 5 } }),
      customer({ max_amount_90d: 5_000 }),
      { remote_access_app: true },
    );
    expect(r.action).toBe("hold");
    expect(r.reasons.find((x) => x.code === "REMOTE_ACCESS_ACTIVE")?.hard).toBe(true);
  });

  it("mitigations lower the score but never cancel a hard hold", () => {
    const r = assessRisk(payment({ payee: { name: "Safe Custody Account", handle: "x", is_new: false, prior_payments: 9, in_contacts: true } }), customer({ planned_large_payment: true }), {});
    expect(r.reasons.some((x) => x.weight < 0)).toBe(true);
    expect(r.action).toBe("hold");
  });

  it("flags odd hours in the customer's timezone", () => {
    expect(localHour("2026-10-15T21:00:00.000Z", "Asia/Kolkata")).toBe(2);
    const r = assessRisk(payment({ initiated_at: "2026-10-15T21:00:00.000Z", payee: { name: "Ramesh", handle: "r@ok", is_new: true } }), customer(), {});
    expect(r.reasons.map((x) => x.code)).toContain("ODD_HOUR");
  });

  it("recognises safe-account style payee names without false positives on ordinary names", () => {
    expect(looksLikeSafeAccount("Safe Custody Account RBI")).toBe(true);
    expect(looksLikeSafeAccount("CBI verification desk")).toBe(true);
    expect(looksLikeSafeAccount("Courtney Fernandes")).toBe(false);
    expect(looksLikeSafeAccount("Policeline Traders")).toBe(false);
    expect(looksLikeSafeAccount("Suresh Iyer")).toBe(false);
  });

  it("explains a collect request as sending, not receiving", () => {
    const r = assessRisk(payment({ initiated_via: "collect_request", payee: { name: "Refund Desk", handle: "x@ok", is_new: true } }), customer(), {});
    const reason = r.reasons.find((x) => x.code === "STARTED_FROM_REQUEST_OR_LINK");
    expect(reason?.detail).toMatch(/sends money/);
  });
});
