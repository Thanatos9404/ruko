/**
 * Text-mode evaluation of Ruko's voice agent and decision policy.
 *
 *   npm run eval                       # all 96 scenarios
 *   npm run eval -- --limit 6          # quick smoke run
 *   npm run eval -- --only scam        # one kind
 *   npm run eval -- --agent-model openai/gpt-oss-120b
 *   npm run eval -- --set holdout      # held-out stories, never used for tuning
 *   npm run eval -- --set holdout3     # third held-out set, frozen 22 Oct 2026 before any run
 *
 * Never calls Bolna. LLM calls go to Nebius Token Factory and are cached in
 * eval/.cache, so re-running with the same settings is free and reproducible.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Nebius } from "./nebius.js";
import { buildScenarios, type EvalScenario } from "./scenarios.js";
import { buildHoldout } from "./holdout.js";
import { buildHoldout2 } from "./holdout2.js";
import { buildHoldout3 } from "./holdout3.js";
import { runConversation, type ConversationResult } from "./conversation.js";
import { scoreRun } from "./score.js";
import { writeReports } from "./report.js";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  if (process.argv.includes(`--${name}`)) return "true";
  return def;
}

const opts = {
  agentModel: arg("agent-model", "Qwen/Qwen3-30B-A3B-Instruct-2507")!,
  customerModel: arg("customer-model", "deepseek-ai/DeepSeek-V4-Flash-0731")!,
  judgeModel: arg("judge-model", "openai/gpt-oss-120b")!,
  maxCustomerTurns: Number(arg("max-turns", "10")),
  seed: Number(arg("seed", "7")),
};
const limit = Number(arg("limit", "0"));
const only = arg("only");
const concurrency = Number(arg("concurrency", "4"));
const noCache = arg("no-cache") === "true";
const runId = arg("run-id", `${new Date().toISOString().slice(0, 10)}-${opts.agentModel.split("/").pop()}`)!;
const outDir = join("eval", "results", runId);

const set = arg("set", "dev");
let scenarios: EvalScenario[] =
  set === "holdout"
    ? buildHoldout()
    : set === "holdout2"
      ? buildHoldout2()
      : set === "holdout3"
        ? buildHoldout3()
        : set === "all"
          ? [...buildScenarios(), ...buildHoldout(), ...buildHoldout2(), ...buildHoldout3()]
          : set === "dev"
            ? buildScenarios()
            : (() => {
                throw new Error(`unknown --set ${set}`);
              })();
if (only) scenarios = scenarios.filter((s) => s.kind === only || s.id.includes(only));
if (limit > 0) {
  // Spread a small run across kinds and languages instead of taking the first N.
  const step = Math.max(1, Math.floor(scenarios.length / limit));
  scenarios = scenarios.filter((_, i) => i % step === 0).slice(0, limit);
}

const llm = new Nebius("eval/.cache", !noCache);
console.log(`Ruko eval ${runId}: ${scenarios.length} scenarios, agent=${opts.agentModel}, customer=${opts.customerModel}, concurrency=${concurrency}`);

const results: ConversationResult[] = [];
let next = 0;
async function worker() {
  while (next < scenarios.length) {
    const sc = scenarios[next++];
    const r = await runConversation(llm, sc, opts);
    results.push(r);
    const ok = sc.expect.includes(r.decision ?? "release");
    console.log(
      `${ok ? "✓" : "✗"} ${sc.id.padEnd(48)} ${String(r.decision).padEnd(7)} turns=${r.customer_turns} pattern=${r.pattern ?? "-"}${r.error ? ` ERR ${r.error}` : ""}`,
    );
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(concurrency, scenarios.length) }, worker));
console.log(`Conversations done in ${Math.round((Date.now() - t0) / 1000)} s`);

const ordered = scenarios.map((s) => results.find((r) => r.scenario_id === s.id)!);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "transcripts.jsonl"), ordered.map((r) => JSON.stringify(r)).join("\n") + "\n");
const summary = await scoreRun(llm, scenarios, ordered, { ...opts, runId });
await writeReports(outDir, summary, scenarios, ordered);
console.log(JSON.stringify(summary.headline, null, 2));
console.log(`Wrote ${outDir}`);
