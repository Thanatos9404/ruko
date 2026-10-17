import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationResult } from "./conversation.js";
import type { EvalScenario } from "./scenarios.js";
import { estimateSeconds, type Rate, type Summary } from "./score.js";

const pct = (r: Rate) => `${(r.rate * 100).toFixed(1)}% (${r.k}/${r.n}; 95% CI ${(r.ci95[0] * 100).toFixed(0)}–${(r.ci95[1] * 100).toFixed(0)}%)`;

export async function writeReports(outDir: string, s: Summary, scenarios: EvalScenario[], results: ConversationResult[]) {
  await writeFile(join(outDir, "summary.json"), JSON.stringify(s, null, 2));
  const h = s.headline;
  const lines = [
    `# Ruko eval: ${s.run_id}`,
    "",
    `Generated ${s.generated_at}. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.`,
    "",
    `- Agent model (stand-in for Bolna's gpt-4.1-mini): \`${s.models.agent}\``,
    `- Customer simulator: \`${s.models.customer}\``,
    `- OTP/PIN judge: \`${s.models.judge}\``,
    `- Scenarios: ${s.counts.scenarios} (${s.counts.scam} scam, ${s.counts.genuine} genuine, ${s.counts.ambiguous} ambiguous); max ${s.settings.max_customer_turns} customer turns; seed ${s.settings.seed}`,
    "",
    "## Headline (every scenario gets a call)",
    "",
    "| Metric | Result |",
    "|---|---|",
    `| Scam catch rate (delay or block) | ${pct(h.scam_catch_rate)} |`,
    `| Scams blocked outright | ${pct(h.scam_block_rate)} |`,
    `| False holds on genuine payments | ${pct(h.false_hold_rate_genuine)} |`,
    `| Ambiguous cases handled acceptably | ${pct(h.ambiguous_acceptable)} |`,
    `| Agent asked for OTP / PIN / card / account details | ${h.otp_pin_requests.confirmed} of ${h.otp_pin_requests.agent_turns} agent turns (${h.otp_pin_requests.candidates} mentions checked by the judge) |`,
    `| Median customer turns to decision | ${h.median_customer_turns_to_decision ?? "n/a"} |`,
    `| Median estimated seconds to decision | ${h.median_est_seconds_to_decision ?? "n/a"} (estimated from transcript length, not measured on calls) |`,
    `| Agent called set_decision | ${pct(h.set_decision_called)} |`,
    "",
    "## End to end (pre-call policy in front)",
    "",
    s.end_to_end.note,
    "",
    `- Scams caught: ${pct(s.end_to_end.scam_caught)}; scams the pre-call policy let through without a call: ${s.end_to_end.scam_missed_by_precall}`,
    `- Genuine payments that got a call: ${pct(s.end_to_end.genuine_called)}`,
    `- Genuine payments that ended delayed or blocked: ${pct(s.end_to_end.genuine_ended_held)}`,
    "",
    "## Breakdown",
    "",
    "| Language style | Scam catch | False hold |",
    "|---|---|---|",
    ...Object.entries(s.detail.by_style).map(([k, v]) => `| ${k} | ${pct(v.catch)} | ${pct(v.false_hold)} |`),
    "",
    `- Lightly coached victims caught: ${pct(s.detail.by_coaching.light)}`,
    `- Heavily coached victims (cover story, deny the call) caught: ${pct(s.detail.by_coaching.heavy)}`,
    `- Pattern named correctly (when caught): ${pct(s.detail.pattern_named_correctly)}`,
    `- Agent said the official 'truth' sentence (when caught): ${pct(s.detail.truth_said_when_caught)}`,
    `- Trusted contact requested with consent (scams with a contact on file): ${pct(s.detail.contact_requested_in_scams_with_contact)}`,
    `- Decisions where the policy was stricter than the agent: ${s.detail.policy_stricter_than_agent} (agent said "release" on ${s.detail.agent_said_release_on_caught_scam} scams the policy still held)`,
    `- Customers who started reading out a code: ${s.detail.otp_offer_scenarios.length}${s.detail.otp_offer_scenarios.length ? `; the agent's next turn told them to stop in ${s.detail.otp_offer_scenarios.filter((o) => o.stopped).length}` : " (the agent never asked, so coached customers had no opening)"}`,
    `- Errors: ${s.detail.errors}; LLM calls: ${s.detail.llm_calls}; tokens: ${s.detail.tokens.prompt} prompt / ${s.detail.tokens.completion} completion`,
    "",
    "| Pattern | Catch | Named correctly |",
    "|---|---|---|",
    ...Object.entries(s.detail.by_pattern).map(([k, v]) => `| ${k} | ${pct(v.catch)} | ${pct(v.named_correctly)} |`),
    "",
    "## Misses and false holds",
    "",
    ...(s.failures.length ? s.failures.map((f) => `- \`${f.scenario}\`: expected ${f.expected.join("/")}, got ${f.got}. ${f.why}`) : ["None."]),
    "",
  ];
  await writeFile(join(outDir, "report.md"), lines.join("\n"));

  // Public copies for the web app: the summary and a handful of transcripts.
  await mkdir("public/eval", { recursive: true });
  await writeFile("public/eval/summary.json", JSON.stringify(s));
  const pick = (pred: (sc: EvalScenario, r: ConversationResult) => boolean, n: number) =>
    scenarios
      .map((sc, i) => ({ sc, r: results[i] }))
      .filter(({ sc, r }) => pred(sc, r))
      .slice(0, n);
  const samples = [
    ...pick((sc, r) => sc.kind === "scam" && sc.coaching === "heavy" && r.decision === "block", 4),
    ...pick((sc, r) => sc.kind === "genuine" && r.decision === "release", 3),
    ...pick((sc, r) => !sc.expect.includes(r.decision ?? "release"), 3),
  ].map(({ sc, r }) => ({
    id: sc.id,
    kind: sc.kind,
    style: sc.style,
    pattern: sc.pattern ?? null,
    expected: sc.expect,
    decision: r.decision,
    detected_pattern: r.pattern,
    est_seconds: estimateSeconds(r),
    turns: r.turns.map((t) => (t.role === "tool" ? { role: t.role, tool: t.tool, args: t.args } : { role: t.role, text: t.text })),
  }));
  await writeFile("public/eval/samples.json", JSON.stringify(samples));
}

/** Re-score from saved transcripts without new conversations: `npm run eval:report -- <run-id>`. */
if (process.argv[1]?.endsWith("report.ts")) {
  const runId = process.argv[2];
  if (!runId) {
    console.error("usage: npm run eval:report -- <run-id>");
    process.exit(1);
  }
  const { buildScenarios } = await import("./scenarios.js");
  const { scoreRun } = await import("./score.js");
  const { Nebius } = await import("./nebius.js");
  const dir = join("eval", "results", runId);
  const results = (await readFile(join(dir, "transcripts.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l) as ConversationResult);
  const { buildHoldout } = await import("./holdout.js");
  const { buildHoldout2 } = await import("./holdout2.js");
  const all = [...buildScenarios(), ...buildHoldout(), ...buildHoldout2()];
  const scenarios = results.map((r) => all.find((s) => s.id === r.scenario_id)!);
  const prev = JSON.parse(await readFile(join(dir, "summary.json"), "utf8")) as Summary;
  const summary = await scoreRun(new Nebius(), scenarios, results, {
    agentModel: prev.models.agent,
    customerModel: prev.models.customer,
    judgeModel: prev.models.judge,
    maxCustomerTurns: prev.settings.max_customer_turns,
    seed: prev.settings.seed,
    runId,
  });
  await writeReports(dir, summary, scenarios, results);
  console.log(`Re-scored ${runId}`);
}
