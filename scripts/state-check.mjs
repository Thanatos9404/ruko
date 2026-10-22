#!/usr/bin/env node
// Proves state survives across serverless instances: create a held check, then
// read it back with many concurrent requests (which Vercel spreads over several
// function instances), resolve it through the replay tool path, and read again.
// Reads the bank API key from .env; never prints it.
//
//   node scripts/state-check.mjs https://ruko-symphony.vercel.app
import { readFileSync } from "node:fs";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const key = (env.RUKO_API_KEYS ?? "").split(",")[0]?.split(":")[1];
if (!base || !key) throw new Error("usage: node scripts/state-check.mjs <base-url> (needs RUKO_API_KEYS in .env)");

const post = (path, body, headers = {}) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

const created = await (
  await post(
    "/v1/checks",
    {
      payment: { amount_inr: 190000, rail: "IMPS", payee: { name: "Safe Custody Account RBI", handle: "XXXXXXXX4417", is_new: true, prior_payments: 0 }, initiated_via: "manual", initiated_at: new Date().toISOString(), timezone: "Asia/Kolkata" },
      customer: { customer_ref: "state-check", name: "Kamla", language: "en", phone_e164: "+447700900199", digital_tenure_days: 200, avg_amount_90d: 3000, max_amount_90d: 12000 },
      device: { active_call: true, active_call_minutes: 40, caller_in_contacts: false },
      mode: "demo",
    },
    { Authorization: `Bearer ${key}`, "Idempotency-Key": `state-check-${Date.now()}` },
  )
).json();
if (!created.id) throw new Error(`create failed: ${JSON.stringify(created).slice(0, 200)}`);
console.log(`created ${created.id} action=${created.action}`);

async function readMany(n) {
  const rs = await Promise.all(
    Array.from({ length: n }, () => fetch(`${base}/v1/checks/${created.id}/app-status`, { headers: { "X-Client-Secret": created.client_secret } }).then(async (r) => ({ status: r.status, body: r.ok ? await r.json() : null }))),
  );
  const ok = rs.filter((r) => r.status === 200);
  return { n, ok: ok.length, statuses: [...new Set(ok.map((r) => r.body.status))], decisions: [...new Set(ok.map((r) => r.body.decision?.outcome ?? "none"))] };
}

const first = await readMany(40);
console.log(`40 parallel reads: ${first.ok}/40 found, status ${first.statuses.join("/")}`);

// Resolve through the same engine path the recorded demo uses.
const replay = (tool, args) => post(`/api/demo/checks/${created.id}/replay`, { tool, args }, { "X-Client-Secret": created.client_secret });
await replay("get_check_context", {});
await replay("record_signal", { signal: "authority_threat", evidence: "caller says he is from CBI", confidence: "high", pattern_hint: "digital_arrest" });
await replay("record_signal", { signal: "coached_on_call", evidence: "still on video call with him", confidence: "high", pattern_hint: "digital_arrest" });
await replay("set_decision", { recommendation: "block", reason: "digital arrest script" });

const second = await readMany(40);
console.log(`40 parallel reads after the decision: ${second.ok}/40 found, decision ${second.decisions.join("/")}`);
const pass = first.ok === 40 && second.ok === 40 && second.decisions.length === 1 && second.decisions[0] !== "none";
console.log(pass ? "PASS state is shared across instances" : "FAIL state diverged across instances");
process.exit(pass ? 0 : 1);
