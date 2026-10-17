import { DEMO_SCENARIOS } from "../../../shared/scenarios";
import type { Check } from "../../../shared/types";
import { codeWordFor } from "../../components/demo/useDemo";
import type { TxTurn } from "./Transcript";

export interface RecordedRun {
  turns: TxTurn[];
  note: string;
  file: string;
}

interface ReplayFile {
  note?: string;
  recorded_code_word?: string | null;
  turns: { role: "agent" | "customer" | "tool"; text?: string; tool?: string; args?: Record<string, unknown> }[];
}

const norm = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();

/**
 * Sandbox checks answered by a recorded run carry the tool calls but no
 * transcript (the engine only stores transcripts that Bolna sends). The words
 * live in the published replay file, so we fetch it, but only show it when every
 * signal on the check matches a record_signal call in that file, type and
 * evidence. Anything else gets the honest empty state instead.
 */
export async function findRecordedRun(c: Check): Promise<RecordedRun | null> {
  if (c.mode !== "demo" || c.call?.channel !== "text-eval") return null;
  const agentSignals = c.signals.filter((s) => s.source === "agent");
  if (!agentSignals.length) return null;
  const sc = DEMO_SCENARIOS.find((s) => s.customer.customer_ref === c.customer.customer_ref);
  if (!sc) return null;
  const file = `/replays/${sc.id}-${c.customer.language}.json`;
  const res = await fetch(file);
  if (!res.ok) return null;
  const f = (await res.json()) as ReplayFile;
  if (!Array.isArray(f.turns)) return null;

  const recorded = f.turns
    .filter((t) => t.role === "tool" && t.tool === "record_signal")
    .map((t) => ({ type: String(t.args?.signal ?? ""), ev: norm(String(t.args?.evidence ?? "")) }));
  const used = new Set<number>();
  for (const s of agentSignals) {
    const ev = norm(s.evidence);
    const i = recorded.findIndex((r, k) => !used.has(k) && r.type === s.type && (r.ev === ev || (ev.length > 6 && (r.ev.includes(ev) || ev.includes(r.ev)))));
    if (i < 0) return null;
    used.add(i);
  }

  const code = codeWordFor(c.code_word, c.customer.language);
  const swap = (t: string) => (f.recorded_code_word && code ? t.split(f.recorded_code_word).join(code) : t);
  return {
    file,
    note: f.note ?? "Recorded text-mode conversation, replayed through the live engine.",
    turns: f.turns.map((t) => (t.role === "tool" ? { role: "tool", tool: t.tool, args: t.args } : { role: t.role, text: swap(t.text ?? "") })),
  };
}
