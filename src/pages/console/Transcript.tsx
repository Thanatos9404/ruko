import { useMemo, type ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import { cn } from "../../kit";
import { RukoMark } from "../../components/brand/RukoLogo";
import { SEVERITY_RANK, signalDef } from "../../../shared/signals";
import type { Confidence, Severity } from "../../../shared/types";
import { highlightTranscript, type Located, type Range } from "./highlight";
import { SEVERITY } from "./ui";
import { humanize } from "./fmt";

export interface TxTurn {
  role: "agent" | "customer" | "tool";
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface TxSignal {
  id: string;
  type: string;
  severity: Severity;
  evidence: string;
  confidence?: Confidence;
  label: string;
}

export interface Highlights {
  found: Map<string, Located>;
  byTurn: Map<number, Range[]>;
}

export function useHighlights(signals: TxSignal[], turns: TxTurn[] | null): Highlights {
  return useMemo(() => (turns ? highlightTranscript(signals, turns) : { found: new Map(), byTurn: new Map() }), [signals, turns]);
}

/** Signals recorded by tool calls inside a transcript (eval samples and recorded replays). */
export function signalsFromToolTurns(turns: TxTurn[]): TxSignal[] {
  const out: TxSignal[] = [];
  turns.forEach((t, i) => {
    if (t.role !== "tool" || t.tool !== "record_signal") return;
    const type = String(t.args?.signal ?? "");
    const def = signalDef(type);
    const conf = String(t.args?.confidence ?? "");
    out.push({
      id: `tool-${i}`,
      type,
      severity: def?.severity ?? "process",
      evidence: String(t.args?.evidence ?? ""),
      confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : undefined,
      label: def?.label ?? humanize(type),
    });
  });
  return out;
}

export const turnDomId = (prefix: string, i: number) => `${prefix}-turn-${i}`;

/**
 * A call transcript as chat bubbles. Each signal's evidence is marked inside the
 * words it came from, coloured by severity; hovering or focusing a mark reports
 * the signal so the list beside it can light up, and `active` lights marks back.
 */
export function Transcript({
  turns,
  signals,
  highlights,
  active,
  onActive,
  customerName,
  lang,
  idPrefix,
  className,
}: {
  turns: TxTurn[];
  signals: TxSignal[];
  highlights: Highlights;
  active: string | null;
  onActive: (id: string | null) => void;
  customerName: string;
  lang?: string;
  idPrefix: string;
  className?: string;
}) {
  const byId = useMemo(() => new Map(signals.map((s) => [s.id, s])), [signals]);
  let spoken = 0;
  return (
    <ol className={cn("space-y-3", className)} aria-label="Call transcript">
      {turns.map((t, i) => {
        if (t.role === "tool") return <ToolTurn key={i} turn={t} />;
        spoken++;
        const agent = t.role === "agent";
        const prev = turns.slice(0, i).reverse().find((x) => x.role !== "tool");
        const first = !prev || prev.role !== t.role;
        return (
          <li key={i} id={turnDomId(idPrefix, i)} className={cn("flex scroll-mt-4 gap-2.5", agent ? "pr-5 sm:pr-14" : "flex-row-reverse pl-5 sm:pl-14")}>
            <span className={cn("mt-5 hidden size-7 shrink-0 place-items-center rounded-full sm:grid", first ? "" : "invisible", agent ? "bg-paper-3 text-ink" : "border border-hair text-[11px] font-semibold text-ink-2")} aria-hidden>
              {agent ? <RukoMark compact className="h-3.5 w-auto" title="" /> : customerName.slice(0, 1).toUpperCase()}
            </span>
            <div className={cn("min-w-0", agent ? "" : "flex flex-col items-end")}>
              <p className={cn("mb-1 flex items-center gap-2 px-1 text-[11.5px] text-muted", !first && "sr-only")}>
                <span className="font-semibold text-ink-2">{agent ? "Ruko" : customerName}</span>
                <span className="font-mono text-[10.5px]">#{spoken}</span>
              </p>
              <div
                lang={lang}
                className={cn(
                  "w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.6]",
                  agent ? "rounded-tl-md border border-hair bg-paper-2 text-ink-2" : "rounded-tr-md bg-paper-3 text-ink",
                )}
              >
                {renderText(t.text ?? "", highlights.byTurn.get(i) ?? [], byId, active, onActive)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function renderText(text: string, ranges: Range[], byId: Map<string, TxSignal>, active: string | null, onActive: (id: string | null) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, k) => {
    if (r.start > pos) out.push(text.slice(pos, r.start));
    const sigs = r.ids.map((id) => byId.get(id)).filter((s): s is TxSignal => Boolean(s));
    if (!sigs.length) {
      out.push(text.slice(r.start, r.end));
    } else {
      const top = [...sigs].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
      const color = SEVERITY[top.severity]?.color ?? "var(--accent)";
      out.push(
        <mark
          key={k}
          className="rk-mark"
          tabIndex={0}
          data-active={active !== null && r.ids.includes(active) ? "true" : undefined}
          style={{ ["--sev" as string]: color }}
          onMouseEnter={() => onActive(top.id)}
          onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(top.id)}
          onBlur={() => onActive(null)}
          title={sigs.map((s) => `${s.label} (${SEVERITY[s.severity]?.label.toLowerCase() ?? s.severity})`).join(" · ")}
        >
          {text.slice(r.start, r.end)}
          <span className="sr-only"> (evidence for: {sigs.map((s) => s.label).join("; ")})</span>
        </mark>,
      );
    }
    pos = r.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function ToolTurn({ turn }: { turn: TxTurn }) {
  const a = turn.args ?? {};
  let detail: ReactNode = null;
  if (turn.tool === "record_signal") {
    const def = signalDef(String(a.signal ?? ""));
    const sev = def?.severity ?? "process";
    detail = (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: SEVERITY[sev].color }} aria-hidden />
        <span className="truncate text-ink-2">{def?.label ?? humanize(String(a.signal ?? "signal"))}</span>
      </span>
    );
  } else if (turn.tool === "set_decision") {
    detail = <span className="text-ink-2">recommends {String(a.recommendation ?? "?")}</span>;
  } else if (turn.tool === "call_trusted_contact") {
    detail = <span className="text-ink-2">consent: {String(a.customer_consent ?? "–")}</span>;
  }
  return (
    <li className="flex min-w-0 items-center gap-2 pl-1 text-[11.5px] text-muted sm:pl-9">
      <CornerDownRight className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden />
      <code className="shrink-0 font-mono text-[11px]">{turn.tool ?? "tool"}()</code>
      {detail}
    </li>
  );
}
