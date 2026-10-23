import type { Lang } from "../shared/types.js";
import { matchText, patternById, patternSources, truthFor, OFFICIAL_CHANNELS } from "../shared/patterns.js";
import { analyzeText, getSources, libraryPattern, pick, type TextAnalysis } from "./ml/index.js";
import type { KV } from "./store/store.js";
import { HttpError } from "./http.js";
import { nebiusChat, nebiusKey, redactPII, type LlmMessage } from "./llm/nebius.js";

/**
 * The free, public "Is this a scam?" text checker. Anyone can use it without
 * credits: a small LLM on Nebius reads a redacted description, the pattern
 * library supplies the official wording, and only anonymous counters plus a
 * redacted summary are kept.
 */

export interface PublicStats {
  since: string;
  checks: number;
  conversations: number;
  by_pattern: Record<string, number>;
  by_language: Record<string, number>;
  by_risk: Record<string, number>;
}

export interface ChatReply {
  reply: string;
  risk: "likely_scam" | "possible_scam" | "unclear" | "unlikely";
  pattern: { id: string; name: string } | null;
  truth: string | null;
  advice: string[];
  sources: { title: string; publisher: string; url: string }[];
  next_question: string | null;
  method: "llm+library" | "library-only";
  /** The on-server text model's opinion. Advisory: it ranks patterns, it never decides. */
  model: { band: string; scam_probability: number | null; version: string | null } | null;
  /** True when the truth/advice text is a machine-drafted translation awaiting review. */
  draft_translation?: boolean;
}

interface Candidate {
  id: string;
  name: string;
  summary: string;
  truth: string;
  advice: string[];
  sources: { title: string; publisher: string; url: string }[];
  draft: boolean;
}

/** A pattern from the 12-pattern core (shared/patterns.ts) or, failing that, the research library. */
function candidate(id: string, lang: Lang): Candidate | null {
  const core = patternById(id);
  if (core)
    return {
      id: core.id,
      name: core.name[lang],
      summary: core.summary,
      truth: truthFor(core, lang),
      advice: core.advice[lang],
      sources: patternSources(core).map((x) => ({ title: x.title, publisher: x.publisher, url: x.url })),
      draft: false,
    };
  const lp = libraryPattern(id);
  if (!lp) return null;
  const src = getSources();
  const status = (lp.translation_status as Record<string, string> | undefined)?.[lang] ?? "source";
  return {
    id: lp.id,
    name: pick(lp.name, lang),
    summary: typeof lp.summary === "string" ? lp.summary : pick(lp.summary as { en: string }, "en"),
    truth: pick(lp.truth, lang),
    advice: pick(lp.advice, lang),
    sources: lp.sources
      .map((sid) => src.get(sid))
      .filter((x): x is NonNullable<typeof x> => Boolean(x && x.url))
      .slice(0, 4)
      .map((x) => ({ title: x.title, publisher: x.publisher, url: x.url })),
    draft: lang !== "en" && status !== "source",
  };
}

/** At most four distinct advice lines, without foreign helplines. */
function tidyAdvice(advice: string[]): string[] {
  const seen = new Set<string>();
  return advice
    .filter((a) => !/\b(UK|United Kingdom|Singapore|Action Fraud|159 |ScamShield)\b/i.test(a))
    .filter((a) => {
      const k = a.toLowerCase().replace(/[^a-z\u0900-\u097f0-9]+/g, " ").trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 4);
}

/** Enough real words to judge: at least six words, mostly letters. */
function meaningful(text: string): boolean {
  const ws = text.trim().split(/\s+/).filter((w) => /[a-z\u0900-\u097f]{2,}/i.test(w));
  return ws.length >= 6;
}

function safeAnalyze(text: string): TextAnalysis | null {
  try {
    // The public checker serves people in India: rank the library's Indian patterns only.
    return analyzeText(text, { topK: 3, region: "india" });
  } catch {
    return null;
  }
}

const SYSTEM = (lang: Lang, candidates: string) => `You are Ruko's free public safety checker. A member of the public describes a call, message or payment request. Decide whether it matches a known fraud pattern and tell them what to do, briefly and kindly.

Reply as JSON only, with these keys:
- "reply": 2 to 4 short sentences to the person, in ${lang === "hi" ? "simple Hindi (Devanagari)" : "plain English"}. If it looks like fraud, say so plainly and tell them what to do now. If you need one more detail, ask one question.
- "risk": one of "likely_scam", "possible_scam", "unclear", "unlikely".
- "pattern_id": the id of the best matching pattern from the candidates below, or "none".
- "next_question": one short follow-up question, or "".

Rules:
- Use only the official facts given in the candidates for any claim about what police, banks, RBI or agencies do.
- Never ask for names, phone numbers, account numbers, OTPs, PINs or IDs.
- If money has already been lost, tell them to call 1930 now and report at cybercrime.gov.in.
- If they are in danger, tell them to call 112.
- Never tell them to pay anyone, install anything or click a link.

Candidate patterns from Ruko's library (official sources):
${candidates}`;

export async function readStats(kv: KV): Promise<PublicStats> {
  return (
    (await kv.get<PublicStats>("stats:public")) ?? {
      since: new Date().toISOString(),
      checks: 0,
      conversations: 0,
      by_pattern: {},
      by_language: {},
      by_risk: {},
    }
  );
}

async function bump(kv: KV, opts: { newConversation: boolean; pattern: string | null; lang: Lang; risk: string }) {
  const s = await readStats(kv);
  s.checks += 1;
  if (opts.newConversation) s.conversations += 1;
  if (opts.pattern) s.by_pattern[opts.pattern] = (s.by_pattern[opts.pattern] ?? 0) + 1;
  s.by_language[opts.lang] = (s.by_language[opts.lang] ?? 0) + 1;
  s.by_risk[opts.risk] = (s.by_risk[opts.risk] ?? 0) + 1;
  await kv.set("stats:public", s, 365 * 24 * 3600);
}

export async function limitCounter(kv: KV, key: string, max: number, ttl: number): Promise<boolean> {
  const n = (await kv.get<number>(key)) ?? 0;
  if (n >= max) return false;
  await kv.set(key, n + 1, ttl);
  return true;
}

export async function publicChat(
  kv: KV,
  body: unknown,
  opts: { visitorKey: string; dailyCap: number; perHour: number; llm?: typeof nebiusChat; count?: boolean },
): Promise<ChatReply> {
  const b = (body ?? {}) as { messages?: { role?: string; content?: string }[]; language?: string };
  const lang: Lang = b.language === "hi" ? "hi" : "en";
  const msgs = Array.isArray(b.messages) ? b.messages.slice(-10) : [];
  if (!msgs.length || msgs[msgs.length - 1]?.role !== "user") throw new HttpError(400, "Send the conversation with the newest user message last.", "invalid_request");
  const clean = msgs
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: redactPII(String(m.content).slice(0, 800)) }));
  const userText = clean.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  if (userText.replace(/\[[a-z ]+\]/g, "").trim().length < 8) throw new HttpError(400, "Describe what happened in a sentence or two.", "invalid_request");

  const hour = new Date().toISOString().slice(0, 13);
  const day = hour.slice(0, 10);
  if (!(await limitCounter(kv, `rl:chat:${opts.visitorKey}:${hour}`, opts.perHour, 3600)))
    throw new HttpError(429, "You've sent a lot of checks this hour. Please try again a little later.", "rate_limited");

  const matches = matchText(userText);
  // The text model runs on the server in about a millisecond and stores nothing. It adds
  // candidate patterns the keyword rules miss; it never sets the answer on its own.
  const ml = safeAnalyze(userText);
  const modelIds = ml && ml.band !== "unlikely_scam" ? ml.patterns.filter((m) => (m.p_given_scam ?? 0) >= 0.2 || m.lexicon_score > 0).map((m) => m.id) : [];
  const ids = [...new Set([...matches.map((m) => m.pattern.id), ...modelIds])].slice(0, 5);
  const cands = ids.map((id) => candidate(id, lang)).filter((c): c is Candidate => Boolean(c));
  const candidates =
    cands.map((c) => `- id: ${c.id}; name: ${c.name}; what it is: ${c.summary}; official truth: ${c.truth}; advice: ${c.advice.join(" ")}`).join("\n") ||
    "- (no keyword matches; judge from the description)";
  const modelView = ml && ml.engine.mode !== "none" ? { band: ml.band, scam_probability: ml.scam_probability, version: ml.engine.model_version } : null;
  const modelLine = modelView
    ? `\n\nAn on-server text classifier (advisory, may be wrong) rates this: ${modelView.band}${modelView.scam_probability !== null ? ` (p=${modelView.scam_probability.toFixed(2)})` : ""}.`
    : "";

  let reply: ChatReply | null = null;
  // The public checker is model-free by default: official-advisory library plus the on-server text
  // classifier. An LLM reading is an opt-in for local development only (RUKO_PUBLIC_LLM=nebius).
  const llmAvailable = Boolean(opts.llm || (process.env.RUKO_PUBLIC_LLM === "nebius" && !process.env.VERCEL && nebiusKey()));
  const underCap = llmAvailable && (await limitCounter(kv, `cap:chat:${day}`, opts.dailyCap, 2 * 24 * 3600));
  if (underCap) {
    try {
      const out = await (opts.llm ?? nebiusChat)([{ role: "system", content: SYSTEM(lang, candidates + modelLine) } as LlmMessage, ...clean], { json: true, maxTokens: 450 });
      const j = JSON.parse(out.replace(/^```(json)?|```$/g, "").trim()) as { reply?: string; risk?: string; pattern_id?: string; next_question?: string };
      const c = j.pattern_id && j.pattern_id !== "none" ? (cands.find((x) => x.id === j.pattern_id) ?? candidate(j.pattern_id, lang)) : null;
      reply = {
        reply: String(j.reply ?? "").slice(0, 900),
        risk: (["likely_scam", "possible_scam", "unclear", "unlikely"].includes(String(j.risk)) ? j.risk : "unclear") as ChatReply["risk"],
        pattern: c ? { id: c.id, name: c.name } : null,
        truth: c ? c.truth : null,
        advice: c ? tidyAdvice(c.advice) : [],
        sources: c ? c.sources : [],
        next_question: j.next_question ? String(j.next_question).slice(0, 200) : null,
        method: "llm+library",
        model: modelView,
        draft_translation: c?.draft || undefined,
      };
    } catch {
      reply = null;
    }
  }
  if (!reply) {
    // No LLM: the keyword rules first, then the text model's top pattern.
    const top = cands[0] ?? null;
    const ruleScore = matches[0]?.score ?? 0;
    const risk: ChatReply["risk"] = !top
      ? ml?.band === "unlikely_scam"
        ? // A few words, or gibberish, is never "no warning signs": it's "not clear yet".
          meaningful(userText)
          ? "unlikely"
          : "unclear"
        : "unclear"
      : ruleScore >= 2 || ml?.band === "likely_scam"
        ? "likely_scam"
        : "possible_scam";
    reply = {
      reply: top
        ? lang === "hi"
          ? `यह ${top.name} जैसा लगता है। ${top.truth}`
          : `This looks like ${top.name.charAt(0).toLowerCase()}${top.name.slice(1)}. ${top.truth}`
        : lang === "hi"
          ? "यह किसी जाने-पहचाने पैटर्न से साफ़ मेल नहीं खाता। अनजान व्यक्ति को पैसे न भेजें, ओटीपी या पिन किसी को न बताएँ, और शक हो तो 1930 पर कॉल करें।"
          : "This doesn't clearly match a known pattern. Don't send money to someone you don't know, never share an OTP or PIN, and call 1930 if in doubt.",
      risk,
      pattern: top ? { id: top.id, name: top.name } : null,
      truth: top ? top.truth : null,
      advice: top ? tidyAdvice(top.advice) : [],
      sources: top ? top.sources : [],
      next_question: null,
      method: "library-only",
      model: modelView,
      draft_translation: top?.draft || undefined,
    };
  }

  const firstMessage = clean.filter((m) => m.role === "user").length === 1;
  // Counters are public, so they only count real production traffic (never dev, preview, e2e or tagged tests).
  if (opts.count !== false) {
    await bump(kv, { newConversation: firstMessage, pattern: reply.pattern?.id ?? null, lang, risk: reply.risk });
    // Nothing the person typed is stored, not even redacted: only anonymous counts.
  }
  return reply;
}

export const CHANNELS = OFFICIAL_CHANNELS;

/** Public view of the counters: patterns below the threshold are folded into "other" so no single check stands out. */
export function publicStatsView(s: PublicStats, minPerPattern: number) {
  const shown: Record<string, number> = {};
  let other = 0;
  for (const [k, v] of Object.entries(s.by_pattern)) {
    if (v >= minPerPattern) shown[k] = v;
    else other += v;
  }
  return {
    since: s.checks > 0 ? s.since : null,
    checks: s.checks,
    conversations: s.conversations,
    by_pattern: shown,
    other_patterns: other,
    min_per_pattern: minPerPattern,
  };
}
