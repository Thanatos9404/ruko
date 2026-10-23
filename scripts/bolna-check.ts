/**
 * Drift check for Ruko's three Bolna agents. Free: one GET per agent, no call.
 * Builds each agent's config from the repo exactly as bolna:setup would, reads
 * the saved agent back from Bolna, and fails if anything that changes the call
 * differs: prompt, welcome message, models and voices, tools (descriptions,
 * parameters, fillers, URLs, token), webhook and call settings.
 * Run it before every paid call. Never prints a token or key.
 *
 *   npm run bolna:check -- https://ruko-symphony.vercel.app
 */
import { loadDotEnv } from "../server/env.js";
import { BolnaClient } from "../server/bolna/client.js";
import { checkAgentConfig, contactAgentConfig, lineAgentConfig } from "../server/bolna/agents.js";

loadDotEnv(".env");
const key = process.env.BOLNA_API_KEY;
const base = (process.argv[2] ?? process.env.RUKO_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
const toolToken = process.env.RUKO_TOOL_TOKEN;
const webhookToken = process.env.RUKO_WEBHOOK_TOKEN;
if (!key || !toolToken || !webhookToken || !/^https:\/\//.test(base)) {
  console.error("usage: npm run bolna:check -- https://<deployment>  (needs BOLNA_API_KEY, RUKO_TOOL_TOKEN, RUKO_WEBHOOK_TOKEN in .env)");
  process.exit(2);
}
const webhookUrl = `${base}/v1/bolna/webhook?token=${webhookToken}`;
const client = new BolnaClient(key);

type J = Record<string, unknown>;
const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as J)[k] : undefined), o);
const SECRET = /token|api_key|password|webhook_url/i;
const show = (path: string, v: unknown) => (SECRET.test(path) ? "(hidden)" : JSON.stringify(v)?.slice(0, 140));
const norm = (v: unknown): unknown => (v === "" || v === undefined ? null : v);
/** Key order doesn't matter: Bolna returns objects with its own key order. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as J).sort().map((k) => [k, canon((v as J)[k])])) : v;

function compare(label: string, want: J, have: J): string[] {
  const diffs: string[] = [];
  const same = (path: string, a: unknown, b: unknown) => {
    if (JSON.stringify(canon(norm(a))) !== JSON.stringify(canon(norm(b)))) diffs.push(`${label}: ${path}\n    repo:  ${show(path, a)}\n    bolna: ${show(path, b)}`);
  };
  const wa = want.agent_config as J;
  const wt = (wa.tasks as J[])[0];
  const ht = (have.tasks as J[])?.[0] ?? {};
  same("agent_name", wa.agent_name, have.agent_name);
  same("agent_welcome_message", wa.agent_welcome_message, have.agent_welcome_message);
  same("webhook_url", wa.webhook_url ?? null, have.webhook_url ?? null);
  same("system_prompt", get(want, "agent_prompts.task_1.system_prompt"), get(have, "agent_prompts.task_1.system_prompt"));
  for (const k of ["call_terminate", "hangup_after_silence", "call_hangup_message", "check_user_online_message", "trigger_user_online_message_after", "incremental_delay", "number_of_words_for_interruption", "hangup_after_LLMCall"])
    same(`task_config.${k}`, get(wt, `task_config.${k}`), get(ht, `task_config.${k}`));
  for (const k of ["llm_agent.llm_config.model", "llm_agent.llm_config.temperature", "transcriber.provider", "transcriber.model", "transcriber.language", "transcriber.endpointing", "transcriber.keywords", "synthesizer.provider", "synthesizer.provider_config.model", "synthesizer.provider_config.voice_id"])
    same(`tools_config.${k}`, get(wt, `tools_config.${k}`), get(ht, `tools_config.${k}`));
  same("multilingual.active_language", get(wt, "tools_config.multilingual_config.active_language"), get(ht, "tools_config.multilingual_config.active_language"));
  same("multilingual.language_switch_trigger", get(wt, "tools_config.multilingual_config.language_switch_trigger"), get(ht, "tools_config.multilingual_config.language_switch_trigger"));
  for (const lang of ["en", "hi"]) {
    const ml = `tools_config.multilingual_config.languages.${lang}`;
    for (const k of ["synthesizer.provider", "synthesizer.provider_config.model", "synthesizer.provider_config.voice_id", "system_prompt", "handoff_message", "agent_name"])
      same(`multilingual.${lang}.${k}`, get(wt, `${ml}.${k}`), get(ht, `${ml}.${k}`));
    // A per-language transcriber is only compared where the repo sets one (Bolna returns null otherwise).
    if (get(wt, `${ml}.transcriber`))
      for (const k of ["provider", "model", "language"]) same(`multilingual.${lang}.transcriber.${k}`, get(wt, `${ml}.transcriber.${k}`), get(ht, `${ml}.transcriber.${k}`));
  }
  const wTools = (get(wt, "tools_config.api_tools.tools") as J[]) ?? [];
  const hTools = (get(ht, "tools_config.api_tools.tools") as J[]) ?? [];
  same("tools (names)", wTools.map((t) => t.name).sort(), hTools.map((t) => t.name).sort());
  for (const w of wTools) {
    const h = hTools.find((t) => t.name === w.name) ?? {};
    same(`tool ${w.name}.description`, w.description, h.description);
    same(`tool ${w.name}.parameters`, w.parameters, h.parameters);
    same(`tool ${w.name}.pre_call_message`, w.pre_call_message ?? null, h.pre_call_message ?? null);
    const wp = get(wt, `tools_config.api_tools.tools_params.${w.name}`) as J;
    const hp = (get(ht, `tools_config.api_tools.tools_params.${w.name}`) as J) ?? {};
    same(`tool ${w.name}.url`, wp.url, hp.url);
    same(`tool ${w.name}.method`, wp.method, hp.method);
    same(`tool ${w.name}.param`, wp.param, hp.param);
    same(`tool ${w.name}.api_token`, wp.api_token, hp.api_token);
  }
  return diffs;
}

const agents = [
  { env: "BOLNA_CHECK_AGENT_ID", build: checkAgentConfig, label: "payment safety check" },
  { env: "BOLNA_CONTACT_AGENT_ID", build: contactAgentConfig, label: "trusted contact" },
  { env: "BOLNA_LINE_AGENT_ID", build: lineAgentConfig, label: "public safety line" },
];

let drift = 0;
for (const a of agents) {
  const id = process.env[a.env];
  if (!id) {
    console.log(`✗ ${a.label}: ${a.env} not set`);
    drift++;
    continue;
  }
  const want = a.build({ baseUrl: base, toolToken, webhookUrl, callTerminateSeconds: 90 }) as unknown as J;
  const have = (await client.getAgent(id)) as J;
  const diffs = compare(a.label, want, have);
  const flags = [have.restricted ? "RESTRICTED" : "unrestricted", String(have.agent_status)];
  if (diffs.length) {
    drift += diffs.length;
    console.log(`✗ ${a.label} (${flags.join(", ")}): ${diffs.length} difference(s)`);
    for (const d of diffs) console.log(`  ${d}`);
  } else console.log(`✓ ${a.label} matches the repo (${flags.join(", ")}; updated ${String(have.updated_at)})`);
  if (have.restricted) drift++;
}
const me = await client.me().catch(() => null);
console.log(`Wallet: ${me && typeof me.wallet === "number" ? me.wallet : "?"} (cents). No calls were placed.`);
process.exit(drift ? 1 : 0);
