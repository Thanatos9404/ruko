/**
 * Pulls one Bolna execution after a live call (free: GET /executions/{id} and /user/me)
 * and saves what we publish as proof: status, duration, cost, transcript and the
 * recording URL. Prints a short summary; never prints a key.
 *
 *   npx tsx scripts/bolna-execution.ts <run_id> [label]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadDotEnv } from "../server/env.js";
import { BolnaClient } from "../server/bolna/client.js";

loadDotEnv(".env");
const id = process.argv[2];
const label = process.argv[3] ?? "call";
if (!id || !process.env.BOLNA_API_KEY) {
  console.error("usage: npx tsx scripts/bolna-execution.ts <run_id> [label]");
  process.exit(2);
}
const c = new BolnaClient(process.env.BOLNA_API_KEY);
const ex = (await c.getExecution(id)) as unknown as Record<string, unknown>;
const me = await c.me().catch(() => null);
const t = (ex.telephony_data ?? {}) as Record<string, unknown>;
const out = {
  id,
  status: ex.status,
  agent_id: ex.agent_id,
  created_at: ex.created_at,
  conversation_duration: ex.conversation_duration,
  total_cost: ex.total_cost,
  cost_breakdown: ex.cost_breakdown ?? null,
  recording_url: (t.recording_url as string) ?? (ex.recording_url as string) ?? null,
  hangup_reason: t.hangup_reason ?? null,
  transcript: ex.transcript ?? null,
  wallet_after: me && typeof me.wallet === "number" ? me.wallet : null,
};
mkdirSync(".data/live", { recursive: true });
writeFileSync(`.data/live/execution-${label}-${id}.json`, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify({ ...out, transcript: typeof out.transcript === "string" ? `${out.transcript.length} chars` : out.transcript, recording_url: out.recording_url ? "present" : "none" }, null, 1),
);
