#!/usr/bin/env node
// Scans every file git would commit (tracked + untracked, not ignored) for
// secrets. Two checks:
//  1. The literal values of secrets in local env files (never printed).
//  2. Generic key patterns (Bolna, OpenAI-style, GitHub, Hugging Face, Vercel Blob, JWTs).
// Exits 1 on any hit. Run before every commit: `npm run scan:secrets`.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const ENV_FILES = [".env", ".env.local", "C:/Desktop/COLLEGE/Coding/Hackathon/NebiusXNvidia/.env"];
const secrets = [];
for (const f of ENV_FILES) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\s#]+)"?/);
    if (m && m[2].length >= 12 && /KEY|TOKEN|SECRET|PASS/i.test(m[1])) secrets.push({ name: m[1], value: m[2] });
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
];

const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|mp4|pdf)$/i.test(f));

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
