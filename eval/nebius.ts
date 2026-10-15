/**
 * Minimal OpenAI-compatible client for Nebius Token Factory, with an on-disk
 * response cache so a finished eval can be re-scored and re-reported for free,
 * and a seeded rerun reproduces the same transcripts.
 *
 * The key is read at runtime from the NebiusXNvidia .env (outside this repo) and
 * is never logged or written anywhere.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEBIUS_ENV_PATH } from "../server/env.js";

export const NEBIUS_BASE = "https://api.tokenfactory.nebius.com/v1/";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: "auto" | "none";
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  seed?: number;
}

export interface ChatResult {
  message: ChatMessage;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  cached: boolean;
  latency_ms: number;
}

function readKey(): string {
  if (process.env.NEBIUS_API_KEY) return process.env.NEBIUS_API_KEY;
  if (!existsSync(NEBIUS_ENV_PATH)) throw new Error(`Nebius key file not found at ${NEBIUS_ENV_PATH}`);
  const m = readFileSync(NEBIUS_ENV_PATH, "utf8").match(/^NEBIUS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) throw new Error("NEBIUS_API_KEY not found in the Nebius .env");
  return m[1].trim();
}

export class Nebius {
  private key = readKey();
  constructor(
    private cacheDir = "eval/.cache",
    private useCache = true,
  ) {}

  async chat(req: ChatRequest, attempt = 0): Promise<ChatResult> {
    const hash = createHash("sha256").update(JSON.stringify(req)).digest("hex");
    const path = join(this.cacheDir, hash.slice(0, 2), `${hash}.json`);
    if (this.useCache && existsSync(path)) {
      const hit = JSON.parse(await readFile(path, "utf8")) as ChatResult;
      return { ...hit, cached: true };
    }
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(`${NEBIUS_BASE}chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 4) {
        await sleep(2000 * 2 ** attempt);
        return this.chat(req, attempt + 1);
      }
      throw e;
    }
    clearTimeout(timer);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 5) {
        await sleep(1500 * 2 ** attempt + Math.random() * 500);
        return this.chat(req, attempt + 1);
      }
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`Nebius ${res.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text) as { choices: { message: ChatMessage }[]; usage?: ChatResult["usage"] };
    const out: ChatResult = { message: data.choices[0].message, usage: data.usage, cached: false, latency_ms: Date.now() - t0 };
    await mkdir(join(this.cacheDir, hash.slice(0, 2)), { recursive: true });
    await writeFile(path, JSON.stringify(out));
    return out;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
