import { useEffect, useState } from "react";

export interface Rate {
  n: number;
  k: number;
  rate: number;
  ci95: [number, number];
}

export interface PublishedRun {
  run_id: string;
  label: string;
  set: "dev" | "holdout" | "holdout2" | "holdout3" | "holdout4";
  clean_holdout: boolean;
  scenarios: number;
  scam_catch: Rate;
  scam_block: Rate;
  false_hold: Rate;
  ambiguous_ok: Rate | null;
  otp_requests: number;
  agent_turns: number;
  median_turns: number | null;
  median_seconds: number | null;
  heavy_catch: Rate;
  light_catch: Rate;
  truth_said: Rate;
  e2e_scam_caught: Rate;
  e2e_genuine_called: Rate;
}

export interface EvalResults {
  generated_at: string;
  version: string;
  agent_model: string;
  customer_model: string;
  current: PublishedRun[];
  history: PublishedRun[];
  totals: { conversations: number; agent_turns: number; otp_requests: number };
  tool_latency_ms?: { p50: number; p95: number; n: number; where: string } | null;
}

let cache: Promise<EvalResults | null> | null = null;

export function loadEvalResults(): Promise<EvalResults | null> {
  if (!cache) cache = fetch("/eval/results.json").then((r) => (r.ok ? (r.json() as Promise<EvalResults>) : null)).catch(() => null);
  return cache;
}

export function useEvalResults() {
  const [data, setData] = useState<EvalResults | null>(null);
  useEffect(() => {
    let alive = true;
    void loadEvalResults().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export const pct = (r: Rate | null | undefined, digits = 0) => (r ? `${(r.rate * 100).toFixed(digits)}%` : "–");
export const frac = (r: Rate | null | undefined) => (r ? `${r.k}/${r.n}` : "");
