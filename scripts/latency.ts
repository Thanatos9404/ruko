/**
 * Measures the latency of Ruko's tool endpoints as Bolna would call them
 * (HTTPS POST with the tool bearer token), over a realistic sequence per check:
 * get_check_context, record_signal ×2, set_decision.
 *
 *   npx tsx scripts/latency.ts http://localhost:5410 30
 *   npx tsx scripts/latency.ts https://your-app.vercel.app 30
 *
 * Writes eval/results/tool-latency.json. Free: never touches Bolna.
 */
import { writeFile } from "node:fs/promises";
import { loadDotEnv } from "../server/env.js";

loadDotEnv(".env");
const base = (process.argv[2] ?? "http://localhost:5410").replace(/\/$/, "");
const checks = Number(process.argv[3] ?? 30);
const token = process.env.RUKO_TOOL_TOKEN;
if (!token) throw new Error("RUKO_TOOL_TOKEN missing in .env (run npm run bolna:setup)");

const times: Record<string, number[]> = {};
async function tool(name: string, args: Record<string, unknown>) {
  const t0 = performance.now();
  const r = await fetch(`${base}/v1/bolna/tools/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  await r.text();
  const ms = performance.now() - t0;
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  (times[name] ??= []).push(ms);
}

for (let i = 0; i < checks; i++) {
  const r = await fetch(`${base}/api/demo/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: "digital-arrest", language: "en" }) });
  const c = (await r.json()) as { id: string };
  await tool("get_check_context", { check_id: c.id, execution_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` });
  await tool("record_signal", { check_id: c.id, signal: "coached_on_call", evidence: "officer on video call", confidence: "high", pattern_hint: "digital_arrest" });
  await tool("record_signal", { check_id: c.id, signal: "authority_threat", evidence: "said I would be arrested", confidence: "high", pattern_hint: "digital_arrest" });
  await tool("set_decision", { check_id: c.id, recommendation: "block", reason: "coached" });
}

const all = Object.values(times).flat().sort((a, b) => a - b);
const q = (xs: number[], p: number) => Math.round(xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]);
const out = {
  where: base.includes("localhost") ? "local dev server (Vite middleware, file store)" : base,
  measured_at: new Date().toISOString(),
  n: all.length,
  p50: q(all, 0.5),
  p95: q(all, 0.95),
  by_tool: Object.fromEntries(Object.entries(times).map(([k, v]) => [k, { n: v.length, p50: q([...v].sort((a, b) => a - b), 0.5), p95: q([...v].sort((a, b) => a - b), 0.95) }])),
};
await writeFile("eval/results/tool-latency.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
