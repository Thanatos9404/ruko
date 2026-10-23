#!/usr/bin/env node
// Pushes Ruko's production environment to Vercel without ever printing a value.
// Reads .env (git-ignored), generates any missing app secrets into .env first,
// then runs `vercel env add NAME production` with the value on stdin.
//
//   node scripts/vercel-env.mjs https://ruko-symphony.vercel.app
//   node scripts/vercel-env.mjs https://ruko-symphony.vercel.app --rotate-owner   # new owner access code
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const rotateOwner = process.argv.includes("--rotate-owner");
if (!/^https:\/\//.test(base)) {
  console.error("usage: node scripts/vercel-env.mjs https://<production-host>");
  process.exit(1);
}
const path = ".env";
const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

// App secrets that only Ruko uses: generate once, keep in .env so the owner can read them locally.
const generated = [];
if (!env.RUKO_API_KEYS) {
  env.RUKO_API_KEYS = `demo-bank:rk_test_${randomBytes(18).toString("base64url")}`;
  generated.push("RUKO_API_KEYS");
}
// Access codes: one for the owner (6 calls a day) and one per judge (2 a day each), 12 random
// characters from randomBytes(9). A code is never carried over or derived from an older one.
const code = (prefix) => `${prefix}-${randomBytes(9).toString("base64url").replace(/[-_]/g, "X").toUpperCase()}`;
if (!env.RUKO_ACCESS_CODE_USER || rotateOwner) {
  env.RUKO_ACCESS_CODE_USER = code("RUKO");
  generated.push("RUKO_ACCESS_CODE_USER");
}
for (const n of [1, 2, 3]) {
  const k = `RUKO_ACCESS_CODE_JUDGE_${n}`;
  if (!env[k]) {
    env[k] = code(`JUDGE${n}`);
    generated.push(k);
  }
}
env.RUKO_ACCESS_CODES = [`${env.RUKO_ACCESS_CODE_USER}:6`, ...[1, 2, 3].map((n) => `${env[`RUKO_ACCESS_CODE_JUDGE_${n}`]}:2`)].join(",");
{
  // Rewrite .env in place: replace the combined list, append anything newly generated.
  let text = raw.replace(/^RUKO_ACCESS_CODES=.*\r?\n?/m, "");
  // A regenerated value replaces its old line rather than sitting below it.
  for (const k of generated) text = text.replace(new RegExp(`^${k}=.*\\r?\\n?`, "gm"), "");
  text = text.replace(/\s*$/, "\n");
  text += `RUKO_ACCESS_CODES=${env.RUKO_ACCESS_CODES}\n`;
  for (const k of generated) text += `${k}=${env[k]}\n`;
  writeFileSync(path, text);
}

const prod = {
  BOLNA_API_KEY: env.BOLNA_API_KEY,
  BOLNA_CHECK_AGENT_ID: env.BOLNA_CHECK_AGENT_ID,
  BOLNA_CONTACT_AGENT_ID: env.BOLNA_CONTACT_AGENT_ID,
  BOLNA_LINE_AGENT_ID: env.BOLNA_LINE_AGENT_ID,
  RUKO_TOOL_TOKEN: env.RUKO_TOOL_TOKEN,
  RUKO_WEBHOOK_TOKEN: env.RUKO_WEBHOOK_TOKEN,
  RUKO_API_KEYS: env.RUKO_API_KEYS,
  RUKO_ACCESS_CODES: env.RUKO_ACCESS_CODES,
  // Lets the server recognise the owner's scripted test runs (scripts/live-call.mjs).
  RUKO_ACCESS_CODE_USER: env.RUKO_ACCESS_CODE_USER,
  RUKO_PUBLIC_BASE_URL: base,
  RUKO_BANK_NAME: env.RUKO_BANK_NAME ?? "Demo Bank",
  RUKO_DAILY_CALL_CAP: "8",
  RUKO_PER_CODE_DAILY_CAP: "2",
  // Keeps $1.50 in reserve for a live call at the 20 Nov finale.
  RUKO_WALLET_FLOOR_CENTS: "150",
  RUKO_ALLOW_PHONE_CALLS: "false",
};

let failed = 0;
for (const [name, value] of Object.entries(prod)) {
  if (!value) {
    console.log(`skip  ${name} (no value)`);
    continue;
  }
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--yes"], { stdio: "ignore", shell: true });
  const r = spawnSync("npx", ["vercel", "env", "add", name, "production"], { input: value, stdio: ["pipe", "ignore", "pipe"], shell: true });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "set " : "FAIL"}  ${name}${ok ? "" : ` (${String(r.stderr).split("\n").filter(Boolean).pop() ?? "error"})`}`);
}
if (generated.length) console.log(`generated into .env (not printed): ${generated.join(", ")}`);
process.exit(failed ? 1 : 0);
