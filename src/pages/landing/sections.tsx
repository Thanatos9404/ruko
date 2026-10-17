import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Braces,
  FileSearch,
  Gauge,
  Globe2,
  KeyRound,
  Languages,
  Layers,
  PhoneForwarded,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";
import { Bento, BentoCard, Button, cn, EASE, Reveal, ScrollWords, SectionHeader, Stagger, StaggerItem } from "../../kit";
import { PixelWord } from "../../components/PixelWord";
import { RukoMark } from "../../components/brand/RukoLogo";
import { useEvalResults, pct, frac, type PublishedRun } from "../../lib/useEvalResults";

const cite = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline decoration-[var(--hair-strong)] underline-offset-2 hover:text-ink">
    {label}
  </a>
);

export function Problem() {
  return (
    <section id="problem" className="section-y relative">
      <div className="container-x">
        <Reveal className="mx-auto mb-10 h-[clamp(70px,11vw,150px)] w-[min(560px,80vw)]">
          <PixelWord text="Ruko." accentLast className="h-full w-full" />
        </Reveal>
        <p className="t-eyebrow mb-6 text-center">Hindi for “wait”</p>
        <ScrollWords text="In 2024, Indians reported ₹22,845 crore lost to cyber fraud. In the scams that hurt most, the victim pressed *Pay* themselves." />
        <Stagger className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              n: "₹1,935 cr",
              l: "lost to 'digital arrest' scams in 2024, across 1,23,672 incidents",
              s: cite("https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf", "MHA, Rajya Sabha, 12 Mar 2025"),
            },
            {
              n: "98.5%",
              l: "of fraud value sits in payments above ₹10,000, the ones a bank can afford to pause",
              s: cite("https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810", "RBI discussion paper, Apr 2026"),
            },
            {
              n: "Live",
              l: "Fraudsters increasingly stay on a live call to talk victims through the payment, so OTPs and pop-ups don't stop them.",
              s: cite("https://www.businesstoday.in/industry/banks/story/what-a-new-report-says-about-indias-digital-banking-frauds-545803-2026-07-28", "BioCatch India report, 2026"),
            },
          ].map((x) => (
            <StaggerItem key={x.n} className="card p-6">
              <p className="t-num text-[40px] leading-none text-ink">{x.n}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{x.l}</p>
              <p className="mt-4 text-[12px] text-muted">Source: {x.s}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mx-auto mt-10 max-w-[64ch] text-center">
          <p className="t-lead">
            A scam call is a spell: fear, urgency, secrecy. Pop-ups and SMS don't break it. A calm voice asking the right question, in your own language, before the money moves, does.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Beat({ n, title, body, visual }: { n: string; title: string; body: ReactNode; visual: ReactNode }) {
  return (
    <StaggerItem className="relative flex flex-col">
      <div className="card relative flex h-[200px] items-center justify-center overflow-hidden">{visual}</div>
      <p className="t-eyebrow mt-5">{n}</p>
      <h3 className="t-h3 mt-2">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
    </StaggerItem>
  );
}

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="section-y border-t border-hair">
      <div className="container-x">
        <SectionHeader eyebrow="How it works" title={<>Hold. Call. <span className="t-serif">Decide.</span></>} lead="Three beats, about a minute, and every step is explained in the audit trail the bank keeps." />
        <Stagger className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          <Beat
            n="01 · Hold"
            title="The payment pauses"
            body="The bank sends Ruko the payment and its own signals. A transparent policy scores it: a new payee, a large amount, a 'safe account' name, a phone call active while paying. Risky payments are held. Everything else goes straight through."
            visual={
              <div className="w-[78%] space-y-2">
                {[
                  ["+27", "On a call while paying"],
                  ["+35", "Payee looks like a 'safe account'"],
                  ["+15", "First payment to this payee"],
                ].map(([w, t], i) => (
                  <motion.div
                    key={t}
                    initial={reduce ? false : { opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 * i, duration: 0.5, ease: EASE }}
                    className="flex items-center gap-3 rounded-xl border border-hair bg-paper-2 px-3 py-2"
                  >
                    <span className="font-mono text-[12px] text-stop">{w}</span>
                    <span className="text-[13px] text-ink-2">{t}</span>
                  </motion.div>
                ))}
                <p className="pt-1 text-right font-mono text-[12px] font-semibold text-stop">HOLD → calling</p>
              </div>
            }
          />
          <Beat
            n="02 · Call"
            title="Ruko calls, in their language"
            body="Within seconds, a Bolna voice agent calls the customer. It says the code word shown in their app first, so it can't be spoofed, and asks what fraud teams ask. If it hears a scam, it says the official truth out loud, and with consent it rings the customer's trusted family contact."
            visual={
              <div className="flex flex-col items-center">
                <RukoMark motion="live" className="h-24 w-24 text-ink" title="" />
                <p className="mt-3 rounded-full border border-hair bg-paper-2 px-3 py-1 font-display text-[14px] font-semibold tracking-[0.06em]">NEEM 42</p>
              </div>
            }
          />
          <Beat
            n="03 · Decide"
            title="Policy decides, not the LLM"
            body="The agent records what it hears as signals with evidence quotes. A deterministic policy releases, delays or blocks, and the agent can make it stricter but never more lenient. The bank gets the transcript, the signals and every reason."
            visual={
              <div className="grid w-[78%] gap-2">
                <span className="rounded-xl bg-stop-soft px-3 py-2 text-[13px] font-semibold text-stop">Blocked · Digital arrest</span>
                <span className="rounded-xl border border-hair px-3 py-2 text-[12.5px] text-ink-2">2 critical signs: authority threat, coached on call</span>
                <span className="rounded-xl border border-hair px-3 py-2 text-[12.5px] text-ink-2">Agent said “delay”; evidence required “block”</span>
              </div>
            }
          />
        </Stagger>
      </div>
    </section>
  );
}

function RateTile({ label, rate, hint, good = "high" }: { label: string; rate: PublishedRun["scam_catch"] | null | undefined; hint: string; good?: "high" | "low" }) {
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className={cn("t-num mt-3 text-[40px] leading-none", good === "high" ? "text-go" : rate && rate.rate > 0.05 ? "text-stop" : "text-go")}>{pct(rate, 1)}</p>
      <p className="mt-2 font-mono text-[12px] text-muted">
        {frac(rate)}
        {rate ? ` · 95% CI ${(rate.ci95[0] * 100).toFixed(0)}–${(rate.ci95[1] * 100).toFixed(0)}%` : ""}
      </p>
      <p className="mt-3 text-[12.5px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

export function Results() {
  const ev = useEvalResults();
  const dev = ev?.current.find((r) => r.set === "dev");
  const fresh = ev?.current.find((r) => r.clean_holdout);
  return (
    <section id="results" className="section-y border-t border-hair">
      <div className="container-x">
        <SectionHeader
          eyebrow="Results · measured, not claimed"
          title={<>It catches the scam and lets <span className="t-serif">rent</span> through.</>}
          lead="We ran Ruko's agent and policy against LLM-played customers: coached victims of ten scam types, genuine payers and ambiguous cases, in English, Hindi and Hinglish."
        />
        <Reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <RateTile label="Scams caught, fresh held-out set" rate={fresh?.scam_catch} hint="Stories written after tuning and never used to tune anything." />
          <RateTile label="False holds on genuine payments, held-out" rate={fresh?.false_hold} good="low" hint="Society maintenance, a garage bill, a clinic fee, a wedding photographer: genuine payments delayed or blocked in error." />
          <RateTile label="Scams caught, development set" rate={dev?.scam_catch} hint="60 coached-victim calls across ten patterns, two coaching levels." />
          <div className="card p-5">
            <p className="text-[13px] font-medium text-ink-2">Times the agent asked for an OTP or PIN</p>
            <p className="t-num mt-3 text-[40px] leading-none text-go">{ev ? ev.totals.otp_requests : "–"}</p>
            <p className="mt-2 font-mono text-[12px] text-muted">{ev ? `${ev.totals.agent_turns.toLocaleString("en-IN")} agent turns · ${ev.totals.conversations} calls` : ""}</p>
            <p className="mt-3 text-[12.5px] leading-snug text-muted">Every mention was checked by a separate judge model.</p>
          </div>
        </Reveal>
        <Reveal className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-[13px] font-medium text-ink-2">Median customer turns to a decision</p>
            <p className="t-num mt-2 text-[30px]">{dev?.median_turns ?? "–"}</p>
          </div>
          <div className="card p-5">
            <p className="text-[13px] font-medium text-ink-2">Median time to decision (estimated)</p>
            <p className="t-num mt-2 text-[30px]">{dev?.median_seconds ? `${dev.median_seconds} s` : "–"}</p>
            <p className="mt-1 text-[12px] text-muted">From transcript length at speaking pace, not measured on calls.</p>
          </div>
          <div className="card p-5">
            <p className="text-[13px] font-medium text-ink-2">Tool endpoint latency</p>
            <p className="t-num mt-2 text-[30px]">{ev?.tool_latency_ms ? `${ev.tool_latency_ms.p50} ms` : "–"}</p>
            <p className="mt-1 text-[12px] text-muted">{ev?.tool_latency_ms ? `p50; p95 ${ev.tool_latency_ms.p95} ms; ${ev.tool_latency_ms.where}` : ""}</p>
          </div>
        </Reveal>
        <Reveal className="mt-6 rounded-2xl border border-hair bg-paper-2 p-5 text-[13.5px] leading-relaxed text-ink-2">
          <strong className="text-ink">How to read this.</strong> Text mode: an LLM plays the customer, and the agent is a Nebius-hosted stand-in ({ev?.agent_model ?? "Qwen3-30B-A3B"}) for Bolna's gpt-4.1-mini, running the same prompt, greeting and tools against the real engine. No audio. The weakest spot is the heavily coached customer who sticks to a cover story; in the earlier clean held-out run, half of them got through. Full reports, misses and transcripts are in the <a className="underline underline-offset-2 hover:text-ink" href="/console/eval">evaluation console</a>.
        </Reveal>
      </div>
    </section>
  );
}

const BOLNA: { icon: ReactNode; title: string; body: string; status: "live" | "configured" | "documented" }[] = [
  { icon: <AudioLines />, title: "Voice agents (Agent API v2)", body: "Three agents built and kept in sync over the API: the payment safety check, the trusted-contact call and the public safety line. All saved unrestricted under Bolna's content-safety checks.", status: "live" },
  { icon: <Languages />, title: "Multilingual, mid-call switching", body: "English and Hindi, with the call starting in the customer's language and switching if they do. Hinglish is handled by the Hindi stack (Sarvam saaras:v3 + bulbul:v3).", status: "configured" },
  { icon: <Braces />, title: "Custom functions", body: "Five tools call Ruko mid-call: get_check_context, record_signal, call_trusted_contact, check_trusted_contact, set_decision. Prompt variables fill check_id and the call reference.", status: "live" },
  { icon: <Globe2 />, title: "Web Call SDK", body: "The demo and the public line call in the browser. Sessions are minted server-side, single-use, behind an access code, daily caps and a wallet floor.", status: "live" },
  { icon: <Webhook />, title: "Execution webhooks", body: "Token-protected, idempotent per execution and status, and every terminal event is re-read from Bolna's API before it can change a decision.", status: "live" },
  { icon: <Gauge />, title: "Preferred models, flat rate", body: "gpt-4.1-mini, Deepgram nova-3, Sarvam saaras:v3, ElevenLabs turbo v2.5 and Sarvam bulbul:v3: all inside Bolna's flat per-minute rate.", status: "configured" },
  { icon: <PhoneForwarded />, title: "Transfer to a human fraud desk", body: "For banks that need a human in the loop (the UK's FCA expects one), the agent's transfer tool hands the call to the bank's fraud desk number.", status: "documented" },
  { icon: <Layers />, title: "Batch calls for back-testing", body: "A bank can replay last quarter's flagged payments as a Bolna batch against consenting staff, to tune the policy before going live.", status: "documented" },
];

export function BuiltOnBolna() {
  return (
    <section id="bolna" className="section-y border-t border-hair">
      <div className="container-x">
        <SectionHeader eyebrow="Built on Bolna" title={<>Voice is the <span className="t-serif">product.</span></>} lead="Ruko is a thin, careful layer on Bolna's voice stack. Here is every Bolna feature it uses, and how." />
        <Bento className="mt-14">
          {BOLNA.map((f, i) => (
            <BentoCard
              key={f.title}
              span={i < 2 ? 6 : 4}
              icon={<span className="[&>svg]:size-[18px] [&>svg]:stroke-[1.7]">{f.icon}</span>}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {f.title}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                      f.status === "live" ? "bg-go-soft text-go" : f.status === "configured" ? "bg-paper-3 text-ink-2" : "border border-hair text-muted",
                    )}
                  >
                    {f.status === "live" ? "in use" : f.status}
                  </span>
                </span>
              }
              body={f.body}
            />
          ))}
        </Bento>
        <Reveal className="mt-10">
          <Architecture />
        </Reveal>
      </div>
    </section>
  );
}

function Architecture() {
  const box = "rounded-2xl border border-hair bg-paper-2 px-4 py-3";
  return (
    <div className="card p-5 sm:p-6">
      <p className="t-eyebrow mb-5">Architecture</p>
      {/* Stacks top to bottom on phones; flows left to right on wide screens. */}
      <div className="grid grid-cols-1 items-center gap-3 text-[13px] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1fr)] lg:gap-4">
        <div className="space-y-3">
          <div className={box}>
            <p className="font-semibold text-ink">Bank / UPI app</p>
            <p className="text-muted">POST /v1/checks with payment, profile and device signals</p>
          </div>
          <div className={box}>
            <p className="font-semibold text-ink">Customer's app</p>
            <p className="text-muted">Code word, app status, Web Call SDK</p>
          </div>
        </div>
        <ArrowRight aria-hidden className="justify-self-center rotate-90 text-muted lg:rotate-0" size={18} />
        <div className="rounded-2xl border border-[color-mix(in_oklab,var(--coral)_45%,transparent)] bg-stop-soft p-4">
          <p className="font-display text-[15px] font-semibold text-ink">Ruko API (Vercel)</p>
          <ul className="mt-2 space-y-1 text-ink-2">
            <li>Risk policy · named rules</li>
            <li>Tool endpoints for the agent</li>
            <li>Decision policy · audit trail</li>
            <li>Webhook with fetch-back verification</li>
            <li>Live-call gate · wallet floor</li>
          </ul>
        </div>
        <div aria-hidden className="flex items-center justify-center gap-1 text-muted lg:flex-col">
          <ArrowRight size={18} className="rotate-90 lg:rotate-0" />
          <ArrowRight size={18} className="-rotate-90 lg:rotate-180" />
        </div>
        <div className="space-y-3">
          <div className={box}>
            <p className="font-semibold text-ink">Bolna voice agents</p>
            <p className="text-muted">Safety check · trusted contact · public line</p>
          </div>
          <div className={box}>
            <p className="font-semibold text-ink">Fraud-ops console</p>
            <p className="text-muted">Transcripts, signals, reasons, metrics</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Business() {
  return (
    <section id="business" className="section-y border-t border-hair">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal>
          <p className="t-eyebrow mb-4">Business</p>
          <h2 className="t-h2">Banks pay per check. Customers keep their savings.</h2>
          <div className="t-lead mt-5 space-y-4">
            <p>
              Ruko is an API for banks, UPI apps and NBFCs. They pay per completed voice check, and nothing for the payments that pass. A one-minute call costs a few rupees of voice AI on Bolna's flat rate. A coached victim loses lakhs.
            </p>
            <p>
              The rules are moving our way. RBI's 2026 directions make banks share losses from coerced payments and count “specific, directed and clear warnings” from the bank. A spoken warning that names the scam is exactly that. In the UK, banks already reimburse push-payment scams and may delay a payment to contact the payer.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 text-[13.5px] sm:grid-cols-2">
            {[
              [<Users key="u" />, "Buyer: bank fraud-risk teams"],
              [<ShieldCheck key="s" />, "User: their customers, often parents"],
              [<BadgeCheck key="b" />, "India first, then the UK"],
              [<FileSearch key="f" />, "Every decision explained"],
            ].map(([icon, label]) => (
              <div key={String(label)} className="flex items-center gap-2.5 rounded-full border border-hair px-3.5 py-2.5 text-ink-2 [&>svg]:size-4 [&>svg]:text-ink">
                {icon}
                {label}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/console/integration" variant="glass" icon={<KeyRound size={16} />}>
              API and integration
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-hair px-5 py-3">
              <span className="font-mono text-[12px] text-muted">POST /v1/checks</span>
              <span className="chip bg-stop-soft text-stop">201 · hold</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-ink-2">{`curl https://<ruko>/v1/checks \\
  -H "Authorization: Bearer rk_test_…" \\
  -H "Idempotency-Key: pay-7781" \\
  -d '{
    "payment": { "amount_inr": 190000, "rail": "IMPS",
      "payee": { "name": "Safe Custody Account RBI",
                 "handle": "XXXXXXXX4417", "is_new": true } },
    "customer": { "customer_ref": "c-001", "name": "Kamla",
      "language": "hi", "max_amount_90d": 12000,
      "trusted_contact": { "name": "Ravi", "relation": "son",
        "phone_e164": "+447700900102", "consent_on_file": true } },
    "device": { "active_call": true, "active_call_minutes": 47 }
  }'

→ { "action": "hold", "code_word": "NEEM 42",
    "risk": { "score": 100, "reasons": [ … ] },
    "client_secret": "cs_…" }`}</pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FreeChecker() {
  return (
    <section id="free" className="section-y border-t border-hair">
      <div className="container-x">
        <Reveal className="card relative overflow-hidden p-8 md:p-12">
          <div className="relative z-10 grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <p className="t-eyebrow mb-4">Free for everyone</p>
              <h2 className="t-h2">Got a strange call? Ask Ruko.</h2>
              <p className="t-lead mt-4 max-w-[48ch]">
                Describe it in English or Hindi. Ruko matches it against official advisories and tells you what to do, with the 1930 helpline and Chakshu a tap away. No sign-up, and nothing personal is kept.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/check" icon={<ArrowRight size={16} />}>
                  Is this a scam?
                </Button>
              </div>
            </div>
            <div className="space-y-2.5">
              <p className="ml-auto max-w-[90%] rounded-2xl bg-ink px-4 py-3 text-[14px] text-paper">A man from 'CBI' on video call says I'm under digital arrest…</p>
              <div className="max-w-[92%] rounded-2xl border border-hair bg-paper-2 p-4">
                <span className="chip bg-stop-soft text-stop">Very likely a scam</span>
                <p className="mt-2 border-l-2 border-[var(--coral)] pl-3 text-[14px] font-medium text-ink">There's no 'digital arrest' in Indian law. Police or CBI never question anyone on a video call.</p>
                <p className="mt-2 text-[12px] text-muted">Source: I4C advisory TAU/ADV/003; PM, Mann Ki Baat 115</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export const motionEase = EASE;
