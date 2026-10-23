#!/usr/bin/env node
// Scans every file git would commit (tracked + untracked, not ignored) for
// secrets. Two checks:
//  1. The literal values of secrets in local env files (never printed). List values such as
//     "tenant:key,tenant:key" or "CODE:cap,CODE:cap" are also checked part by part.
//  2. Generic key patterns (Bolna, OpenAI-style, GitHub, Hugging Face, Vercel Blob, JWTs,
//     Ruko bank keys, Tavily, Nebius-style, AWS, Slack, Google).
// Exits 1 on any hit. Run before every commit: `npm run scan:secrets` (CI runs it too).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// NEBIUS_ENV_FILE (environment, or this repo's .env) names the eval's key file outside the repo.
function envValue(file, name) {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const [k, ...rest] = line.split("=");
    if (k.trim() === name && rest.length) return rest.join("=").trim().replace(/^"|"$/g, "") || null;
  }
  return null;
}
const ENV_FILES = [".env", ".env.local", process.env.NEBIUS_ENV_FILE || envValue(".env", "NEBIUS_ENV_FILE")].filter(Boolean);

const secrets = [];
for (const f of ENV_FILES) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\s#]+)"?/);
    if (!m || !/KEY|TOKEN|SECRET|PASS|ACCESS_CODE/i.test(m[1])) continue;
    for (const value of new Set([m[2], ...m[2].split(/[,:]/)])) if (value.length >= 12) secrets.push({ name: m[1], value });
  }
}

const PATTERNS = [
  ["bolna key", /\bbn-[A-Za-z0-9]{20,}/],
  ["openai-style key", /\bsk-[A-Za-z0-9_-]{24,}/],
  ["github token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["huggingface token", /\bhf_[A-Za-z0-9]{30,}/],
  ["vercel blob token", /vercel_blob_rw_[A-Za-z0-9_]{20,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["ruko bank api key", /\brk_(live|test)_[A-Za-z0-9]{16,}/],
  ["tavily key", /\btvly-[A-Za-z0-9_-]{16,}/],
  ["nebius-style key", /\bv1\.[A-Za-z0-9_-]{40,}/],
  ["aws access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack token", /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ["google api key", /\bAIza[0-9A-Za-z_-]{35}\b/],
];

const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|mp4|mp3|pdf)$/i.test(f));

let hits = 0;
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const s of secrets) {
    if (text.includes(s.value)) {
      console.error(`SECRET VALUE of ${s.name} found in ${f}`);
      hits++;
    }
  }
  for (const [name, re] of PATTERNS) {
    if (re.test(text) && !/secret-scan\.mjs$/.test(f)) {
      console.error(`Pattern "${name}" matched in ${f}`);
      hits++;
    }
  }
}
if (hits) {
  console.error(`\n${hits} potential secret(s) found. Nothing should be committed until this is clean.`);
  process.exit(1);
}
console.log(`secret-scan: ${files.length} files clean (${secrets.length} local secret values checked, never printed).`);
