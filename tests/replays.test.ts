import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioById } from "../shared/scenarios.js";

/**
 * Lint for the recorded demo runs in public/replays: each must end in the agent's
 * set_decision, never record a code-word mismatch, reach the decision within about
 * a minute at speaking pace, and recommend what the scenario's truth calls for.
 */
interface ReplayTurn {
  role: "agent" | "customer" | "tool";
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

const dir = join("public", "replays");
const files = readdirSync(dir).filter((f) => /-(en|hi)\.json$/.test(f));
const words = (t = "") => t.trim().split(/\s+/).filter(Boolean).length;

/** Same estimate as the eval: agent 2.5 words/s + 0.8 s per turn, customer 2.3 words/s, 0.6 s per tool. */
function secondsToDecision(turns: ReplayTurn[]): number {
  let s = 0;
  for (const t of turns) {
    if (t.role === "agent") s += words(t.text) / 2.5 + 0.8;
    else if (t.role === "customer") s += words(t.text) / 2.3;
    else {
      s += 0.6;
      if (t.tool === "set_decision") break;
    }
  }
  return Math.round(s);
}

describe("recorded demo runs", () => {
  it("there is one per held scenario and language", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  for (const f of files) {
    it(f, () => {
      const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as { scenario: string; turns: ReplayTurn[] };
      const tools = r.turns.filter((t) => t.role === "tool");
      const decision = tools.find((t) => t.tool === "set_decision");
      expect(decision, "ends in set_decision").toBeTruthy();
      expect(tools.some((t) => t.tool === "record_signal" && t.args?.signal === "codeword_mismatch"), "no code-word mismatch").toBe(false);
      expect(secondsToDecision(r.turns), "decides within about a minute").toBeLessThanOrEqual(60);
      const truth = scenarioById(r.scenario)?.truth;
      const rec = String(decision?.args?.recommendation);
      if (truth === "scam") expect(["block", "delay"]).toContain(rec);
      if (truth === "genuine") expect(rec).toBe("release");
    });
  }
});
