#!/usr/bin/env node
// Pushes Ruko's production environment to Vercel without ever printing a value.
// Reads .env (git-ignored), generates any missing app secrets into .env first,
// then runs `vercel env add NAME production` with the value on stdin.
//
//   node scripts/vercel-env.mjs https://ruko-symphony.vercel.app
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
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
if (!env.RUKO_ACCESS_CODES) {
  env.RUKO_ACCESS_CODES = `SYMPHONY-${randomBytes(3).toString("hex").toUpperCase()}`;
  generated.push("RUKO_ACCESS_CODES");
}
if (generated.length) {
  writeFileSync(path, raw.replace(/\s*$/, "\n") + generated.map((k) => `${k}=${env[k]}`).join("\n") + "\n");
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
  RUKO_PUBLIC_BASE_URL: base,
  RUKO_BANK_NAME: env.RUKO_BANK_NAME ?? "Demo Bank",
  RUKO_DAILY_CALL_CAP: env.RUKO_DAILY_CALL_CAP ?? "6",
  RUKO_PER_VISITOR_DAILY_CAP: env.RUKO_PER_VISITOR_DAILY_CAP ?? "2",
  RUKO_WALLET_FLOOR_CENTS: env.RUKO_WALLET_FLOOR_CENTS ?? "350",
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
