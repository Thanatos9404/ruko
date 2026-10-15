/**
 * Creates or updates Ruko's three Bolna agents. Free: agent create/update/read
 * calls cost nothing; no call is placed.
 *
 *   npm run bolna:setup                       # uses RUKO_PUBLIC_BASE_URL from .env
 *   npm run bolna:setup -- https://your.app   # or pass the deployed base URL
 *
 * Writes BOLNA_*_AGENT_ID, RUKO_TOOL_TOKEN and RUKO_WEBHOOK_TOKEN to .env when
 * missing (the file is git-ignored) and never prints secret values.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { loadDotEnv } from "../server/env.js";
import { BolnaClient, BolnaError } from "../server/bolna/client.js";
import { checkAgentConfig, contactAgentConfig, lineAgentConfig } from "../server/bolna/agents.js";

loadDotEnv(".env");

function ensureSecret(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const v = randomBytes(24).toString("base64url");
  appendFileSync(".env", `\n${name}=${v}\n`);
  process.env[name] = v;
  console.log(`  generated ${name} (saved to .env)`);
  return v;
}

function saveEnv(name: string, value: string) {
  const text = readFileSync(".env", "utf8");
  if (new RegExp(`^${name}=`, "m").test(text)) return;
  appendFileSync(".env", `${name}=${value}\n`);
  process.env[name] = value;
}

const key = process.env.BOLNA_API_KEY;
if (!key) {
  console.error("BOLNA_API_KEY is not set in .env");
  process.exit(1);
}
const base = (process.argv[2] ?? process.env.RUKO_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("Pass the public https base URL (where Bolna can reach /v1/bolna/tools/*), or set RUKO_PUBLIC_BASE_URL.");
  process.exit(1);
}
const toolToken = ensureSecret("RUKO_TOOL_TOKEN");
const webhookToken = ensureSecret("RUKO_WEBHOOK_TOKEN");
const webhookUrl = `${base}/v1/bolna/webhook?token=${webhookToken}`;
const client = new BolnaClient(key);

const agents = [
  { env: "BOLNA_CHECK_AGENT_ID", build: checkAgentConfig, label: "payment safety check" },
  { env: "BOLNA_CONTACT_AGENT_ID", build: contactAgentConfig, label: "trusted contact" },
  { env: "BOLNA_LINE_AGENT_ID", build: lineAgentConfig, label: "public safety line" },
];

console.log(`Base URL: ${base}`);
for (const a of agents) {
  const body = a.build({ baseUrl: base, toolToken, webhookUrl, callTerminateSeconds: 90 });
  const existing = process.env[a.env];
  try {
    if (existing) {
      await client.updateAgent(existing, body);
      console.log(`✓ updated ${a.label} agent (${a.env})`);
    } else {
      const r = await client.createAgent(body);
      saveEnv(a.env, r.agent_id);
      console.log(`✓ created ${a.label} agent ${r.agent_id} (${a.env} saved to .env)`);
    }
    const id = process.env[a.env]!;
    const got = await client.getAgent(id);
    const flags = Object.fromEntries(
      Object.entries(got).filter(([k, v]) => /status|restrict|disallow|state|violation|flag/i.test(k) && (typeof v !== "object" || v === null)),
    );
    console.log(`  saved state: ${JSON.stringify(flags)}`);
  } catch (e) {
    if (e instanceof BolnaError) {
      console.error(`✗ ${a.label}: ${e.message}`);
      console.error(`  body: ${JSON.stringify(e.body).slice(0, 600)}`);
    } else throw e;
  }
}
const me = await client.me();
console.log(`Wallet: ${me.wallet} (cents). No calls were placed.`);
