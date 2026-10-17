import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpenCheck,
  CircleDashed,
  FileSearch,
  Gavel,
  Hourglass,
  KeyRound,
  Locate,
  MessageSquareText,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Radio,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Panel, Reveal, cn } from "../../kit";
import { api, ApiError } from "../../lib/api";
import { formatINR, maskPhone, minutesLabel } from "../../../shared/format";
import { signalDef } from "../../../shared/signals";
import type { AuditEvent, CallChannel, CallStatus, Check, ContactStatus, Outcome } from "../../../shared/types";
import { useNow, useResource } from "./hooks";
import { ago, clockTime, dateTime, duration, humanize, int, LANG_NAME, offset, usd } from "./fmt";
import {
  BAND,
  Chip,
  ConfidenceMeter,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  OriginTag,
  OUTCOME,
  OutcomeBadge,
  SeverityTag,
  SEVERITY,
  Skeleton,
  StaleBanner,
  StatusPill,
} from "./ui";
import { Transcript, turnDomId, useHighlights, type TxSignal, type TxTurn } from "./Transcript";
import { findRecordedRun, type RecordedRun } from "./recorded";
import { originOf } from "./data";
import { ModelOpinionPanel } from "./ModelOpinion";

const POLL_MS = 3000;

export function CheckDetail({ id }: { id: string }) {
  const [live, setLive] = useState(true);
  const res = useResource(() => api.consoleCheck(id), [id], live ? POLL_MS : null);
  const c = res.data;
  const final = c ? c.status === "decided" || c.status === "expired" || c.status === "allowed" : false;
  useEffect(() => {
    if (c) setLive(!final);
  }, [c, final]);

  if (!c) {
    if (res.loading) return <DetailSkeleton />;
    const notFound = res.error instanceof ApiError && res.error.status === 404;
    return (
      <div className="space-y-4">
        <BackLink />
        {notFound ? (
          <div className="surface">
            <EmptyState
              icon={<FileSearch />}
              title="No check with this ID"
              action={
                <a href="/console" className="rk-btn">
                  <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden />
                  Back to all checks
                </a>
              }
            >
              <span className="font-mono text-[12.5px] text-ink-2">{id}</span> isn't in the demo tenant. Checks from other tenants are never shown here.
            </EmptyState>
          </div>
        ) : (
          <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load this check" />
        )}
      </div>
    );
  }
  return <Loaded c={c} res={res} />;
}

/* ------------------------------------------------------------------ layout */

function Loaded({ c, res }: { c: Check; res: ReturnType<typeof useResource<Check>> }) {
  const reduce = useReducedMotion();
  const recorded = useRecorded(c);
  const turns: TxTurn[] | null = useMemo(() => {
    if (c.call?.transcript?.length) return c.call.transcript.map((t) => ({ role: t.role, text: t.text, tool: t.tool }));
    return recorded.run?.turns ?? null;
  }, [c.call?.transcript, recorded.run]);
  const signals: TxSignal[] = useMemo(
    () =>
      c.signals.map((s) => ({
        id: s.id,
        type: s.type,
        severity: s.severity,
        evidence: s.evidence,
        confidence: s.confidence,
        label: signalDef(s.type)?.label ?? humanize(s.type),
      })),
    [c.signals],
  );
  const hl = useHighlights(signals, turns);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hover ?? pinned;
  const scroller = useRef<HTMLDivElement>(null);

  const reveal = (signalId: string) => {
    const at = hl.found.get(signalId);
    const box = scroller.current;
    if (!at || !box) return;
    setPinned(signalId);
    const el = document.getElementById(turnDomId("tx", at.turn));
    if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 3), behavior: reduce ? "auto" : "smooth" });
    const r = box.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) box.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12.5px] text-muted">{c.id}</span>
          <CopyButton text={c.id} label="Copy ID" />
        </div>
      </div>

      {res.error && <StaleBanner error={res.error} onRetry={res.reload} />}

      <Header c={c} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <DecisionPanel c={c} onSignal={reveal} />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-5">
          <RiskPanel c={c} />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <CallPanel c={c} turns={turns} recorded={recorded} signals={signals} hl={hl} active={active} onActive={setHover} scroller={scroller} />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-5">
          <SignalsPanel
            c={c}
            hasTranscript={Boolean(turns)}
            found={hl.found}
            active={active}
            onHover={setHover}
            onReveal={(sid) => (pinned === sid ? setPinned(null) : reveal(sid))}
            pinned={pinned}
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal className="space-y-4 lg:col-span-5 lg:order-2">
          <ContactPanel c={c} />
          <ModelOpinionPanel c={c} />
          <ContextPanel c={c} />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-7 lg:order-1">
          <AuditPanel c={c} />
        </Reveal>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <a href="/console" className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-[13px] font-medium text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.7} aria-hidden />
      All checks
    </a>
  );
}

function useRecorded(c: Check): { run: RecordedRun | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; run: RecordedRun | null } | null>(null);
  const latest = useRef(c);
  latest.current = c;
  const needed = !c.call?.transcript?.length && c.call?.channel === "text-eval" && c.signals.length > 0;
  const key = `${c.id}|${c.signals.length}|${needed}`;
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    findRecordedRun(latest.current)
      .then((run) => alive && setState({ key, run }))
      .catch(() => alive && setState({ key, run: null }));
    return () => {
      alive = false;
    };
  }, [key, needed]);
  if (!needed) return { run: null, loading: false };
  // Keep the last good run while a new signal is checked against it.
  return { run: state?.run ?? null, loading: state?.key !== key && !state?.run };
}

/* ------------------------------------------------------------------ header */

const MODE_LABEL = (c: Check) => {
  const o = originOf(c);
  if (o === "eval-replay") return "Demo bank · replayed eval conversation";
  if (o === "api") return c.mode === "live" ? "Bank API · live" : "Bank API";
  if (c.mode === "live") return "Live";
  if (c.mode === "eval") return "Eval run";
  return c.call?.channel === "text-eval" ? "Sandbox · recorded run" : c.call?.channel === "web" ? "Sandbox · live web call" : "Sandbox";
};

/** Replayed checks run all their tool calls in a burst, so their clock times say nothing about a real call. */
const isReplay = (c: Check) => originOf(c) === "eval-replay";

function Header({ c }: { c: Check }) {
  const now = useNow(1000);
  const d = c.decision;
  const tone = d ? (d.outcome === "release" ? "var(--go)" : "var(--stop)") : "var(--hair-strong)";
  const critical = c.signals.filter((s) => s.severity === "critical").length;
  const replay = isReplay(c);
  const toDecision = d && !replay ? (Date.parse(d.decided_at) - Date.parse(c.created_at)) / 1000 : null;

  return (
    <Reveal>
      <section className="surface relative overflow-hidden p-5 md:p-7" aria-labelledby="check-amount">
        <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: tone }} aria-hidden />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-muted">
              <Chip>{MODE_LABEL(c)}</Chip>
              <OriginTag origin={originOf(c)} />
              <span>
                <time dateTime={c.created_at}>{dateTime(c.created_at)}</time> IST · {ago(c.created_at, now)}
              </span>
            </div>
            <h2 id="check-amount" className="t-num mt-4 text-[44px] leading-none text-ink md:text-[56px]">
              {formatINR(c.payment.amount_inr)}
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] text-ink-2">
              <span>
                to <span className="font-medium text-ink">{c.payment.payee.name}</span>
              </span>
              <span className="font-mono text-[12px] text-muted">{c.payment.payee.handle}</span>
            </p>
            <p className="mt-1.5 text-[14px] text-muted">
              from <span className="text-ink-2">{c.customer.name}</span> · {LANG_NAME[c.customer.language] ?? c.customer.language} · {c.payment.rail}
              {c.payment.note ? <> · note “{c.payment.note}”</> : null}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2.5 lg:items-end lg:text-right">
            {d ? (
              <OutcomeBadge outcome={d.outcome} size="lg" />
            ) : (
              <span className="inline-flex items-center rounded-full border border-hair px-4 py-2.5">
                <StatusPill status={c.status} />
              </span>
            )}
            <p className="max-w-[34ch] text-[13px] text-muted">
              {d
                ? replay
                  ? d.outcome === "delay" && d.delay_minutes
                    ? `Held for ${minutesLabel(d.delay_minutes)}. Decided by the policy from the replayed tool calls.`
                    : "Decided by the policy from the replayed tool calls."
                  : d.outcome === "delay" && d.delay_minutes
                    ? `Held for ${minutesLabel(d.delay_minutes)}, decided ${duration(toDecision)} after the hold.`
                    : `Decided ${duration(toDecision)} after the hold.`
                : c.status === "allowed"
                  ? "Allowed straight through. No call was needed."
                  : c.status === "expired"
                    ? "The hold expired before a decision."
                    : "Waiting for the call to finish. This page refreshes every 3 seconds."}
            </p>
            {d?.pattern && (
              <a href={`/console/library?p=${encodeURIComponent(d.pattern.id)}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 underline decoration-[var(--hair-strong)] underline-offset-4 hover:text-ink">
                Pattern: {d.pattern.name}
                <ArrowUpRight className="size-3.5 text-muted" strokeWidth={1.8} aria-hidden />
              </a>
            )}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-hair pt-5 sm:grid-cols-4">
          <Field label="Risk before the call">
            <span className="t-num text-[18px]">{c.risk.score}</span>
            <span className="text-muted">/100 · </span>
            <span className={BAND[c.risk.band]?.text}>{BAND[c.risk.band]?.label ?? c.risk.band}</span>
          </Field>
          <Field label="Call">{c.call ? `${CHANNEL[c.call.channel]?.short ?? c.call.channel} · ${CALL_STATUS[c.call.status] ?? c.call.status}` : "No call"}</Field>
          <Field label="Signals heard">
            <span className="t-num text-[18px]">{c.signals.length}</span>
            {critical > 0 && <span className="text-muted"> · {critical} critical</span>}
          </Field>
          <Field label="Hold to decision">
            {toDecision !== null ? (
              <span className="t-num text-[18px]">{duration(toDecision)}</span>
            ) : (
              <span className="text-muted">{replay && d ? "Replay, not timed" : c.status === "allowed" ? "No hold" : "Pending"}</span>
            )}
          </Field>
        </dl>
      </section>
    </Reveal>
  );
}

/* ---------------------------------------------------------------- decision */

function DecisionPanel({ c, onSignal }: { c: Check; onSignal: (id: string) => void }) {
  const d = c.decision;
  const byId = new Map(c.signals.map((s) => [s.id, s]));
  return (
    <Panel
      title="Decision"
      description={d ? `Deterministic policy ${d.policy_version}. The agent can escalate a decision, never soften one.` : "Made by the deterministic policy once the call ends."}
      className="h-full"
    >
      {!d ? (
        <EmptyState icon={c.status === "allowed" ? <ShieldCheck /> : <Hourglass />} title={c.status === "allowed" ? "No decision needed" : c.status === "expired" ? "Hold expired" : "Not decided yet"} className="py-8">
          {c.status === "allowed"
            ? "The pre-call risk score was below the hold threshold, so the payment went straight through."
            : c.status === "expired"
              ? "Nobody reached a decision before the hold ran out."
              : "The policy decides when the agent calls set_decision or the call ends."}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <OutcomeBadge outcome={d.outcome} size="md" />
            {d.outcome === "delay" && d.delay_minutes ? <Chip>Held for {minutesLabel(d.delay_minutes)}</Chip> : null}
            {d.pattern ? <Chip>Pattern · {d.pattern.name}</Chip> : <Chip>No pattern named</Chip>}
            <span className="ml-auto font-mono text-[11.5px] text-muted">
              {clockTime(d.decided_at, true)} · {offset(c.created_at, d.decided_at)}
            </span>
          </div>

          {d.escalated_over_agent && <Escalation c={c} />}

          <h4 className="t-eyebrow mt-6 !text-[10.5px]">Reasons</h4>
          <ol className="mt-2.5 divide-y divide-[var(--hair)] rounded-2xl border border-hair">
            {d.reasons.map((r, i) => (
              <li key={`${r.code}-${i}`} className="px-4 py-3.5">
                <code className="font-mono text-[11px] tracking-[0.02em] text-muted">{r.code}</code>
                <p className="mt-1 text-[14px] leading-relaxed text-ink">{r.text}</p>
                {r.signal_ids?.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {r.signal_ids.map((sid) => {
                      const s = byId.get(sid);
                      if (!s) return null;
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => onSignal(sid)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-hair px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-[var(--hair-strong)] hover:text-ink"
                        >
                          <span className="size-2 rounded-full" style={{ background: SEVERITY[s.severity].color }} aria-hidden />
                          {humanize(s.type)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          <figure className="mt-5 rounded-2xl bg-paper-2 px-4 py-3.5">
            <figcaption className="t-eyebrow !text-[10.5px]">What the customer's app said</figcaption>
            <blockquote lang={c.customer.language} className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              “{d.customer_message}”
            </blockquote>
          </figure>

          {c.agent_recommendation && !d.escalated_over_agent && (
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              The assistant recommended <span className="font-semibold text-ink-2">{c.agent_recommendation.outcome}</span> and the policy agreed.
              {c.agent_recommendation.reason ? <> Its reason: “<span lang={c.customer.language}>{c.agent_recommendation.reason}</span>”</> : null}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function Escalation({ c }: { c: Check }) {
  const d = c.decision!;
  const rec = (d.agent_recommendation ?? c.agent_recommendation?.outcome ?? null) as Outcome | null;
  return (
    <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,var(--stop)_35%,transparent)] bg-stop-soft p-4" role="note">
      <div className="flex gap-3">
        <TrendingUp className="mt-0.5 size-[18px] shrink-0 text-stop" strokeWidth={1.8} aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-ink">
            The assistant recommended {rec ? OUTCOME[rec].verb : "less"}; the evidence required {OUTCOME[d.outcome].verb}.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            The policy reads the signals, not the agent's opinion, and only ever moves a decision up. An agent can be talked round on a call; the rules can't.
          </p>
          {c.agent_recommendation?.reason && (
            <p className="mt-2 text-[13px] text-muted">
              Agent's reason: “<span lang={c.customer.language}>{c.agent_recommendation.reason}</span>”
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- risk */

function RiskPanel({ c }: { c: Check }) {
  const reasons = [...c.risk.reasons].sort((a, b) => b.weight - a.weight);
  const max = Math.max(1, ...reasons.map((r) => Math.abs(r.weight)));
  const sum = reasons.reduce((s, r) => s + r.weight, 0);
  const band = BAND[c.risk.band] ?? BAND.low;
  return (
    <Panel title="Pre-call risk" description="Scored from what the bank sent, before anyone was called." className="h-full">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="leading-none">
          <span className="t-num text-[44px] text-ink">{c.risk.score}</span>
          <span className="ml-1 text-[15px] text-muted">/100</span>
        </p>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Chip>
            <span className="size-2 rounded-full" style={{ background: band.fill }} aria-hidden />
            {band.label} risk
          </Chip>
          <Chip>{c.risk.action === "hold" ? "Held for a voice check" : "Allowed, no call"}</Chip>
        </div>
      </div>
      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-paper-3" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, c.risk.score)}%`, background: band.fill }} />
      </div>

      {reasons.length ? (
        <ul className="mt-5 space-y-4">
          {reasons.map((r) => (
            <li key={r.code}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[14px] font-medium text-ink">
                  {r.title}
                  {r.hard && <span className="ml-2 rounded-full bg-stop-soft px-2 py-0.5 align-[2px] text-[10.5px] font-semibold text-stop">Hard rule</span>}
                </p>
                <span className="t-num shrink-0 text-[14px] text-ink">{r.weight > 0 ? `+${r.weight}` : r.weight}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-3" aria-hidden>
                <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(Math.abs(r.weight) / max) * 100}%`, opacity: r.weight < 0 ? 0.45 : 1 }} />
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{r.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-[13.5px] text-muted">No risk factors fired.</p>
      )}
      <p className="mt-5 border-t border-hair pt-3 text-[12px] text-muted">
        {sum > 100 ? `Weights add up to ${sum}; the score is capped at 100. ` : ""}Policy {c.risk.policy_version}.
      </p>
    </Panel>
  );
}

/* -------------------------------------------------------------------- call */

const CHANNEL: Record<CallChannel, { label: string; short: string; icon: ReactNode }> = {
  phone: { label: "Phone call through Bolna", short: "Phone", icon: <Phone /> },
  web: { label: "Web call through Bolna's Web Call SDK", short: "Web call", icon: <Radio /> },
  "text-eval": { label: "Recorded run, replayed through the engine", short: "Recorded run", icon: <ScrollText /> },
};

const CALL_STATUS: Record<CallStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  ringing: "Ringing",
  "in-progress": "In progress",
  completed: "Completed",
  "no-answer": "No answer",
  busy: "Busy",
  failed: "Failed",
  error: "Error",
  not_configured: "Not configured",
};

function CallPanel({
  c,
  turns,
  recorded,
  signals,
  hl,
  active,
  onActive,
  scroller,
}: {
  c: Check;
  turns: TxTurn[] | null;
  recorded: { run: RecordedRun | null; loading: boolean };
  signals: TxSignal[];
  hl: ReturnType<typeof useHighlights>;
  active: string | null;
  onActive: (id: string | null) => void;
  scroller: RefObject<HTMLDivElement>;
}) {
  const call = c.call;
  const fromBolna = Boolean(call?.transcript?.length);
  const located = signals.filter((s) => hl.found.has(s.id)).length;
  const spanned = call?.started_at && call?.ended_at ? (Date.parse(call.ended_at) - Date.parse(call.started_at)) / 1000 : null;
  const callDuration = call?.duration_s ?? (call?.channel !== "text-eval" && spanned && spanned > 0 ? spanned : null);

  return (
    <Panel title="Call" description={call ? CHANNEL[call.channel]?.label : "The voice check with the customer."} className="h-full">
      {!call ? (
        <EmptyState icon={<PhoneOff />} title="No call" className="py-8">
          {c.risk.action === "allow" ? "The payment was allowed before any call was needed." : "No call has started for this check yet."}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip>
              {CHANNEL[call.channel]?.icon}
              {CHANNEL[call.channel]?.short ?? call.channel}
            </Chip>
            <Chip>
              <span className={cn("size-2 rounded-full", call.status === "completed" ? "bg-go" : call.status === "in-progress" || call.status === "ringing" ? "bg-accent" : "bg-[var(--muted)]")} aria-hidden />
              {CALL_STATUS[call.status] ?? call.status}
            </Chip>
            {callDuration !== null && <Chip>{duration(callDuration)}</Chip>}
            {call.verified_with_bolna ? (
              <Chip className="border-transparent bg-go-soft text-go" title="The terminal webhook was checked by fetching the execution back from Bolna's API.">
                <ShieldCheck />
                Verified with Bolna
              </Chip>
            ) : (
              <Chip className="text-muted" title={call.channel === "text-eval" ? "Recorded runs have no Bolna execution to verify." : "Verification happens when the final webhook arrives."}>
                <ShieldQuestion />
                {call.channel === "text-eval" ? "No Bolna execution" : "Not verified yet"}
              </Chip>
            )}
          </div>

          {(call.execution_id || call.hangup_reason || call.cost_cents !== undefined || call.error) && (
            <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
              {call.execution_id && (
                <Field label="Execution" className="sm:col-span-2">
                  <span className="block truncate font-mono text-[12.5px] text-ink-2" title={call.execution_id}>
                    {call.execution_id}
                  </span>
                </Field>
              )}
              {call.cost_cents !== undefined && <Field label="Bolna cost">{usd(call.cost_cents)}</Field>}
              {call.hangup_reason && <Field label="Hang-up">{humanize(call.hangup_reason)}</Field>}
              {call.error && (
                <Field label="Error" className="sm:col-span-3">
                  <span className="text-stop">{call.error}</span>
                </Field>
              )}
            </dl>
          )}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h4 className="font-display text-[14.5px] font-semibold text-ink">Transcript</h4>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {fromBolna && call.channel === "text-eval"
                  ? "From the recorded eval conversation. Signals were recorded by the agent's own tool calls in it."
                  : fromBolna
                  ? "From Bolna's execution record."
                  : recorded.run
                    ? "From the recorded run this check replayed. Every signal below matches a tool call in it."
                    : "Evidence quotes are highlighted where they were said."}
              </p>
            </div>
            {turns && signals.length > 0 && (
              <p className="text-[12px] text-muted">
                {located} of {signals.length} {signals.length === 1 ? "quote" : "quotes"} located
              </p>
            )}
          </div>

          {turns ? (
            <div
              ref={scroller}
              tabIndex={0}
              role="region"
              aria-label="Call transcript, scrollable"
              className="rk-scroll-x relative mt-3 max-h-[560px] overflow-y-auto rounded-2xl border border-hair bg-paper p-3 sm:p-4"
            >
              <Transcript
                turns={turns}
                signals={signals}
                highlights={hl}
                active={active}
                onActive={onActive}
                customerName={c.customer.name}
                lang={c.customer.language}
                idPrefix="tx"
              />
            </div>
          ) : recorded.loading ? (
            <div className="mt-3 space-y-2.5">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="ml-auto h-12 w-2/3" />
              <Skeleton className="h-12 w-4/5" />
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--hair-strong)]">
              <EmptyState icon={<MessageSquareText />} title={call.status === "in-progress" || call.status === "queued" || call.status === "ringing" ? "Transcript arrives when the call ends" : "No transcript stored"} className="py-8">
                {call.status === "in-progress" || call.status === "queued" || call.status === "ringing"
                  ? "Bolna sends the transcript with the final webhook. Signals appear on the right as the agent records them."
                  : call.channel === "text-eval"
                    ? "This check ran from tool calls only, and they don't match a published recording, so there are no words to show. The signals and their evidence are still on the right."
                    : "Bolna didn't return a transcript for this execution."}
              </EmptyState>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- signals */

const SOURCE_LABEL: Record<string, string> = { agent: "Voice agent", contact_agent: "Contact agent", device: "Device", policy: "Policy" };

function SignalsPanel({
  c,
  hasTranscript,
  found,
  active,
  pinned,
  onHover,
  onReveal,
}: {
  c: Check;
  hasTranscript: boolean;
  found: Map<string, unknown>;
  active: string | null;
  pinned: string | null;
  onHover: (id: string | null) => void;
  onReveal: (id: string) => void;
}) {
  return (
    <Panel title="Signals heard" description="Recorded by the agent through record_signal, each with the words it relied on." className="h-full">
      {!c.signals.length ? (
        <EmptyState icon={<Activity />} title="No signals" className="py-8">
          {c.call ? "The agent hasn't recorded anything yet." : "Signals are recorded during the call, and this check had none."}
        </EmptyState>
      ) : (
        <ol className="relative space-y-1">
          <span className="absolute bottom-4 left-[11px] top-4 w-px bg-[var(--hair-strong)]" aria-hidden />
          {c.signals.map((s) => {
            const def = signalDef(s.type);
            const on = active === s.id;
            const located = found.has(s.id);
            return (
              <li
                key={s.id}
                onMouseEnter={() => onHover(s.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(s.id)}
                onBlur={() => onHover(null)}
                className={cn("relative rounded-2xl py-3 pl-9 pr-3 transition-colors", on ? "bg-paper-2" : "")}
              >
                <span
                  className="absolute left-[5px] top-[18px] size-[13px] rounded-full border-2 border-[var(--surface)]"
                  style={{ background: SEVERITY[s.severity].color, boxShadow: on ? `0 0 0 3px color-mix(in oklab, ${SEVERITY[s.severity].color} 35%, transparent)` : undefined }}
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <SeverityTag severity={s.severity} />
                  <ConfidenceMeter confidence={s.confidence} />
                  <span className="ml-auto font-mono text-[11px] text-muted">{offset(c.created_at, s.at)}</span>
                </div>
                <p className="mt-2 text-[14px] font-medium leading-snug text-ink">{def?.label ?? humanize(s.type)}</p>
                <p lang={c.customer.language} className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
                  “{s.evidence}”
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="font-mono text-[11px]">{s.type}</span>
                  <span>{SOURCE_LABEL[s.source] ?? s.source}</span>
                  {s.pattern_hint && s.pattern_hint !== "none" && <span>hint: {humanize(s.pattern_hint)}</span>}
                  {hasTranscript &&
                    (located ? (
                      <button
                        type="button"
                        onClick={() => onReveal(s.id)}
                        aria-pressed={pinned === s.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-ink-2 transition-colors hover:text-ink aria-pressed:text-ink"
                      >
                        <Locate className="size-3.5" strokeWidth={1.8} aria-hidden />
                        {pinned === s.id ? "Showing in transcript" : "Show in transcript"}
                      </button>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1" title="The agent paraphrased; no stretch of the transcript matched closely enough to highlight.">
                        <CircleDashed className="size-3.5" strokeWidth={1.8} aria-hidden />
                        Paraphrased
                      </span>
                    ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- contact */

const CONTACT: Record<ContactStatus, { label: string; note: string; tone: "go" | "stop" | "neutral" | "accent" }> = {
  not_requested: { label: "Not requested", note: "The agent didn't ask to call the trusted contact.", tone: "neutral" },
  consent_declined: { label: "Customer declined", note: "The customer said no to calling their contact, so nobody was called.", tone: "neutral" },
  no_contact_on_file: { label: "No contact on file", note: "The bank has no trusted contact for this customer.", tone: "neutral" },
  dialing: { label: "Dialling", note: "Bolna is calling the contact now.", tone: "accent" },
  ringing_web: { label: "Ringing in a browser tab", note: "Demo: phone calls are off, so the contact's call rings in a browser tab instead.", tone: "accent" },
  reached: { label: "Reached", note: "The contact agent spoke to them.", tone: "go" },
  no_answer: { label: "No answer", note: "The contact didn't pick up.", tone: "neutral" },
  not_configured: { label: "Not configured", note: "No contact agent is configured on this deployment.", tone: "neutral" },
  simulated: { label: "Simulated", note: "Recorded run: the contact call is shown in the flow but never placed.", tone: "neutral" },
};

function ContactPanel({ c }: { c: Check }) {
  const tc = c.customer.trusted_contact;
  const ct = c.contact;
  const st = ct ? (CONTACT[ct.status] ?? { label: humanize(ct.status), note: "", tone: "neutral" as const }) : null;
  const o = ct?.outcome;
  const yn = (v: boolean | undefined) => (v === undefined ? "Unsure" : v ? "Yes" : "No");
  return (
    <Panel title="Trusted contact" description="Someone the customer chose in advance, called only with their consent on the call.">
      {tc ? (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2">
            <Users className="size-[18px]" strokeWidth={1.7} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-medium text-ink">
              {tc.name} <span className="font-normal text-muted">· {tc.relation}</span>
            </p>
            <p className="font-mono text-[12px] text-muted">
              {maskPhone(tc.phone_e164)} · consent {tc.consent_on_file ? "on file" : "not on file"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13.5px] text-muted">No trusted contact on file for this customer.</p>
      )}
      {st && (
        <div className="mt-4 rounded-2xl border border-hair p-3.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            {ct!.status === "reached" ? (
              <PhoneForwarded className="size-4 text-go" strokeWidth={1.8} aria-hidden />
            ) : (
              <PhoneForwarded className={cn("size-4", st.tone === "accent" ? "text-accent" : "text-muted")} strokeWidth={1.8} aria-hidden />
            )}
            {st.label}
            {ct!.requested_at && <span className="ml-auto font-mono text-[11px] font-normal text-muted">{offset(c.created_at, ct!.requested_at)}</span>}
          </p>
          {st.note && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{st.note}</p>}
          {o && (
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-hair pt-3">
              <Field label="Knew about it">{yn(o.knows_about_payment)}</Field>
              <Field label="Concerned">
                <span className={o.concern_raised ? "text-stop" : undefined}>{yn(o.concern_raised)}</span>
              </Field>
              <Field label="Will call them">{yn(o.will_call_customer)}</Field>
              {o.notes && (
                <Field label="Notes" className="col-span-3">
                  <span className="text-ink-2">{o.notes}</span>
                </Field>
              )}
            </dl>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- context */

function ContextPanel({ c }: { c: Check }) {
  const cu = c.customer;
  const dv = c.device;
  const py = c.payment.payee;
  const yes = (v: boolean | undefined) => (v ? "Yes" : "No");
  return (
    <Panel title="What the bank sent" description="The context behind the risk score. No account numbers, no OTPs.">
      <div className="space-y-4">
        <Group icon={<UserRound />} title="Customer">
          <Field label="Digital tenure">{int(cu.digital_tenure_days)} days</Field>
          <Field label="90-day average">{formatINR(cu.avg_amount_90d)}</Field>
          <Field label="90-day largest">{formatINR(cu.max_amount_90d)}</Field>
          <Field label="Extra protection">{yes(cu.vulnerability_flag)}</Field>
        </Group>
        <Group icon={<Phone />} title="Device">
          <Field label="On a call">{dv.active_call ? `Yes${dv.active_call_minutes ? `, ${dv.active_call_minutes} min` : ""}` : "No"}</Field>
          <Field label="Caller in contacts">{dv.active_call ? yes(dv.caller_in_contacts) : "–"}</Field>
          <Field label="Remote-access app">{yes(dv.remote_access_app)}</Field>
          <Field label="New device">{yes(dv.new_device)}</Field>
        </Group>
        <Group icon={<KeyRound />} title="Payee">
          <Field label="New payee">{yes(py.is_new)}</Field>
          <Field label="Paid before">{int(py.prior_payments ?? 0)}×</Field>
          <Field label="In contacts">{yes(py.in_contacts)}</Field>
          <Field label="Flags">{py.flags?.length ? py.flags.map(humanize).join(", ") : "None"}</Field>
        </Group>
      </div>
    </Panel>
  );
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2 [&>svg]:size-3.5 [&>svg]:stroke-[1.8] [&>svg]:text-muted">
        {icon}
        {title}
      </h4>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-paper-2 p-3.5 sm:grid-cols-4 lg:grid-cols-2">{children}</dl>
    </section>
  );
}

/* ------------------------------------------------------------------- audit */

const EVENT: Record<string, { label: string; icon: ReactNode }> = {
  "check.created": { label: "Check created", icon: <ShieldAlert /> },
  "call.updated": { label: "Call updated", icon: <Phone /> },
  "context.read": { label: "Agent read the check", icon: <BookOpenCheck /> },
  "signal.recorded": { label: "Signal recorded", icon: <Activity /> },
  "contact.updated": { label: "Trusted contact", icon: <PhoneForwarded /> },
  "contact.outcome": { label: "Contact outcome", icon: <Users /> },
  "agent.recommendation": { label: "Agent recommendation", icon: <Gavel /> },
  "decision.made": { label: "Policy decision", icon: <Gavel /> },
  "decision.updated": { label: "Decision updated", icon: <Gavel /> },
  "live.authorized": { label: "Live call authorised", icon: <KeyRound /> },
  "call.retry": { label: "Call retried", icon: <PhoneOff /> },
};

function AuditPanel({ c }: { c: Check }) {
  const events: AuditEvent[] = c.events ?? [];
  return (
    <Panel
      title="Audit trail"
      description={
        isReplay(c)
          ? "Every engine event for this check. A replay sends its tool calls in a burst, so these offsets are engine time, not call time."
          : "Every engine event for this check, timed from the moment the payment was held."
      }
      action={<span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">t₀ {clockTime(c.created_at, true)} IST</span>}
      className="h-full"
    >
      {!events.length ? (
        <p className="text-[13.5px] text-muted">No events recorded.</p>
      ) : (
        <ol className="-mx-2">
          {events.map((e, i) => {
            const m = EVENT[e.type] ?? { label: humanize(e.type.replace(".", " ")), icon: <Activity /> };
            const decision = e.type.startsWith("decision.");
            return (
              <li key={`${e.type}-${i}`} className="grid grid-cols-[64px_28px_minmax(0,1fr)] items-start gap-x-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper-2 sm:grid-cols-[76px_28px_minmax(0,1fr)]">
                <span className="pt-1 text-right font-mono text-[11.5px] tabular-nums text-muted">{offset(c.created_at, e.at)}</span>
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full border bg-surface [&>svg]:size-3.5 [&>svg]:stroke-[1.8]",
                    decision ? "border-[color-mix(in_oklab,var(--ink)_30%,transparent)] text-ink" : "border-hair text-ink-2",
                  )}
                  aria-hidden
                >
                  {m.icon}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
                    <span className="font-semibold text-ink">{m.label}</span>
                    <code className="font-mono text-[11px] text-muted">{e.type}</code>
                  </p>
                  <p lang={/[ऀ-ॿ]/.test(e.detail) ? "hi" : undefined} className="mt-0.5 break-words text-[13px] leading-relaxed text-ink-2">
                    {e.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- skeleton */

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading check">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-[248px] !rounded-[20px]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-[320px] !rounded-[20px] lg:col-span-7" />
        <Skeleton className="h-[320px] !rounded-[20px] lg:col-span-5" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-[420px] !rounded-[20px] lg:col-span-7" />
        <Skeleton className="h-[420px] !rounded-[20px] lg:col-span-5" />
      </div>
    </div>
  );
}
