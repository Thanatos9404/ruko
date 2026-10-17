/** Runtime configuration, read from environment variables. */
export interface Config {
  env: "production" | "development" | "test";
  baseUrl: string;
  bankName: string;
  bolnaApiKey?: string;
  agents: { check?: string; contact?: string; line?: string };
  toolToken?: string;
  webhookToken?: string;
  apiKeys: Map<string, string>; // key -> tenant
  demoTenant: string;
  accessCodes: string[];
  dailyCallCap: number;
  perVisitorDailyCap: number;
  walletFloorCents: number;
  allowPhoneCalls: boolean;
  contactWebRing: boolean;
  enforceBolnaIps: boolean;
  blobToken?: string;
  chatDailyCap: number;
  /** Public counters only count real production traffic. */
  countPublicStats: boolean;
  statsMinPerPattern: number;
}

export const BOLNA_IPS = ["13.203.39.153", "13.126.9.249", "13.202.133.53"];

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // On Vercel, only the production deployment counts as production (previews set NODE_ENV=production too).
  const mode =
    env.NODE_ENV === "test"
      ? "test"
      : env.VERCEL_ENV
        ? env.VERCEL_ENV === "production"
          ? "production"
          : "development"
        : env.NODE_ENV === "production"
          ? "production"
          : "development";
  const apiKeys = new Map<string, string>();
  for (const pair of (env.RUKO_API_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [tenant, key] = pair.split(":");
    if (tenant && key) apiKeys.set(key, tenant);
  }
  const base =
    env.RUKO_PUBLIC_BASE_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:5410");
  return {
    env: mode,
    baseUrl: base.replace(/\/$/, ""),
    bankName: env.RUKO_BANK_NAME ?? "Demo Bank",
    bolnaApiKey: env.BOLNA_API_KEY || undefined,
    agents: {
      check: env.BOLNA_CHECK_AGENT_ID || undefined,
      contact: env.BOLNA_CONTACT_AGENT_ID || undefined,
      line: env.BOLNA_LINE_AGENT_ID || undefined,
    },
    toolToken: env.RUKO_TOOL_TOKEN || undefined,
    webhookToken: env.RUKO_WEBHOOK_TOKEN || undefined,
    apiKeys,
    demoTenant: env.RUKO_DEMO_TENANT ?? "demo-bank",
    accessCodes: (env.RUKO_ACCESS_CODES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    dailyCallCap: Number(env.RUKO_DAILY_CALL_CAP ?? 12),
    perVisitorDailyCap: Number(env.RUKO_PER_VISITOR_DAILY_CAP ?? 3),
    walletFloorCents: Number(env.RUKO_WALLET_FLOOR_CENTS ?? 350),
    allowPhoneCalls: env.RUKO_ALLOW_PHONE_CALLS === "true",
    contactWebRing: env.RUKO_CONTACT_WEB_RING !== "false",
    enforceBolnaIps: env.RUKO_ENFORCE_BOLNA_IPS ? env.RUKO_ENFORCE_BOLNA_IPS === "true" : mode === "production",
    blobToken: env.BLOB_READ_WRITE_TOKEN || undefined,
    chatDailyCap: Number(env.RUKO_CHAT_DAILY_CAP ?? 800),
    countPublicStats: mode === "production" && env.RUKO_COUNT_PUBLIC_STATS !== "false",
    statsMinPerPattern: Number(env.RUKO_STATS_MIN_PER_PATTERN ?? 5),
  };
}
