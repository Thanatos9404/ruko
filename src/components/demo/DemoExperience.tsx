import { AnimatePresence, motion } from "motion/react";
import { Languages, PhoneIncoming, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../../../shared/types";
import { formatINR } from "../../../shared/format";
import { api, type DemoScenarioView, type LiveStatus } from "../../lib/api";
import { cn, EASE } from "../../kit";
import { Phone } from "./Phone";
import { AllowedScreen, CallScreen, HoldScreen, OutcomeScreen, PayScreen } from "./Screens";
import { Timeline } from "./Timeline";
import { AccessDialog } from "./AccessDialog";
import { readAccessCode, useDemo, type DemoState } from "./useDemo";

const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी" };

/**
 * The sandbox payment, end to end: a phone running a demo bank app on the
 * left, Ruko's engine on the right, updating as each tool call lands.
 */
export function DemoExperience({ compact = false, scenarios: only }: { compact?: boolean; scenarios?: string[] }) {
  const d = useDemo();
  const [scenarios, setScenarios] = useState<DemoScenarioView[]>([]);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [askCode, setAskCode] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.scenarios().then((r) => setScenarios(r.data)).catch(() => setScenarios([]));
    api.liveStatus().then(setLive).catch(() => setLive(null));
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const list = useMemo(() => (only ? scenarios.filter((s) => only.includes(s.id)) : scenarios), [scenarios, only]);
  const sc = scenarios.find((s) => s.id === d.scenario);
  const liveAvailable = Boolean(live && (live.live || live.reason === "daily_cap") && live.reason !== "not_configured");

  const answer = () => {
    if (readAccessCode()) void d.startLive();
    else setAskCode(true);
  };
  const elapsed = d.startedAt ? now - d.startedAt : 0;
  const locked = d.phase !== "pay";

  return (
    <div className={cn("grid gap-6 lg:gap-10", compact ? "lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:grid-cols-[360px_minmax(0,1fr)]")}>
      <div>
        <Controls d={d} list={list} locked={locked} />
        <div className="mt-4">
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
                    elapsed={elapsed}
                    muted={d.call.muted}
                    onMute={d.call.toggleMute}
                    onEnd={() => void d.call.stop()}
                    error={d.error ?? d.call.error?.message ?? null}
                  />
                )}
                {d.phase === "outcome" && d.status?.decision && <OutcomeScreen status={d.status} lang={d.lang} onAgain={d.reset} />}
              </motion.div>
            </AnimatePresence>
          </Phone>
        </div>
        {d.error && d.phase === "pay" && <p className="mt-3 text-center text-[13px] text-stop">{d.error}</p>}
      </div>

      <EnginePanel d={d} elapsed={elapsed} compact={compact} liveAvailable={liveAvailable} />
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
              "ring-focus rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed",
              d.scenario === s.id ? "border-transparent bg-ink text-paper" : "border-hair text-ink-2 hover:border-[var(--hair-strong)] hover:text-ink disabled:opacity-50",
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
              disabled={locked}
              onClick={() => d.setLang(l)}
              className={cn("ring-focus rounded-full px-3 py-1 text-[12.5px] font-semibold transition", d.lang === l ? "bg-paper-3 text-ink" : "text-muted hover:text-ink")}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        {locked && (
          <button onClick={d.reset} className="ring-focus inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
            <RotateCcw size={14} /> Reset
          </button>
        )}
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
      className={cn("card flex min-h-[360px] flex-col p-5 md:p-6 lg:min-h-[560px]", compact && "lg:min-h-[640px]")}
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
              <div className="h-full rounded-full bg-go transition-[width] duration-100" style={{ width: `${Math.min(100, d.call.level * 140)}%` }} />
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
              onClick={() => void d.contactCall.start()}
              className="ring-focus inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:-translate-y-px"
            >
              <PhoneIncoming size={14} /> Answer as {tc?.name}
            </button>
          )}
          {d.contactCall.state === "active" && <p className="text-[12.5px] text-go">You're on the call as {tc?.name}.</p>}
          {contact === "ringing_web" && d.mode !== "live" && <p className="text-[12.5px] text-muted">In a live call, {tc?.name}'s phone rings here as a second Bolna call.</p>}
        </Lane>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-none">
        <Timeline status={s} />
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
