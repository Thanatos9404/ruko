/**
 * Builds server/data/seed-checks.json: eval conversations (current dev and fresh
 * held-out runs) replayed through the real engine in memory, as the demo bank's
 * console would have recorded them. Customers are synthetic; every check is
 * tagged origin "eval-replay".
 *
 *   npx tsx eval/seed-build.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { MemoryStore } from "../server/store/store.js";
import { CheckService, publicCheck, validateCreate } from "../server/engine/checks.js";
import { runTool, type ToolDeps } from "../server/engine/toolHandlers.js";
import { buildScenarios, type EvalScenario } from "./scenarios.js";
import { buildHoldout } from "./holdout.js";
import { buildHoldout2 } from "./holdout2.js";
import type { ConversationResult } from "./conversation.js";
import type { Check } from "../shared/types.js";

const RUNS = ["v3-dev-qwen3-30b", "v3-holdout2-qwen3-30b"];
const all = new Map<string, EvalScenario>([...buildScenarios(), ...buildHoldout(), ...buildHoldout2()].map((s) => [s.id, s]));

function pickDev(rows: ConversationResult[]): ConversationResult[] {
  // A balanced slice of the dev set: two scams per pattern (one English, one Hindi/Hinglish), all ambiguous, and genuine payments.
  const out: ConversationResult[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const sc = all.get(r.scenario_id)!;
    if (sc.kind === "scam") {
      const n = seen.get(sc.pattern!) ?? 0;
      if (n < 2 && ((n === 0 && sc.style === "en") || (n === 1 && sc.style !== "en"))) {
        out.push(r);
        seen.set(sc.pattern!, n + 1);
      }
    } else if (sc.kind === "ambiguous" || sc.style !== "hinglish") out.push(r);
  }
  return out;
}

const kv = new MemoryStore();
const checks = new CheckService(kv);
const deps: ToolDeps = { checks, kv, contact: { dial: async () => ({ status: "simulated", channel: "text-eval" }) } };
const ids: string[] = [];

for (const run of RUNS) {
  const rows = (await readFile(join("eval", "results", run, "transcripts.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l) as ConversationResult);
  const chosen = run.includes("dev") ? pickDev(rows) : rows;
  for (const r of chosen) {
    const sc = all.get(r.scenario_id);
    if (!sc) continue;
    const input = validateCreate({ payment: { ...sc.payment, initiated_at: new Date().toISOString() }, customer: sc.customer, device: sc.device, mode: "eval", origin: "eval-replay" });
    const { check } = await checks.create("demo-bank", input);
    ids.push(check.id);
    if (check.risk.action !== "hold") continue; // the pre-call policy let it through: no call, no friction
    const transcript = r.turns.filter((t) => t.role !== "tool").map((t) => ({ role: t.role as "agent" | "customer", text: t.text }));
    await checks.attachCall(check.id, { channel: "text-eval", status: "in-progress", started_at: new Date().toISOString() });
    let decided = false;
    for (const t of r.turns) {
      if (t.role !== "tool" || !t.tool) continue;
      if (!["get_check_context", "record_signal", "call_trusted_contact", "set_decision"].includes(t.tool)) continue;
      await runTool(deps, t.tool, { ...(t.args ?? {}), check_id: check.id, execution_id: undefined });
      if (t.tool === "set_decision") decided = true;
    }
    await checks.attachCall(check.id, { channel: "text-eval", status: "completed", ended_at: new Date().toISOString(), transcript });
    if (!decided) await checks.finalize(check.id, { reason: "call ended without set_decision" });
  }
}

const list: Check[] = [];
for (const id of ids) list.push(publicCheck(await checks.require(id)));
await mkdir("server/data", { recursive: true });
await writeFile(
  "server/data/seed-checks.json",
  JSON.stringify({ version: `v3-${list.length}`, note: "Eval conversations (synthetic customers) replayed through the real engine. Not real customers.", checks: list }),
);
const by = (f: (c: (typeof list)[number]) => string) => list.reduce<Record<string, number>>((a, c) => ((a[f(c)] = (a[f(c)] ?? 0) + 1), a), {});
console.log(`seed: ${list.length} checks`, by((c) => (c.risk.action === "allow" ? "allowed" : c.decision?.outcome ?? "undecided")));
