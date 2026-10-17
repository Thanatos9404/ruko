import type { AppStatus, Check, CheckCreated, Lang } from "../../shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? "error");
  }
  return data as T;
}

export type { DemoScenarioView } from "../../shared/scenarios";
import type { DemoScenarioView } from "../../shared/scenarios";

export type DemoCheck = CheckCreated & { scenario: string; bank_name: string };

export interface LiveStatus {
  live: boolean;
  calls_left_today: number;
  reason?: string;
}

export interface TextCheckMatch {
  id: string;
  name: string;
  score: number;
  matched: string[];
  truth: string;
  advice: string[];
  sources: { title: string; publisher: string; url: string }[];
}

export const api = {
  scenarios: () => request<{ data: DemoScenarioView[] }>("GET", "/api/demo/scenarios"),
  pay: (scenario: string, language: Lang) => request<DemoCheck>("POST", "/api/demo/pay", { scenario, language }),
  status: (id: string, cs: string) => request<AppStatus>("GET", `/api/demo/checks/${id}`, undefined, { "X-Client-Secret": cs }),
  replay: (id: string, cs: string, tool: string, args: Record<string, unknown>) =>
    request<{ result: Record<string, unknown>; status: AppStatus }>("POST", `/api/demo/checks/${id}/replay`, { tool, args }, { "X-Client-Secret": cs }),
  liveStatus: () => request<LiveStatus>("GET", "/api/live/status"),
  verifyCode: (code: string) => request<{ valid: boolean }>("POST", "/api/live/verify", { access_code: code }),
  textCheck: (text: string, language: Lang) => request<{ method: string; matches: TextCheckMatch[] }>("POST", "/api/public/text-check", { text, language }),
  consoleOverview: () => request<ConsoleOverview>("GET", "/api/console/overview"),
  consoleChecks: (limit = 60) => request<{ data: Check[] }>("GET", `/api/console/checks?limit=${limit}`),
  consoleCheck: (id: string) => request<Check>("GET", `/api/console/checks/${id}`),
  consoleReports: () => request<{ data: { id: string; at: string; pattern_id: string; summary: string; language: string }[] }>("GET", "/api/console/reports"),
  patterns: () => request<{ data: PatternView[]; signals: { type: string; severity: string; label: string; listen_for: string }[] }>("GET", "/v1/patterns"),
};

export interface PatternView {
  id: string;
  name: { en: string; hi: string };
  summary: string;
  indicators: string[];
  typical_claims: string[];
  signals: Record<string, number>;
  keywords: string[];
  truth: Partial<Record<"en" | "hi" | "ta" | "bn" | "mr", string>>;
  advice: { en: string[]; hi: string[] };
  ask_next: { en: string; hi: string };
  sources: { title: string; publisher: string; date: string; url: string; used_for: string }[];
}

export interface ConsoleOverview {
  tenant: string;
  metrics: {
    checks: number;
    allowed: number;
    held: number;
    hold_rate: number;
    decided: number;
    released: number;
    delayed: number;
    blocked: number;
    inr_held_back: number;
    median_release_seconds: number | null;
    median_call_seconds: number | null;
    calls_with_conversation: number;
    agent_overruled: number;
    patterns: { id: string; name: string; count: number }[];
    signals: { type: string; count: number }[];
    spend_cents: number;
  };
  spend_cents_logged: number;
  live: LiveStatus;
}
