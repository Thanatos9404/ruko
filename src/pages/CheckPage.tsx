import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, ExternalLink, Loader2, Mic, PhoneCall, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../../shared/types";
import { cn, EASE, Reveal } from "../kit";
import { RukoLogo, RukoMark } from "../components/brand/RukoLogo";
import { useBolnaCall } from "../lib/useBolnaCall";
import { AccessDialog } from "../components/demo/AccessDialog";
import { readAccessCode } from "../components/demo/useDemo";

interface Reply {
  reply: string;
  risk: "likely_scam" | "possible_scam" | "unclear" | "unlikely";
  pattern: { id: string; name: string } | null;
  truth: string | null;
  advice: string[];
  sources: { title: string; publisher: string; url: string }[];
  next_question: string | null;
  method: "llm+library" | "library-only";
}
type Msg = { role: "user"; content: string } | { role: "assistant"; content: string; data: Reply };

interface Stats {
  checks: number;
  conversations: number;
  by_pattern: Record<string, number>;
  other_patterns: number;
  since: string | null;
  counting: boolean;
}

const COPY = {
  en: {
    eyebrow: "Free · no sign-up · nothing personal kept",
    title: "Is this a scam?",
    lead: "Describe the call, message or payment request in your own words. Ruko checks it against official advisories from RBI, I4C, CERT-In and DoT, and tells you what to do.",
    placeholder: "e.g. A man on a video call says he's from CBI and I'm under digital arrest. He wants me to move my savings to an RBI account…",
    examples: [
      "Someone from 'CBI' says I'm under digital arrest and must pay to clear my name",
      "A Telegram job pays me to like videos, now I must deposit ₹18,000 to withdraw",
      "Customer care asked me to install AnyDesk to process my refund",
      "My son's number is off and a caller says he's arrested and needs bail money",
    ],
    send: "Check",
    privacy: "Don't type names, phone numbers, account numbers or codes. Anything that looks like one is removed on our server before it is analysed or stored.",
    voice: "Prefer to talk?",
    voiceLead: "Call the Ruko line in your browser. A Bolna voice agent listens and gives the same official advice.",
    voiceBtn: "Talk to Ruko",
    lost: "Money already gone, or happening right now?",
  },
  hi: {
    eyebrow: "मुफ़्त · कोई साइन-अप नहीं · कोई निजी जानकारी नहीं रखी जाती",
    title: "कहीं यह धोखा तो नहीं?",
    lead: "कॉल, मैसेज या पैसे की माँग के बारे में अपने शब्दों में बताइए। रुको इसे आरबीआई, I4C, CERT-In और दूरसंचार विभाग की आधिकारिक सलाह से मिलाकर बताता है कि क्या करें।",
    placeholder: "जैसे: वीडियो कॉल पर एक आदमी खुद को सीबीआई का बताता है और कहता है कि मैं डिजिटल अरेस्ट में हूँ…",
    examples: [
      "सीबीआई वाला कहता है मैं डिजिटल अरेस्ट में हूँ, नाम साफ़ करने के लिए पैसे भेजो",
      "टेलीग्राम पर वीडियो लाइक करने का काम, अब पैसे निकालने के लिए ₹18,000 जमा करने हैं",
      "कस्टमर केयर ने रिफ़ंड के लिए AnyDesk डालने को कहा",
      "बेटे का फ़ोन बंद है और कोई कहता है वह गिरफ़्तार है, ज़मानत के पैसे चाहिए",
    ],
    send: "जाँचें",
    privacy: "नाम, फ़ोन नंबर, खाता नंबर या कोड न लिखें। ऐसी कोई भी चीज़ जाँच या सहेजने से पहले हमारे सर्वर पर हटा दी जाती है।",
    voice: "बोलकर बताना है?",
    voiceLead: "ब्राउज़र में रुको लाइन पर बात करें। बोलना की वॉइस एजेंट वही आधिकारिक सलाह देगी।",
    voiceBtn: "रुको से बात करें",
    lost: "पैसे चले गए, या अभी हो रहा है?",
  },
};

const RISK: Record<Reply["risk"], { label: Record<Lang, string>; icon: typeof ShieldAlert; tone: string }> = {
  likely_scam: { label: { en: "Very likely a scam", hi: "बहुत संभव है कि यह धोखा है" }, icon: ShieldAlert, tone: "text-stop bg-stop-soft" },
  possible_scam: { label: { en: "Could be a scam", hi: "धोखा हो सकता है" }, icon: ShieldAlert, tone: "text-accent bg-[var(--accent-soft)]" },
  unclear: { label: { en: "Not clear yet", hi: "अभी साफ़ नहीं" }, icon: ShieldQuestion, tone: "text-ink-2 bg-paper-3" },
  unlikely: { label: { en: "No known warning signs", hi: "कोई जानी-पहचानी चेतावनी नहीं" }, icon: ShieldCheck, tone: "text-go bg-go-soft" },
};

export default function CheckPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [askCode, setAskCode] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const t = COPY[lang];

  useEffect(() => {
    fetch("/api/public/stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => setStats(null));
  }, [msgs.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length, busy]);

  const mint = useCallback(async () => {
    const res = await fetch("/api/public/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_code: readAccessCode(), language: lang }) });
    const j = await res.json();
    if (!res.ok) throw Object.assign(new Error(j?.error?.message ?? "Could not start the call"), { code: j?.error?.code });
    return j;
  }, [lang]);
  const call = useBolnaCall(mint);

  const send = async (content: string) => {
    const c = content.trim();
    if (c.length < 8 || busy) return;
    setErr(null);
    const next: Msg[] = [...msgs, { role: "user", content: c }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? "Something went wrong.");
      const data = j as Reply;
      setMsgs((m) => [...m, { role: "assistant", content: data.reply, data }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const topPatterns = stats ? Object.entries(stats.by_pattern).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];

  return (
    <div data-theme="paper" className="min-h-[100dvh] bg-paper text-ink">
      <header className="container-x flex items-center justify-between py-5">
        <a href="/" aria-label="Ruko home">
          <RukoLogo />
        </a>
        <div role="radiogroup" aria-label="Language" className="inline-flex rounded-full border border-hair p-1">
          {(["en", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
              className={cn("ring-focus rounded-full px-3 py-1 text-[13px] font-semibold", lang === l ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
            >
              {l === "en" ? "English" : "हिंदी"}
            </button>
          ))}
        </div>
      </header>

      <main id="main" className="container-x grid gap-10 pb-20 pt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="check-title">
          <Reveal>
            <p className="t-eyebrow">{t.eyebrow}</p>
            <h1 id="check-title" className="t-h2 mt-3">
              {t.title}
            </h1>
            <p className="t-lead mt-4 max-w-[60ch]">{t.lead}</p>
          </Reveal>

          <div className="card mt-8 overflow-hidden">
            <div className="max-h-[56vh] min-h-[180px] space-y-4 overflow-y-auto p-5 md:p-6" aria-live="polite">
              {!msgs.length && (
                <div>
                  <p className="text-[13px] font-semibold text-ink-2">{lang === "hi" ? "उदाहरण" : "Try one"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.examples.map((ex) => (
                      <button key={ex} onClick={() => void send(ex)} className="ring-focus rounded-2xl border border-hair bg-paper-2 px-3.5 py-2 text-left text-[13.5px] text-ink-2 transition hover:-translate-y-px hover:text-ink">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.4, ease: EASE }}>
                    {m.role === "user" ? (
                      <p className="ml-auto max-w-[85%] rounded-2xl bg-ink px-4 py-3 text-[14.5px] leading-relaxed text-paper">{m.content}</p>
                    ) : (
                      <Answer data={m.data} lang={lang} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {busy && (
                <p className="inline-flex items-center gap-2 text-[13px] text-muted">
                  <Loader2 size={15} className="animate-spin" /> {lang === "hi" ? "जाँच हो रही है…" : "Checking against the library…"}
                </p>
              )}
              {err && <p className="text-[13px] text-stop">{err}</p>}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
              className="border-t border-hair p-3 md:p-4"
            >
              <label htmlFor="check-input" className="sr-only">
                {t.title}
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="check-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(text);
                    }
                  }}
                  rows={2}
                  maxLength={800}
                  placeholder={msgs.length ? (lang === "hi" ? "और बताइए…" : "Add a detail or answer the question…") : t.placeholder}
                  className="min-h-[52px] flex-1 resize-none rounded-2xl border border-hair bg-paper-2 px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-[var(--hair-strong)]"
                />
                <button
                  disabled={busy || text.trim().length < 8}
                  aria-label={t.send}
                  className="ring-focus grid size-[52px] shrink-0 place-items-center rounded-2xl bg-ink text-paper transition hover:-translate-y-px disabled:opacity-40"
                >
                  <ArrowUp size={20} />
                </button>
              </div>
              <p className="mt-2 px-1 text-[12px] text-muted">{t.privacy}</p>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[20px] border border-transparent bg-[#161f2e] p-5 text-[#fdfdfb]">
            <p className="font-display text-[15px] font-semibold">{t.lost}</p>
            <a href="tel:1930" className="mt-3 flex items-center gap-2 font-display text-[28px] font-semibold text-[#f7a297]">
              <PhoneCall size={22} /> 1930
            </a>
            <p className="text-[13px] text-[#c2c9d6]">{lang === "hi" ? "राष्ट्रीय साइबर अपराध हेल्पलाइन" : "National cyber crime helpline"}</p>
            <ul className="mt-4 space-y-2 text-[13.5px]">
              <li>
                <a className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline" href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">
                  cybercrime.gov.in <ExternalLink size={13} />
                </a>
              </li>
              <li>
                <a className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline" href="https://sancharsaathi.gov.in/sfc/" target="_blank" rel="noreferrer">
                  {lang === "hi" ? "फ़र्ज़ी कॉल/मैसेज: संचार साथी (चक्षु)" : "Report a fraud call or SMS: Chakshu"} <ExternalLink size={13} />
                </a>
              </li>
            </ul>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <RukoMark motion={call.state === "active" ? "live" : "none"} className="h-11 w-11 text-ink" title="" />
              <p className="font-display text-[15px] font-semibold">{t.voice}</p>
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{t.voiceLead}</p>
            {call.state === "active" || call.state === "connecting" || call.state === "ringing" ? (
              <button onClick={() => void call.stop()} className="ring-focus mt-4 w-full rounded-full bg-stop py-2.5 font-display text-[14px] font-semibold text-white">
                {lang === "hi" ? "कॉल खत्म करें" : "End call"}
              </button>
            ) : (
              <button
                onClick={() => (readAccessCode() ? void call.start() : setAskCode(true))}
                className="ring-focus mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-hair py-2.5 font-display text-[14px] font-semibold text-ink hover:border-[var(--hair-strong)]"
              >
                <Mic size={16} /> {t.voiceBtn}
              </button>
            )}
            {call.error && <p className="mt-2 text-[12.5px] text-stop">{call.error.message}</p>}
            <p className="mt-2 text-[11.5px] text-muted">{lang === "hi" ? "लाइव वॉइस के लिए एक्सेस कोड चाहिए (डेमो का क्रेडिट सीमित है)।" : "Live voice needs an access code (the demo runs on a small credit budget)."}</p>
          </div>

          {stats && stats.counting && stats.checks > 0 && stats.since && (
            <div className="card p-5">
              <p className="t-eyebrow">{lang === "hi" ? "अब तक" : "So far"}</p>
              <p className="t-num mt-2 text-[30px]">{stats.checks}</p>
              <p className="text-[13px] text-ink-2">
                {lang === "hi" ? "जाँचें, " : "checks run since "}
                {new Date(stats.since!).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}
              </p>
              {topPatterns.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
                  {topPatterns.map(([id, n]) => (
                    <li key={id}>
                      {id.replace(/_/g, " ")} · {n}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11.5px] text-muted">{lang === "hi" ? "गिनती गुमनाम है।" : "Anonymous counts only."}</p>
            </div>
          )}
        </aside>
      </main>
      <AccessDialog
        open={askCode}
        onClose={() => setAskCode(false)}
        onOk={() => {
          setAskCode(false);
          void call.start();
        }}
      />
    </div>
  );
}

function Answer({ data, lang }: { data: Reply; lang: Lang }) {
  const r = RISK[data.risk];
  const Icon = r.icon;
  return (
    <div className="max-w-[92%] rounded-2xl border border-hair bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("chip", r.tone)}>
          <Icon size={14} /> {r.label[lang]}
        </span>
        {data.pattern && <span className="chip bg-paper-3 text-ink">{data.pattern.name}</span>}
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink">{data.reply}</p>
      {data.truth && (
        <p className="mt-3 border-l-2 border-[var(--coral)] pl-3 text-[14px] font-medium leading-relaxed text-ink">{data.truth}</p>
      )}
      {data.advice.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[13.5px] text-ink-2">
          {data.advice.map((a) => (
            <li key={a}>· {a}</li>
          ))}
        </ul>
      )}
      {data.sources.length > 0 && (
        <p className="mt-3 text-[12px] text-muted">
          {lang === "hi" ? "स्रोत: " : "Sources: "}
          {data.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a className="underline underline-offset-2 hover:text-ink" href={s.url} target="_blank" rel="noreferrer">
                {s.publisher}
              </a>
            </span>
          ))}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">{data.method === "llm+library" ? "AI reading + official wording from Ruko's library" : "Rule-based match against Ruko's library"}</p>
    </div>
  );
}
