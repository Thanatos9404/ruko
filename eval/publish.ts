/**
 * Publishes eval results for the web app and docs: a compact
 * public/eval/results.json (current version + history), the full summaries of
 * the current runs, and sample transcripts.
 *
 *   npx tsx eval/publish.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Summary, Rate } from "./score.js";
import type { ConversationResult } from "./conversation.js";
import { estimateSeconds } from "./score.js";

interface RunSpec {
  run_id: string;
  label: string;
  set: "dev" | "holdout" | "holdout2" | "holdout3" | "holdout4";
  clean_holdout: boolean;
}

const VERSION = "v5";
// Order matters: [0] is the development run, [1] the fresh held-out headline.
const CURRENT: RunSpec[] = [
  { run_id: "v5-dev-qwen3-30b", label: "Development set (96)", set: "dev", clean_holdout: false },
  { run_id: "v5-holdout4-qwen3-30b", label: "Fresh held-out set 4 (28), frozen before any v5 run, heavy coaching in Hindi/Hinglish", set: "holdout4", clean_holdout: true },
  { run_id: "v5-holdout3-qwen3-30b", label: "Held-out set 3 (28), previously seen (v4)", set: "holdout3", clean_holdout: false },
  { run_id: "v5-holdout2-qwen3-30b", label: "Held-out set 2 (28), previously seen (v3, v4)", set: "holdout2", clean_holdout: false },
  { run_id: "v5-holdout1-qwen3-30b", label: "Held-out set 1 (28), previously seen", set: "holdout", clean_holdout: false },
];
const HISTORY: RunSpec[] = [
  { run_id: "v1-qwen3-30b", label: "v1 · development set", set: "dev", clean_holdout: false },
  { run_id: "v2-dev-qwen3-30b", label: "v2 · development set", set: "dev", clean_holdout: false },
  { run_id: "v2-holdout-qwen3-30b", label: "v2 · held-out set 1 (clean for v2)", set: "holdout", clean_holdout: true },
  { run_id: "v3-dev-qwen3-30b", label: "v3 · development set", set: "dev", clean_holdout: false },
  { run_id: "v3-holdout2-qwen3-30b", label: "v3 · held-out set 2 (clean for v3)", set: "holdout2", clean_holdout: true },
  { run_id: "v3-holdout1-qwen3-30b", label: "v3 · held-out set 1 (seen while tuning)", set: "holdout", clean_holdout: false },
  { run_id: "v4-dev-qwen3-30b", label: "v4 · development set (faster; text model changed during the run)", set: "dev", clean_holdout: false },
  { run_id: "v4-holdout3-qwen3-30b", label: "v4 · held-out set 3 (clean for v4)", set: "holdout3", clean_holdout: true },
  { run_id: "v4-holdout2-qwen3-30b", label: "v4 · held-out set 2", set: "holdout2", clean_holdout: false },
  { run_id: "v4-holdout1-qwen3-30b", label: "v4 · held-out set 1", set: "holdout", clean_holdout: false },
];

const read = async (id: string) => JSON.parse(await readFile(join("eval", "results", id, "summary.json"), "utf8")) as Summary;

function compact(spec: RunSpec, s: Summary) {
  const h = s.headline;
  return {
    ...spec,
    scenarios: s.counts.scenarios,
    scam_catch: h.scam_catch_rate,
    scam_block: h.scam_block_rate,
    false_hold: h.false_hold_rate_genuine,
    ambiguous_ok: s.counts.ambiguous ? h.ambiguous_acceptable : null,
    otp_requests: h.otp_pin_requests.confirmed,
    agent_turns: h.otp_pin_requests.agent_turns,
    median_turns: h.median_customer_turns_to_decision,
    median_seconds: h.median_est_seconds_to_decision,
    median_call_seconds: h.median_est_seconds_call ?? null,
    heavy_catch: s.detail.by_coaching.heavy,
    light_catch: s.detail.by_coaching.light,
    truth_said: s.detail.truth_said_when_caught,
    e2e_scam_caught: s.end_to_end.scam_caught,
    e2e_genuine_called: s.end_to_end.genuine_called,
  };
}

function combine(rates: Rate[]): Rate {
  const k = rates.reduce((a, r) => a + r.k, 0);
  const n = rates.reduce((a, r) => a + r.n, 0);
  const z = 1.96;
  const p = n ? k / n : 0;
  const denom = 1 + (z * z) / Math.max(n, 1);
  const centre = (p + (z * z) / (2 * Math.max(n, 1))) / denom;
  const half = n ? (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom : 0;
  return { n, k, rate: p, ci95: [Math.max(0, centre - half), Math.min(1, centre + half)] };
}

const current = await Promise.all(CURRENT.map(async (c) => ({ spec: c, s: await read(c.run_id) })));
const history = await Promise.all(HISTORY.map(async (c) => ({ spec: c, s: await read(c.run_id) })));
const curCompact = current.map(({ spec, s }) => compact(spec, s));
const all = [...current, ...history];
const toolLatency = await readFile("eval/results/tool-latency.json", "utf8").then((t) => JSON.parse(t)).catch(() => null);

const results = {
  generated_at: new Date().toISOString(),
  version: VERSION,
  agent_model: current[0].s.models.agent,
  customer_model: current[0].s.models.customer,
  current: curCompact,
  history: history.map(({ spec, s }) => compact(spec, s)),
  combined_current: {
    scam_catch: combine(curCompact.map((c) => c.scam_catch)),
    false_hold: combine(curCompact.map((c) => c.false_hold)),
  },
  // The current version alone, so the safety claim is about the agent that ships.
  totals_current: {
    conversations: current.reduce((a, { s }) => a + s.counts.scenarios, 0),
    agent_turns: current.reduce((a, { s }) => a + s.headline.otp_pin_requests.agent_turns, 0),
    otp_requests: current.reduce((a, { s }) => a + s.headline.otp_pin_requests.confirmed, 0),
  },
  totals: {
    conversations: all.reduce((a, { s }) => a + s.counts.scenarios, 0),
    agent_turns: all.reduce((a, { s }) => a + s.headline.otp_pin_requests.agent_turns, 0),
    otp_requests: all.reduce((a, { s }) => a + s.headline.otp_pin_requests.confirmed, 0),
  },
  tool_latency_ms: toolLatency,
};
await mkdir("public/eval", { recursive: true });
await writeFile("public/eval/results.json", JSON.stringify(results, null, 1));
await writeFile("public/eval/summary.json", JSON.stringify(current[0].s));
await writeFile("public/eval/summary-fresh.json", JSON.stringify(current[1].s));

// Samples from the current development run and the fresh held-out run.
const samples = [];
for (const { spec } of current.slice(0, 2)) {
  const rows = (await readFile(join("eval", "results", spec.run_id, "transcripts.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l) as ConversationResult);
  const pick = (pred: (r: ConversationResult) => boolean, n: number) => rows.filter(pred).slice(0, n);
  const chosen = [
    ...pick((r) => r.scenario_id.includes("heavy") && r.decision === "block", 3),
    ...pick((r) => r.scenario_id.includes("genuine") && r.decision === "release", 2),
    ...pick((r) => r.scenario_id.includes("scam") && r.decision === "release", 2),
  ];
  for (const r of chosen)
    samples.push({
      id: r.scenario_id,
      run: spec.run_id,
      decision: r.decision,
      detected_pattern: r.pattern,
      est_seconds: estimateSeconds(r),
      turns: r.turns.map((t) => (t.role === "tool" ? { role: t.role, tool: t.tool, args: t.args } : { role: t.role, text: t.text })),
    });
}
await writeFile("public/eval/samples.json", JSON.stringify(samples));
console.log(JSON.stringify({ current: curCompact.map((c) => [c.run_id, c.scam_catch.k, c.scam_catch.n, c.false_hold.k, c.false_hold.n]), totals: results.totals, combined: results.combined_current }, null, 1));
