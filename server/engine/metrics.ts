import type { Check } from "../../shared/types.js";

export interface Metrics {
  checks: number;
  allowed: number;
  held: number;
  hold_rate: number;
  decided: number;
  released: number;
  delayed: number;
  blocked: number;
  /** Rupees in payments the check stopped or delayed. */
  inr_held_back: number;
  /** Median seconds from hold to decision for payments that were released (the friction a genuine payer felt). */
  median_release_seconds: number | null;
  median_call_seconds: number | null;
  calls_with_conversation: number;
  agent_overruled: number;
  patterns: { id: string; name: string; count: number }[];
  signals: { type: string; count: number }[];
  spend_cents: number;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function computeMetrics(checks: Check[]): Metrics {
  const held = checks.filter((c) => c.risk.action === "hold");
  const decided = held.filter((c) => c.decision);
  const by = (o: string) => decided.filter((c) => c.decision!.outcome === o);
  const released = by("release");
  const stopped = decided.filter((c) => c.decision!.outcome !== "release");
  const patterns = new Map<string, { id: string; name: string; count: number }>();
  const signals = new Map<string, number>();
  for (const c of decided) {
    const p = c.decision!.pattern;
    if (p) patterns.set(p.id, { ...p, count: (patterns.get(p.id)?.count ?? 0) + 1 });
  }
  for (const c of held) for (const s of c.signals) signals.set(s.type, (signals.get(s.type) ?? 0) + 1);
  return {
    checks: checks.length,
    allowed: checks.length - held.length,
    held: held.length,
    hold_rate: checks.length ? held.length / checks.length : 0,
    decided: decided.length,
    released: released.length,
    delayed: by("delay").length,
    blocked: by("block").length,
    inr_held_back: stopped.reduce((s, c) => s + c.payment.amount_inr, 0),
    // Timings only from real calls: replayed text-mode conversations have no real duration.
    median_release_seconds: median(
      released.filter((c) => c.call?.channel !== "text-eval").map((c) => Math.max(0, (Date.parse(c.decision!.decided_at) - Date.parse(c.created_at)) / 1000)),
    ),
    median_call_seconds: median(held.map((c) => c.call?.duration_s ?? 0).filter((x) => x > 0)),
    calls_with_conversation: held.filter((c) => (c.call?.transcript ?? []).some((t) => t.role === "customer") || c.signals.length > 0).length,
    agent_overruled: decided.filter((c) => c.decision!.escalated_over_agent).length,
    patterns: [...patterns.values()].sort((a, b) => b.count - a.count),
    signals: [...signals.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    spend_cents: held.reduce((s, c) => s + (c.call?.cost_cents ?? 0), 0),
  };
}
