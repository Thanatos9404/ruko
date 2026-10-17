import { existsSync, readFileSync } from "node:fs";
import { NEBIUS_ENV_PATH } from "../env.js";

/**
 * Minimal server-side client for Nebius Token Factory (OpenAI-compatible), used
 * by the free public text checker. The key comes from NEBIUS_API_KEY (set in
 * the deployment's environment) or, in local development, from the Nebius .env
 * outside this repo. It is never logged or sent to the browser.
 */
export const NEBIUS_BASE = "https://api.tokenfactory.nebius.com/v1/";

export function nebiusKey(): string | null {
  if (process.env.NEBIUS_API_KEY) return process.env.NEBIUS_API_KEY;
  if (process.env.VERCEL || process.env.NODE_ENV === "test") return null;
  try {
    if (!existsSync(NEBIUS_ENV_PATH)) return null;
    const m = readFileSync(NEBIUS_ENV_PATH, "utf8").match(/^NEBIUS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function nebiusChat(
  messages: LlmMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number; json?: boolean; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const key = nebiusKey();
  if (!key) throw new Error("NEBIUS_API_KEY not configured");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${NEBIUS_BASE}chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? "Qwen/Qwen3-30B-A3B-Instruct-2507",
        messages,
        max_tokens: opts.maxTokens ?? 450,
        temperature: opts.temperature ?? 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Nebius ${res.status}`);
    const data = JSON.parse(text) as { choices: { message: { content: string | null } }[] };
    return data.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(t);
  }
}

/**
 * Removes things a worried person might paste that identify them or someone
 * else: phone numbers, UPI IDs, emails, card/Aadhaar/account-like digit runs,
 * OTP-like codes and links. Applied before anything is sent to the LLM or stored.
 */
export function redactPII(s: string): string {
  return String(s ?? "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b[\w.-]{2,}@[a-z]{2,}\b/gi, "[upi id]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]")
    .replace(/\b\d{4,}\b/g, "[number]")
    .slice(0, 1200);
}
