import { describe, expect, it } from "vitest";
import { MemoryStore } from "../server/store/store.js";
import { CheckService, HOLD_MINUTES, RETRY_MINUTES, validateCreate } from "../server/engine/checks.js";
import { DEFAULT_POLICY } from "../server/engine/policy.js";
import { customer, device, payment } from "./helpers.js";

describe("hold expiry with no answer", () => {
  it("retries once, then delays, when an unanswered hold is read after it expires (no recursion)", async () => {
    let t = Date.parse("2026-10-17T10:00:00Z");
    const checks = new CheckService(new MemoryStore(), DEFAULT_POLICY, () => new Date(t));
    const input = validateCreate({ payment: { ...payment(), initiated_at: new Date(t).toISOString() }, customer: customer(), device: device() });
    const { check } = await checks.create("bank-a", input);
    expect(check.risk.action).toBe("hold");

    t += (HOLD_MINUTES + 1) * 60_000;
    const first = await checks.get(check.id);
    expect(first?.decision).toBeNull();
    expect(first?.events.filter((e) => e.type === "call.retry")).toHaveLength(1);

    // Reading again before the retry window ends changes nothing.
    expect((await checks.get(check.id))?.events.filter((e) => e.type === "call.retry")).toHaveLength(1);

    t += (RETRY_MINUTES + 1) * 60_000;
    const second = await checks.get(check.id);
    expect(second?.decision?.outcome).toBe("delay");
    expect(second?.decision?.reasons.map((r) => r.code)).toContain("NO_ANSWER_AFTER_RETRY");

    // A listing that touches the same check returns promptly too.
    const list = await checks.list("bank-a", 10);
    expect(list.map((c) => c.id)).toContain(check.id);
  });
});
