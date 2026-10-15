import { createApp } from "../server/app.js";
import { loadConfig, type Config } from "../server/config.js";
import { MemoryStore } from "../server/store/store.js";
import { BolnaClient } from "../server/bolna/client.js";
import type { CustomerProfile, PaymentContext, DeviceSignals } from "../shared/types.js";

export const API_KEY = "rk_test_bank_a_key_0001";
export const API_KEY_B = "rk_test_bank_b_key_0002";
export const TOOL_TOKEN = "tooltoken_test_123456";
export const WEBHOOK_TOKEN = "whtoken_test_123456";

export function testConfig(over: Partial<Config> = {}): Config {
  const base = loadConfig({
    NODE_ENV: "test",
    RUKO_API_KEYS: `bank-a:${API_KEY},bank-b:${API_KEY_B}`,
    RUKO_TOOL_TOKEN: TOOL_TOKEN,
    RUKO_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
    RUKO_ACCESS_CODES: "JUDGE-2026",
    RUKO_PUBLIC_BASE_URL: "https://ruko.test",
  });
  return { ...base, ...over };
}

/** A fake Bolna API: records requests and answers from a route table. */
export function fakeBolna(routes: Record<string, (body: unknown) => unknown>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    const key = `${method} ${url.pathname}`;
    const h = routes[key];
    if (!h) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    const out = h(body);
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { client: new BolnaClient("bn-test", "https://api.bolna.test", fetchImpl), calls };
}

export function makeApp(over: Partial<Config> = {}, bolna?: BolnaClient) {
  const kv = new MemoryStore();
  return createApp({ kv, config: testConfig(over), bolna, defer: () => {} });
}

export const payment = (over: Partial<PaymentContext> = {}): PaymentContext => ({
  amount_inr: 1_90_000,
  rail: "IMPS",
  payee: { name: "Safe Custody Account RBI", handle: "XXXXXXXX4417", is_new: true, prior_payments: 0 },
  initiated_via: "manual",
  initiated_at: "2026-10-16T08:30:00.000Z",
  timezone: "Asia/Kolkata",
  ...over,
});

export const customer = (over: Partial<CustomerProfile> = {}): CustomerProfile => ({
  customer_ref: "cust-test-1",
  name: "Kamla",
  language: "hi",
  phone_e164: "+447700900101",
  digital_tenure_days: 210,
  avg_amount_90d: 3_200,
  max_amount_90d: 12_000,
  trusted_contact: { name: "Ravi", relation: "son", phone_e164: "+447700900102", consent_on_file: true },
  ...over,
});

export const device = (over: Partial<DeviceSignals> = {}): DeviceSignals => ({ active_call: true, active_call_minutes: 47, caller_in_contacts: false, ...over });

export function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://ruko.test${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const bank = (key = API_KEY) => ({ Authorization: `Bearer ${key}` });
export const tool = () => ({ Authorization: `Bearer ${TOOL_TOKEN}` });
