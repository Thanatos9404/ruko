import type { KV } from "../store/store.js";
import type { Config } from "../config.js";
import type { BolnaClient } from "../bolna/client.js";
import { sha256, safeEqual } from "./ids.js";

/**
 * Gate in front of every paid Bolna call. The account has a small, fixed credit
 * budget, so a public page must never be able to drain it:
 *  - an access code handed to judges (RUKO_ACCESS_CODES),
 *  - a global daily cap and a per-visitor daily cap,
 *  - a wallet floor read from GET /user/me (free) before every session.
 * When any check fails the page falls back to the recorded demo.
 */

export type GateDenied =
  | "not_configured"
  | "access_code_required"
  | "access_code_invalid"
  | "daily_cap"
  | "visitor_cap"
  | "wallet_floor"
  | "bolna_unreachable";

export interface GateResult {
  ok: boolean;
  reason?: GateDenied;
  message?: string;
  calls_left_today?: number;
}

const day = () => new Date().toISOString().slice(0, 10);

export function accessCodeValid(cfg: Config, code: string | null | undefined): boolean {
  if (!code) return false;
  return cfg.accessCodes.some((c) => safeEqual(c, code.trim()));
}

export async function gateStatus(kv: KV, cfg: Config): Promise<{ live: boolean; calls_left_today: number; reason?: GateDenied }> {
  const used = (await kv.get<number>(`cap:${day()}`)) ?? 0;
  const left = Math.max(0, cfg.dailyCallCap - used);
  if (!cfg.bolnaApiKey || !cfg.agents.check) return { live: false, calls_left_today: 0, reason: "not_configured" };
  if (!cfg.accessCodes.length) return { live: false, calls_left_today: 0, reason: "access_code_required" };
  return { live: left > 0, calls_left_today: left, reason: left > 0 ? undefined : "daily_cap" };
}

export async function checkGate(
  kv: KV,
  cfg: Config,
  bolna: BolnaClient | undefined,
  opts: { code?: string | null; visitor: string; preauthorized?: boolean },
): Promise<GateResult> {
  if (!bolna || !cfg.agents.check) return { ok: false, reason: "not_configured", message: "Live calls are not configured on this deployment." };
  if (!opts.preauthorized) {
    if (!cfg.accessCodes.length) return { ok: false, reason: "access_code_required", message: "Live calls are switched off on this deployment." };
    if (!opts.code) return { ok: false, reason: "access_code_required", message: "Enter the access code to start a live call." };
    if (!accessCodeValid(cfg, opts.code)) return { ok: false, reason: "access_code_invalid", message: "That access code isn't valid." };
  }
  const d = day();
  const used = (await kv.get<number>(`cap:${d}`)) ?? 0;
  if (used >= cfg.dailyCallCap) return { ok: false, reason: "daily_cap", message: "Today's live calls are used up. Try the recorded demo." };
  const vKey = `cap:${d}:${sha256(opts.visitor).slice(0, 16)}`;
  const vUsed = (await kv.get<number>(vKey)) ?? 0;
  if (vUsed >= cfg.perVisitorDailyCap) return { ok: false, reason: "visitor_cap", message: "You've used your live calls for today. Try the recorded demo." };
  try {
    const me = await bolna.me();
    if (typeof me.wallet === "number" && me.wallet < cfg.walletFloorCents)
      return { ok: false, reason: "wallet_floor", message: "Live calls are paused to protect the demo budget. Try the recorded demo." };
  } catch {
    return { ok: false, reason: "bolna_unreachable", message: "Couldn't reach the voice service. Try again in a moment." };
  }
  await kv.set(`cap:${d}`, used + 1, 2 * 24 * 3600);
  await kv.set(vKey, vUsed + 1, 2 * 24 * 3600);
  return { ok: true, calls_left_today: cfg.dailyCallCap - used - 1 };
}
