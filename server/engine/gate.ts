import type { KV } from "../store/store.js";
import type { Config } from "../config.js";
import type { BolnaClient } from "../bolna/client.js";
import { sha256, safeEqual } from "./ids.js";

/**
 * Gate in front of every paid Bolna call. The account has a small, fixed credit
 * budget, so a public page must never be able to drain it:
 *  - an access code handed to judges (RUKO_ACCESS_CODES),
 *  - a global daily cap and a daily cap per access code (not per IP: judges at
 *    one venue share a NAT, so an IP cap would lock the second judge out),
 *  - a wallet floor read from GET /user/me (free) before every session.
 *
 * A slot is reserved when a session is minted and refunded if the call never
 * connects (failed mic, network, Bolna at capacity), so a failed attempt costs
 * nothing. The trusted-contact call that belongs to an authorised demo is exempt
 * from the caps but still respects the wallet floor.
 */

export type GateDenied =
  | "not_configured"
  | "access_code_required"
  | "access_code_invalid"
  | "daily_cap"
  | "code_cap"
  | "wallet_floor"
  | "bolna_unreachable";

export type GateKind = "customer" | "contact" | "line";

/** Counters a reservation touched, so it can be refunded exactly. */
export interface Slot {
  day: string;
  codeKey: string | null;
}

export interface GateResult {
  ok: boolean;
  reason?: GateDenied;
  message?: string;
  calls_left_today?: number;
  /** Wallet in cents from the same /user/me read (so the mint doesn't read it twice). */
  wallet?: number | null;
  slot?: Slot | null;
}

const day = () => new Date().toISOString().slice(0, 10);
const TTL = 2 * 24 * 3600;

export function accessCodeValid(cfg: Config, code: string | null | undefined): boolean {
  if (!code) return false;
  return cfg.accessCodes.some((c) => safeEqual(c, code.trim()));
}

const codeKey = (d: string, code: string) => `cap:${d}:code:${sha256(code.trim()).slice(0, 16)}`;

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
  opts: { code?: string | null; kind?: GateKind; preauthorized?: boolean },
): Promise<GateResult> {
  const kind = opts.kind ?? "customer";
  if (!bolna || !cfg.agents.check) return { ok: false, reason: "not_configured", message: "Live calls are not configured on this deployment." };
  if (kind === "contact") {
    if (!opts.preauthorized) return { ok: false, reason: "access_code_required", message: "The contact call belongs to an authorised live demo." };
  } else if (!opts.preauthorized) {
    if (!cfg.accessCodes.length) return { ok: false, reason: "access_code_required", message: "Live calls are switched off on this deployment." };
    if (!opts.code) return { ok: false, reason: "access_code_required", message: "Enter the access code to start a live call." };
    if (!accessCodeValid(cfg, opts.code)) return { ok: false, reason: "access_code_invalid", message: "That access code isn't valid." };
  }
  const d = day();
  const used = (await kv.get<number>(`cap:${d}`)) ?? 0;
  const cKey = kind !== "contact" && opts.code ? codeKey(d, opts.code) : null;
  if (kind !== "contact") {
    if (used >= cfg.dailyCallCap) return { ok: false, reason: "daily_cap", message: "Today's live calls are used up. Watch the recorded run instead." };
    if (cKey && ((await kv.get<number>(cKey)) ?? 0) >= cfg.perCodeDailyCap)
      return { ok: false, reason: "code_cap", message: "This access code has used today's live calls. Watch the recorded run instead." };
  }
  let wallet: number | null = null;
  try {
    const me = await bolna.me();
    wallet = typeof me.wallet === "number" ? me.wallet : null;
    if (wallet !== null && wallet < cfg.walletFloorCents)
      return { ok: false, reason: "wallet_floor", message: "Live calls are paused to protect the demo budget. Watch the recorded run instead.", wallet };
  } catch {
    return { ok: false, reason: "bolna_unreachable", message: "Couldn't reach the voice service. Try again in a moment, or watch the recorded run." };
  }
  if (kind === "contact") return { ok: true, wallet, slot: null, calls_left_today: Math.max(0, cfg.dailyCallCap - used) };
  // Reserve the slot now; it is refunded if the call never connects.
  await kv.set(`cap:${d}`, used + 1, TTL);
  if (cKey) await kv.set(cKey, ((await kv.get<number>(cKey)) ?? 0) + 1, TTL);
  return { ok: true, wallet, slot: { day: d, codeKey: cKey }, calls_left_today: cfg.dailyCallCap - used - 1 };
}

/** Remembers which counters a minted session reserved, until the call connects or fails. */
export async function holdSlot(kv: KV, runId: string, slot: Slot | null | undefined): Promise<void> {
  if (slot) await kv.set(`slot:${runId}`, slot, 6 * 3600);
}

/** The call connected: the slot is spent for good. */
export async function confirmSlot(kv: KV, runId: string): Promise<void> {
  await kv.delete(`slot:${runId}`);
}

/** Gives back a slot that never turned into a call. Safe to call twice. */
export async function refundSlot(kv: KV, slotOrRunId: Slot | string | null | undefined): Promise<boolean> {
  if (!slotOrRunId) return false;
  let slot: Slot | null;
  if (typeof slotOrRunId === "string") {
    slot = await kv.get<Slot>(`slot:${slotOrRunId}`);
    if (!slot) return false;
    await kv.delete(`slot:${slotOrRunId}`);
  } else slot = slotOrRunId;
  const dec = async (key: string) => {
    const n = (await kv.get<number>(key)) ?? 0;
    if (n > 0) await kv.set(key, n - 1, TTL);
  };
  await dec(`cap:${slot.day}`);
  if (slot.codeKey) await dec(slot.codeKey);
  return true;
}
