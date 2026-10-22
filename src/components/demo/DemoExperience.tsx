import { AnimatePresence, motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Languages, PhoneIncoming, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "../../../shared/types";
import { formatINR } from "../../../shared/format";
import { DEMO_SCENARIO_VIEWS, type DemoScenarioView } from "../../../shared/scenarios";
import { api, type LiveStatus } from "../../lib/api";
import { cn, EASE } from "../../kit";
import { Phone } from "./Phone";
import { AllowedScreen, CallScreen, HoldScreen, OutcomeScreen, PayScreen } from "./Screens";
import { Timeline } from "./Timeline";
import { AccessDialog } from "./AccessDialog";
import { readAccessCode, useDemo, type DemoState } from "./useDemo";
import { prefetchBolnaSdk } from "../../lib/useBolnaCall";

const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी" };

/**
 * The sandbox payment, end to end: a phone running a demo bank app on the
 * left, Ruko's engine on the right, updating as each tool call lands.
 */
export function DemoExperience({ compact = false, scenarios: only }: { compact?: boolean; scenarios?: string[] }) {
  const d = useDemo();
  const scenarios = DEMO_SCENARIO_VIEWS;
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [askCode, setAskCode] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.liveStatus().then(setLive).catch(() => setLive(null));
    // Warm the API function so a live call's mint doesn't pay for a cold start.
    void fetch("/v1/health").catch(() => undefined);
  }, []);
  useEffect(() => {
    // Fetch the Web Call SDK while the visitor reads the hold screen.
    if (live?.live && d.phase === "hold") prefetchBolnaSdk();
  }, [live?.live, d.phase]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const onlyKey = only?.join(",") ?? "";
  const list = useMemo(() => (onlyKey ? scenarios.filter((s) => onlyKey.split(",").includes(s.id)) : scenarios), [scenarios, onlyKey]);
  const sc = scenarios.find((s) => s.id === d.scenario);
  const liveAvailable = Boolean(live && (live.live || live.reason === "daily_cap") && live.reason !== "not_configured");

  const stageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    // After Pay, bring the phone and the engine panel fully into view, below the floating nav.
    if (!d.check || scrolledFor.current === d.check.id || !(d.phase === "hold" || d.phase === "allowed")) return;
    scrolledFor.current = d.check.id;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 88 || r.top > window.innerHeight * 0.35) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [d.check, d.phase, reduce]);

  const answer = () => {
    if (readAccessCode()) void d.startLive();
    else setAskCode(true);
  };
  const elapsed = d.startedAt ? now - d.startedAt : 0;
  const locked = d.phase !== "pay";

  return (
    <div ref={stageRef} className="scroll-mt-24">
      <Controls d={d} list={list} locked={locked} />
      <div className={cn("mt-4 grid grid-cols-1 gap-6 lg:gap-10", compact ? "lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:grid-cols-[360px_minmax(0,1fr)]")}>
      <div className="min-w-0">
        <div>
          <Phone label="Sandbox bank app">
            <AnimatePresence mode="wait">
              <motion.div key={d.phase} className="flex flex-1 flex-col" exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.25 }}>
                {(d.phase === "pay" || d.phase === "checking") && (
                  <PayScreen scenario={sc} lang={d.lang} busy={d.phase === "checking"} onPay={d.pay} bank="Demo Bank" />
                )}
                {d.phase === "allowed" && d.check && <AllowedScreen check={d.check} scenario={sc} lang={d.lang} onAgain={d.reset} />}
                {d.phase === "hold" && d.check && <HoldScreen check={d.check} lang={d.lang} liveAvailable={liveAvailable} onAnswer={answer} onReplay={d.startReplay} />}
                {d.phase === "call" && (
                  <CallScreen
                    mode={d.mode}
                    lang={d.lang}
                    captions={d.captions}
                    level={d.call.level}
                    state={d.call.state}
                    step={d.call.step}
                    elapsed={elapsed}
                    muted={d.call.muted}
                    onMute={d.call.toggleMute}
                    onEnd={() => void d.call.stop()}
                    error={d.error ?? d.call.error?.message ?? null}
                    needsTap={d.call.needsTap}
                    onTapToHear={d.call.tapToHear}
                    onFallback={d.mode === "live" && !d.status?.decision && (d.call.error || d.call.state === "ended") ? () => void d.startReplay() : undefined}
                    onReconnect={
                      d.mode === "live" && !d.status?.decision && d.call.endReason === "remote-hangup" && !d.call.error?.fallback ? () => void d.startLive() : undefined
                    }
                  />
                )}
                {d.phase === "outcome" && d.status?.decision && <OutcomeScreen status={d.status} lang={d.lang} onAgain={d.reset} />}
              </motion.div>
            </AnimatePresence>
          </Phone>
        </div>
        {d.error && d.phase === "pay" && (
          <div role="status" className="mx-auto mt-3 flex max-w-[340px] items-start justify-between gap-3 rounded-2xl border border-hair bg-paper-2 px-4 py-3">
            <p className="text-[13px] leading-snug text-ink-2">{d.error}</p>
            <button onClick={() => void d.pay()} className="ring-focus shrink-0 rounded-full border border-hair px-3 py-1 text-[12.5px] font-semibold text-ink hover:border-[var(--hair-strong)]">
              Try again
            </button>
          </div>
        )}
      </div>

      <EnginePanel d={d} elapsed={elapsed} compact={compact} liveAvailable={liveAvailable} />
      </div>
      <AccessDialog
        open={askCode}
        onClose={() => setAskCode(false)}
        onOk={() => {
          setAskCode(false);
          void d.startLive();
        }}
      />
    </div>
  );
}

function Controls({ d, list, locked }: { d: DemoState; list: DemoScenarioView[]; locked: boolean }) {
  if (locked) {
    // After Pay the picker collapses to one line, so the phone and the engine panel fit below the nav.
    const title = list.find((s) => s.id === d.scenario)?.title ?? "";
    return (
      <div className="flex min-h-[40px] items-center gap-2 overflow-hidden">
        <span className="truncate rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper">{title}</span>
        <span className="shrink-0 rounded-full border border-hair px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">{LANG_LABEL[d.lang]}</span>
        <button onClick={d.reset} className="ring-focus ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Scenario" className="flex flex-wrap gap-1.5">
        {list.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={d.scenario === s.id}
            disabled={locked}
            onClick={() => d.setScenario(s.id)}
            title={s.blurb}
            className={cn(
              "ring-focus rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
              d.scenario === s.id ? "border-transparent bg-ink text-paper" : "border-hair text-ink-2 hover:border-[var(--hair-strong)] hover:text-ink",
            )}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Language" className="inline-flex items-center gap-1 rounded-full border border-hair p-1">
          <Languages size={14} className="ml-1.5 text-muted" aria-hidden />
          {(["en", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={d.lang === l}
              onClick={() => d.setLang(l)}
              className={cn("ring-focus rounded-full px-3 py-1 text-[12.5px] font-semibold transition", d.lang === l ? "bg-paper-3 text-ink" : "text-muted hover:text-ink")}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

function Lane({ label, state, tone, children }: { label: string; state: string; tone: "idle" | "live" | "done" | "warn"; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hair bg-paper-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="t-eyebrow !text-[11px]">{label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-semibold",
            tone === "live" ? "text-go" : tone === "warn" ? "text-accent" : tone === "done" ? "text-ink-2" : "text-muted",
          )}
        >
          {tone === "live" && <span className="size-1.5 rounded-full bg-go" aria-hidden />}
          {state}
        </span>
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function EnginePanel({ d, elapsed, compact, liveAvailable }: { d: DemoState; elapsed: number; compact: boolean; liveAvailable: boolean }) {
  const s = d.status;
  const callState =
    d.mode === "live"
      ? d.call.state === "active"
        ? "on the call"
        : d.call.state
      : d.mode === "replay"
        ? s?.decision
          ? "finished"
          : "replaying"
        : d.phase === "hold"
          ? "ringing"
          : "idle";
  const contact = s?.contact?.status ?? "not_requested";
  const tc = s?.trusted_contact ?? null;
  const contactLabel: Record<string, string> = {
    not_requested: "not needed yet",
    consent_declined: "customer said no",
    no_contact_on_file: "none on file",
    dialing: "dialling",
    ringing_web: "ringing",
    reached: "reached",
    no_answer: "no answer",
    not_configured: "not configured",
    simulated: "simulated in replay",
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
      className={cn("card flex min-h-[360px] min-w-0 flex-col p-5 md:p-6 lg:min-h-[560px]", compact && "lg:min-h-[640px]")}
      aria-label="Ruko engine"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-display text-[16px] font-semibold text-ink">Ruko engine</h3>
        {d.check && <code className="font-mono text-[11.5px] text-muted">{d.check.id}</code>}
        <span className="ml-auto font-mono text-[12px] tabular-nums text-muted">{d.startedAt ? `${(elapsed / 1000).toFixed(1)}s since hold` : ""}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">
        {d.mode === "live"
          ? "Live: a real Bolna voice agent in your browser. Every row below is a real tool call into Ruko's API."
          : d.mode === "replay"
            ? "Recorded run: a text-mode conversation (no audio). Its tool calls replay into the live engine, so the decision is computed now."
            : d.check
              ? `Held ${formatINR(s?.amount_inr ?? 0)} to ${s?.payee_name ?? ""}. ${liveAvailable ? "Answer live, or watch the recorded run." : "Watch the recorded run."}`
              : "Pick a scenario and press Pay. Ruko scores the payment before any money moves."}
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <Lane
          label="Customer call"
          state={callState}
          tone={d.mode === "live" && d.call.state === "active" ? "live" : d.phase === "hold" ? "warn" : s?.decision ? "done" : "idle"}
        >
          {d.mode === "live" && (
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hair)]" aria-hidden>
              <LevelBar level={d.call.level} />
            </div>
          )}
          {d.mode === "replay" && d.captions.length > 0 && (
            <p className="line-clamp-2 text-[12.5px] text-ink-2">
              <span className="font-semibold text-ink">{d.captions[d.captions.length - 1].role === "agent" ? "Ruko: " : "Customer: "}</span>
              {d.captions[d.captions.length - 1].text}
            </p>
          )}
        </Lane>
        <Lane
          label={tc ? `Trusted contact · ${tc.name} (${tc.relation})` : "Trusted contact"}
          state={tc ? contactLabel[contact] ?? contact : "none on file"}
          tone={contact === "ringing_web" || contact === "dialing" ? "warn" : contact === "reached" ? "done" : d.contactCall.state === "active" ? "live" : "idle"}
        >
          {contact === "ringing_web" && d.mode === "live" && d.contactCall.state !== "active" && d.contactCall.state !== "ended" && (
            <button
              onClick={() => void d.answerContact()}
              className="ring-focus inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:-translate-y-px"
            >
              <PhoneIncoming size={14} /> Answer as {tc?.name}
            </button>
          )}
          {d.contactCall.state === "active" && <p className="text-[12.5px] text-go">You're on the call as {tc?.name}.</p>}
          {contact === "ringing_web" && d.mode !== "live" && <p className="text-[12.5px] text-muted">In a live call, {tc?.name}'s phone rings here as a second Bolna call.</p>}
        </Lane>
      </div>

      {d.check && <RiskCard d={d} />}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-none">
        <Timeline status={s} hideCreated={Boolean(d.check)} />
      </div>

      {s?.decision && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-4 rounded-2xl border p-4",
            s.decision.outcome === "release" ? "border-[color-mix(in_oklab,var(--go)_35%,transparent)] bg-go-soft" : "glow-coral border-transparent bg-stop-soft",
          )}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn("font-display text-[20px] font-semibold", s.decision.outcome === "release" ? "text-go" : "text-stop")}>
              {s.decision.outcome === "release" ? "Released" : s.decision.outcome === "block" ? "Blocked" : "Delayed"}
            </span>
            {s.decision.pattern && <span className="text-[13px] font-semibold text-ink">{s.decision.pattern.name}</span>}
            <span className="ml-auto text-[12px] text-muted">decided by policy, not by the LLM</span>
          </div>
          {s.decision.escalated_over_agent && s.decision.agent_recommendation && (
            <p className="mt-1.5 text-[12.5px] text-ink-2">
              The assistant recommended “{s.decision.agent_recommendation}”; the recorded evidence required “{s.decision.outcome}”.
            </p>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}

/** The pre-payment risk decision, shown the instant the payment is held: score, every rule that fired, and what happens next. */
function RiskCard({ d }: { d: DemoState }) {
  const c = d.check!;
  const reduce = useReducedMotion();
  const hold = c.action === "hold";
  const decided = Boolean(d.status?.decision);
  const next = !hold
    ? "ALLOW → payment sent, no call"
    : decided
      ? "HOLD → call finished, policy decided"
      : d.phase === "call"
        ? d.mode === "live"
          ? "HOLD → on the call with the customer"
          : "HOLD → replaying the recorded call"
        : "HOLD → calling the customer";
  const reasons = c.risk.reasons;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("mt-4 rounded-2xl border p-4", hold ? "glow-coral border-transparent bg-stop-soft" : "border-[color-mix(in_oklab,var(--go)_35%,transparent)] bg-go-soft")}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="t-eyebrow !text-[11px]">Pre-payment risk</span>
        <span className={cn("t-num text-[26px] leading-none", hold ? "text-stop" : "text-go")}>
          {c.risk.score}
          <span className="text-[14px] text-muted">/100</span>
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">{c.risk.band}</span>
        <span className={cn("ml-auto inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold", hold ? "text-stop" : "text-go")}>
          {next}
          {hold && !decided && <span className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--coral)]" aria-hidden />}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {reasons.map((r, i) => (
          <motion.li
            key={r.code}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.08 * i }}
            className="flex items-start gap-2.5"
          >
            <span className={cn("mt-0.5 w-9 shrink-0 text-right font-mono text-[12px] tabular-nums", r.weight > 0 ? "text-stop" : "text-go")}>
              {r.weight > 0 ? `+${r.weight}` : r.weight}
            </span>
            <span className="min-w-0 text-[12.5px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">{r.title}</span>
              {r.hard && <span className="ml-1.5 rounded-full border border-hair px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-2">always holds</span>}
              <span className="block truncate text-muted">{r.detail}</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

/** The agent's audio level, driven by a MotionValue (no React re-render per update). */
function LevelBar({ level }: { level: MotionValue<number> }) {
  const width = useTransform(level, (v) => `${Math.min(100, v * 140)}%`);
  return <motion.div className="h-full rounded-full bg-go" style={{ width }} />;
}
