/**
 * Thin client for the Bolna REST API (https://api.bolna.ai). Only the calls Ruko
 * needs. Shapes follow the public docs (llms-full.txt, AGENTS.md, Oct 2026):
 *  - POST /v2/agent returns 201 { agent_id, state }
 *  - PUT  /v2/agent/{id} replaces the whole agent
 *  - POST /call returns { execution_id, status: "queued" }
 *  - GET  /executions/{id} returns the execution payload
 *  - POST /web-call/session mints a short-lived, single-use browser call session
 *
 * The API key stays on the server. Nothing here is ever bundled for the browser.
 */

export interface BolnaUser {
  id: string;
  name?: string;
  email?: string;
  wallet: number;
  concurrency?: { max?: number; current?: number } | number;
}

export interface BolnaExecution {
  id: string;
  agent_id: string;
  status: string;
  conversation_duration?: number | null;
  transcript?: string | null;
  summary?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at?: string;
  initiated_at?: string;
  updated_at?: string;
  error_message?: string | null;
  total_cost?: number | null;
  telephony_data?: {
    duration?: number;
    to_number?: string;
    from_number?: string;
    recording_url?: string | null;
    call_type?: string;
    provider?: string;
    hangup_by?: string;
    hangup_reason?: string;
  } | null;
  context_details?: {
    recipient_phone_number?: string;
    recipient_data?: Record<string, unknown>;
  } | null;
}

export interface WebCallSession {
  run_id: string;
  agent_id: string;
  sip_username: string;
  sip_password: string;
  sip_domain: string;
  wss_url: string;
  sip_register: boolean;
  expires_in: number;
  ice_servers: unknown[];
}

export class BolnaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export const TERMINAL_STATUSES = new Set([
  "completed",
  "no-answer",
  "busy",
  "failed",
  "canceled",
  "stopped",
  "error",
  "balance-low",
]);

export class BolnaClient {
  constructor(
    private apiKey: string,
    private baseUrl = "https://api.bolna.ai",
    private fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("BOLNA_API_KEY is not set");
  }

  private async req<T>(method: string, path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* keep text */
      }
      if (!res.ok) {
        const msg =
          typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : text.slice(0, 300);
        throw new BolnaError(`Bolna ${method} ${path} failed (${res.status}): ${msg}`, res.status, data);
      }
      return data as T;
    } finally {
      clearTimeout(t);
    }
  }

  /** Free. Wallet balance and concurrency. */
  me(): Promise<BolnaUser> {
    return this.req("GET", "/user/me");
  }

  /** Free. */
  listAgents(): Promise<unknown[]> {
    return this.req("GET", "/v2/agent/all");
  }

  /** Free. */
  getAgent(agentId: string): Promise<Record<string, unknown>> {
    return this.req("GET", `/v2/agent/${encodeURIComponent(agentId)}`);
  }

  /** Free. */
  createAgent(body: unknown): Promise<{ agent_id: string; state: string; version_id?: string }> {
    return this.req("POST", "/v2/agent", body);
  }

  /** Free. PUT replaces the whole agent config. */
  updateAgent(agentId: string, body: unknown): Promise<unknown> {
    return this.req("PUT", `/v2/agent/${encodeURIComponent(agentId)}`, body);
  }

  /** Free. TTS providers and models for a language. */
  ttsProviders(language: string): Promise<unknown> {
    return this.req("GET", `/api/v1/voice-config/tts?language=${encodeURIComponent(language)}`);
  }

  /** Free. Voices for a provider + model. */
  ttsVoices(language: string, providerId: string, modelId: string): Promise<unknown> {
    const q = new URLSearchParams({ language, provider_id: providerId, model_id: modelId, page: "1", page_size: "100" });
    return this.req("GET", `/api/v1/voice-config/tts/voices?${q}`);
  }

  /** Free. */
  getExecution(executionId: string): Promise<BolnaExecution> {
    return this.req("GET", `/executions/${encodeURIComponent(executionId)}`);
  }

  /**
   * PAID: places a phone call (telephony + per-minute). Ruko keeps phone calls
   * behind RUKO_ALLOW_PHONE_CALLS so a demo can never dial by accident.
   */
  makeCall(input: {
    agent_id: string;
    recipient_phone_number: string;
    user_data?: Record<string, unknown>;
    agent_data?: { language?: string };
  }): Promise<{ execution_id: string; status: string; message?: string }> {
    return this.req("POST", "/call", { ...input, bypass_call_guardrails: true });
  }

  /**
   * Mints a single-use browser call session (~120 s TTL). The call itself is
   * PAID per minute once the browser connects. The SDK's type comments name
   * /web-call/freeswitch-session while the docs name /web-call/session, so we
   * try the documented path first and fall back on 404.
   */
  async mintWebSession(input: {
    agent_id: string;
    user_data?: Record<string, unknown>;
    agent_data?: { language?: string };
  }): Promise<WebCallSession> {
    try {
      return await this.req("POST", "/web-call/session", input);
    } catch (e) {
      if (e instanceof BolnaError && e.status === 404) return this.req("POST", "/web-call/freeswitch-session", input);
      throw e;
    }
  }
}

/** Parse Bolna's "assistant: ...\nuser: ..." transcript into turns. */
export function parseTranscript(t: string | null | undefined): { role: "agent" | "customer"; text: string }[] {
  if (!t) return [];
  const turns: { role: "agent" | "customer"; text: string }[] = [];
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(assistant|user|agent|bot|human)\s*:\s*(.*)$/i);
    if (m) {
      const role = /^(assistant|agent|bot)$/i.test(m[1]) ? "agent" : "customer";
      turns.push({ role, text: m[2] });
    } else if (turns.length) {
      turns[turns.length - 1].text += ` ${line}`;
    }
  }
  return turns;
}
