import type { CallStep } from "../../lib/useBolnaCall";
import { type MotionValue, motion, useReducedMotion } from "motion/react";
import { Check, Loader2, Mic, MicOff, PhoneOff, ShieldAlert, ShieldCheck, ShieldX, Smartphone } from "lucide-react";
import type { AppStatus, Lang } from "../../../shared/types";
import { formatINR, minutesLabel } from "../../../shared/format";
import type { DemoCheck, DemoScenarioView } from "../../lib/api";
import { cn, EASE } from "../../kit";
import { Arcs } from "../Arcs";
import { RukoMark, RukoWordmark } from "../brand/RukoLogo";
import { StatusBar } from "./Phone";
import { codeWordFor, type Caption, type Mode } from "./useDemo";

const enter = { initial: { opacity: 0, y: 12, filter: "blur(6px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.45, ease: EASE } };

const T = {
  en: {
    paying: "Paying",
    first: "First payment to this payee",
    simulated: "device signal (simulated)",
    onCall: (m?: number) => `On a phone call${m ? ` · ${m} min` : ""}`,
    pay: "Pay",
    checking: "Checking with Ruko",
    paused: "Payment paused",
    calling: "Your bank is calling you now to check it's really you. The assistant will say this code word first:",
    neverOtp: "Ruko never asks for your OTP, PIN or card details.",
    codeLabel: "Code word",
    neverRead: "Never read this code to anyone. Ruko says it to you.",
    answer: "Answer the call",
    replay: "Watch the recorded run",
    sent: "Payment sent",
    stopped: "Payment stopped",
    held: "Payment on hold",
    why: "Why",
    again: "Try another payment",
  },
  hi: {
    paying: "भुगतान",
    first: "इस व्यक्ति को पहला भुगतान",
    simulated: "डिवाइस संकेत (सिम्युलेटेड)",
    onCall: (m?: number) => `फ़ोन कॉल पर${m ? ` · ${m} मिनट` : ""}`,
    pay: "भुगतान करें",
    checking: "रुको से जाँच",
    paused: "भुगतान रुका है",
    calling: "आपका बैंक अभी आपको कॉल कर रहा है। सहायक सबसे पहले यह कोड शब्द बोलेगी:",
    neverOtp: "रुको कभी आपका ओटीपी, पिन या कार्ड नंबर नहीं माँगता।",
    codeLabel: "कोड शब्द",
    neverRead: "यह कोड किसी को पढ़कर न सुनाएँ। रुको इसे आपको बोलती है।",
    answer: "कॉल उठाएँ",
    replay: "रिकॉर्डेड रन देखें",
    sent: "भुगतान भेजा गया",
    stopped: "भुगतान रोका गया",
    held: "भुगतान होल्ड पर",
    why: "क्यों",
    again: "दूसरा भुगतान आज़माएँ",
  },
};

function AppHeader({ bank }: { bank: string }) {
  return (
    <div className="flex items-center justify-between px-5 pb-3 pt-1">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-[#1b2638] text-[11px] font-bold text-[#cfe0f5]">DB</span>
        <span className="font-display text-[14px] font-semibold text-ink">{bank}</span>
      </div>
      <span className="rounded-full border border-hair px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Sandbox</span>
    </div>
  );
}

export function PayScreen({
  scenario,
  lang,
  busy,
  onPay,
  bank,
}: {
  scenario: DemoScenarioView | undefined;
  lang: Lang;
  busy: boolean;
  onPay: () => void;
  bank: string;
}) {
  const t = T[lang];
  if (!scenario) return <div className="grid flex-1 place-items-center text-muted"><Loader2 className="animate-spin" /></div>;
  const p = scenario.payment;
  const initials = p.payee.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <motion.div {...enter} className="flex flex-1 flex-col">
      <StatusBar />
      <AppHeader bank={bank} />
      <div className="flex flex-1 flex-col px-5">
        <p className="t-eyebrow !text-[11px]">{t.paying}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1b2638] font-display text-[15px] font-semibold text-ink">{initials}</span>
          <div className="min-w-0">
            <p className="truncate font-display text-[16px] font-semibold text-ink">{p.payee.name}</p>
            <p className="truncate font-mono text-[11.5px] text-muted">{p.payee.handle}</p>
          </div>
        </div>
        <p className="t-num mt-7 text-[44px] leading-none text-ink">{formatINR(p.amount_inr)}</p>
        <p className="mt-2 text-[12.5px] text-muted">{p.rail}{p.note ? ` · “${p.note}”` : ""}</p>
        <div className="mt-6 space-y-2">
          {p.payee.is_new && (
            <span className="chip bg-[var(--hair)] text-ink-2">
              <Smartphone size={12} /> {t.first}
            </span>
          )}
          {scenario.device.active_call && (
            <div>
              <span className="chip bg-[var(--accent-soft)] text-accent">{t.onCall(scenario.device.active_call_minutes)}</span>
              <span className="ml-2 text-[10.5px] text-muted">{t.simulated}</span>
            </div>
          )}
        </div>
        <div className="mt-auto pb-7">
          <button
            onClick={onPay}
            disabled={busy}
            className="ring-focus flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#eef1f6] font-display text-[16px] font-semibold text-[#161f2e] transition hover:-translate-y-px active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {busy ? t.checking : `${t.pay} ${formatINR(p.amount_inr)}`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function AllowedScreen({ check, scenario, lang, onAgain }: { check: DemoCheck; scenario?: DemoScenarioView; lang: Lang; onAgain: () => void }) {
  const t = T[lang];
  return (
    <motion.div {...enter} className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-go-soft text-go">
        <Check size={30} strokeWidth={2.2} />
      </span>
      <p className="mt-5 font-display text-[22px] font-semibold text-ink">{t.sent}</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {formatINR(scenario?.payment.amount_inr ?? 0)} → {scenario?.payment.payee.name}
      </p>
      <p className="mt-6 max-w-[26ch] text-[12.5px] text-muted">
        Ruko scored this payment {check.risk.score}/100. No hold, no call: genuine payers aren't slowed down.
      </p>
      <button onClick={onAgain} className="ring-focus mt-8 rounded-full border border-hair px-4 py-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
        {t.again}
      </button>
    </motion.div>
  );
}

export function HoldScreen({
  check,
  lang,
  liveAvailable,
  onAnswer,
  onReplay,
  replayLabel,
}: {
  check: Pick<DemoCheck, "code_word">;
  lang: Lang;
  liveAvailable: boolean;
  onAnswer: () => void;
  onReplay: () => void;
  /** Overrides the secondary button's label (the landing preview uses it to start the demo). */
  replayLabel?: string;
}) {
  const t = T[lang];
  const reduce = useReducedMotion();
  const code = codeWordFor(check.code_word, lang);
  return (
    <motion.div {...enter} className="relative flex flex-1 flex-col overflow-hidden bg-[#e46157] text-[#161f2e]">
      <StatusBar tone="dark" />
      <div className="flex flex-1 flex-col px-6 pb-7 pt-4">
        <div className="flex items-center justify-between">
          <RukoWordmark className="h-[15px] w-auto" />
          <ShieldAlert size={20} strokeWidth={1.8} />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#161f2e] p-1.5">
            <RukoMark motion="live" stopped tone="dark" className="h-full w-full text-[#fdfdfb]" title="" />
          </span>
          <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]">{t.paused}</p>
        </div>
        <p className="mt-2 text-[14px] leading-snug text-[#161f2e]">{t.calling}</p>
        <div className="relative mt-6 grid place-items-center rounded-3xl bg-[#161f2e] px-4 py-6 text-[#fdfdfb]">
          {!reduce && <span aria-hidden className="animate-ring absolute inset-0 rounded-3xl border-2 border-[#fdfdfb]/50" />}
          <span className="t-eyebrow !text-[10.5px] !text-[#f7b9b1]">{t.codeLabel}</span>
          <span className="mt-1 font-display text-[34px] font-semibold tracking-[0.04em]" aria-live="polite">
            {code}
          </span>
          <span className="mt-1.5 text-center text-[11.5px] font-medium text-[#f7b9b1]">{t.neverRead}</span>
        </div>
        <p className="mt-4 text-[12.5px] font-medium text-[#161f2e]">{t.neverOtp}</p>
        <div className="mt-auto space-y-2.5">
          {liveAvailable && (
            <button
              onClick={onAnswer}
              className="ring-focus flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#161f2e] font-display text-[15.5px] font-semibold text-[#fdfdfb] transition hover:-translate-y-px"
            >
              <Mic size={17} /> {t.answer}
            </button>
          )}
          <button
            onClick={onReplay}
            className={cn(
              "ring-focus flex h-[46px] w-full items-center justify-center rounded-2xl font-display text-[14.5px] font-semibold transition hover:-translate-y-px",
              liveAvailable ? "border border-[#161f2e]/45 text-[#161f2e]" : "bg-[#161f2e] text-[#fdfdfb]",
            )}
          >
            {replayLabel ?? t.replay}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CallScreen({
  mode,
  lang,
  captions,
  level,
  state,
  step,
  elapsed,
  muted,
  onMute,
  onEnd,
  error,
  onFallback,
  onReconnect,
  needsTap,
  onTapToHear,
}: {
  mode: Mode;
  lang: Lang;
  captions: Caption[];
  level: number | MotionValue<number>;
  state: string;
  /** Live-call progress: securing line → allow mic → ringing → live. */
  step?: CallStep;
  elapsed: number;
  muted: boolean;
  onMute: () => void;
  onEnd: () => void;
  error: string | null;
  /** Offered when a retry won't help right now (caps, capacity, network) or the call dropped. */
  onFallback?: () => void;
  onReconnect?: () => void;
  needsTap?: boolean;
  onTapToHear?: () => void;
}) {
  const last = captions.slice(-3);
  return (
    <motion.div {...enter} className="relative flex flex-1 flex-col overflow-hidden bg-[#0a101b]">
      <Arcs level={mode === "live" ? level : captions.length % 2 ? 0.35 : 0.15} className="opacity-90" />
      <StatusBar />
      <div className="relative z-10 flex flex-1 flex-col px-6 pb-7 pt-6 text-center">
        <span className="mx-auto rounded-full border border-hair px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
          {mode === "live" ? "Live · Bolna web call" : "Recorded run · text, no audio"}
        </span>
        <p className="mt-5 font-display text-[22px] font-semibold text-ink">Ruko</p>
        <p className="text-[13px] text-ink-2">{lang === "hi" ? "डेमो बैंक सुरक्षा जाँच" : "Demo Bank safety check"}</p>
        {mode === "live" && state !== "active" && state !== "ended" ? (
          <CallSteps step={step ?? "securing"} lang={lang} />
        ) : (
          <p className="mt-1 font-mono text-[13px] tabular-nums text-go">{clock(elapsed)}</p>
        )}
        {needsTap && (
          <button onClick={onTapToHear} className="ring-focus mx-auto mt-3 rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-[#0b111c]">
            {lang === "hi" ? "सुनने के लिए टैप करें" : "Tap to hear Ruko"}
          </button>
        )}
        <div className="mt-auto space-y-2 text-left" aria-live="polite">
          {mode === "live" && !captions.length && (
            <p className="rounded-2xl bg-black/40 px-3.5 py-2.5 text-[13px] text-ink-2 backdrop-blur">
              {lang === "hi" ? "रुको से बात करें। वह जो सुनती है, वह दाईं ओर टाइमलाइन में दिखता है।" : "Talk to Ruko. What it hears shows up in the timeline beside the phone."}
            </p>
          )}
          {last.map((c, i) => (
            <motion.p
              key={`${captions.length}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: i === last.length - 1 ? 1 : 0.55, y: 0 }}
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug backdrop-blur",
                c.role === "agent" ? "mr-6 bg-[#16233a]/90 text-[#e6eefb]" : "ml-6 bg-white/10 text-ink",
              )}
            >
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-60">{c.role === "agent" ? "Ruko" : lang === "hi" ? "ग्राहक" : "Customer"}</span>
              {c.text}
            </motion.p>
          ))}
          {error && <p className="rounded-2xl bg-stop-soft px-3.5 py-2.5 text-[12.5px] text-stop">{error}</p>}
          {(onFallback || onReconnect) && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {onReconnect && (
                <button onClick={onReconnect} className="ring-focus rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-white/15">
                  {lang === "hi" ? "फिर से जोड़ें" : "Reconnect"}
                </button>
              )}
              {onFallback && (
                <button onClick={onFallback} className="ring-focus rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-paper">
                  {lang === "hi" ? "रिकॉर्ड किया रन देखें" : "Watch the recorded run"}
                </button>
              )}
            </div>
          )}
        </div>
        {mode === "live" && (
          <div className="mt-5 flex items-center justify-center gap-5">
            <button onClick={onMute} aria-label={muted ? "Unmute" : "Mute"} className="ring-focus grid size-12 place-items-center rounded-full bg-white/10 text-ink hover:bg-white/15">
              {muted ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
            <button onClick={onEnd} aria-label="End call" className="ring-focus grid size-14 place-items-center rounded-full bg-stop text-white hover:brightness-110">
              <PhoneOff size={21} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const STEPS: { id: CallStep; en: string; hi: string }[] = [
  { id: "securing", en: "Securing line", hi: "लाइन जोड़ रहे हैं" },
  { id: "mic", en: "Allow microphone", hi: "माइक की अनुमति दें" },
  { id: "ringing", en: "Ringing", hi: "घंटी बज रही है" },
  { id: "active", en: "Live", hi: "लाइव" },
];

function CallSteps({ step, lang }: { step: CallStep; lang: Lang }) {
  const at = Math.max(0, STEPS.findIndex((s) => s.id === step));
  return (
    <ol aria-label={lang === "hi" ? "कॉल की स्थिति" : "Call progress"} className="mx-auto mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold">
      {STEPS.map((s, i) => (
        <li
          key={s.id}
          aria-current={i === at ? "step" : undefined}
          className={cn("rounded-full px-2 py-0.5", i < at ? "text-go" : i === at ? "bg-white/10 text-ink" : "text-muted")}
        >
          {s[lang]}
        </li>
      ))}
    </ol>
  );
}

export function OutcomeScreen({ status, lang, onAgain }: { status: AppStatus; lang: Lang; onAgain: () => void }) {
  const t = T[lang];
  const d = status.decision!;
  const tone = d.outcome === "release" ? "go" : d.outcome === "block" ? "stop" : "accent";
  const Icon = d.outcome === "release" ? ShieldCheck : d.outcome === "block" ? ShieldX : ShieldAlert;
  const title = d.outcome === "release" ? t.sent : d.outcome === "block" ? t.stopped : `${t.held} · ${minutesLabel(d.delay_minutes)}`;
  return (
    <motion.div {...enter} className="flex flex-1 flex-col">
      <StatusBar />
      <div className="flex flex-1 flex-col px-6 pb-7 pt-6">
        <span className={cn("grid size-14 place-items-center rounded-2xl", tone === "go" ? "bg-go-soft text-go" : tone === "stop" ? "bg-stop-soft text-stop" : "bg-[var(--accent-soft)] text-accent")}>
          <Icon size={28} strokeWidth={1.8} />
        </span>
        <p className={cn("mt-5 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]", tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : "text-accent")}>{title}</p>
        <p className="t-num mt-1 text-[15px] text-ink-2">
          {formatINR(status.amount_inr)} · {status.payee_name}
        </p>
        {d.pattern && (
          <p className="mt-4 inline-flex w-fit rounded-full border border-hair px-3 py-1 text-[12px] font-semibold text-ink">
            {lang === "hi" ? "पहचाना गया पैटर्न" : "Pattern"}: {d.pattern.name}
          </p>
        )}
        <p className="mt-4 text-[13.5px] leading-snug text-ink">{d.customer_message}</p>
        <div className="mt-5">
          <p className="t-eyebrow !text-[10.5px]">{t.why}</p>
          <ul className="mt-2 space-y-1.5">
            {d.reasons.slice(0, 3).map((r) => (
              <li key={r.code} className="text-[12px] leading-snug text-ink-2">
                · {r.text}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={onAgain} className="ring-focus mt-auto rounded-2xl border border-hair py-3 text-[14px] font-semibold text-ink-2 hover:text-ink">
          {t.again}
        </button>
      </div>
    </motion.div>
  );
}
