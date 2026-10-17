import type { Lang } from "../shared/types.js";
import { matchText, patternById, patternSources, truthFor, OFFICIAL_CHANNELS } from "../shared/patterns.js";
import type { KV } from "./store/store.js";
import { HttpError } from "./http.js";
import { nebiusChat, nebiusKey, redactPII, type LlmMessage } from "./llm/nebius.js";
import { newReportId } from "./engine/ids.js";

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

async function logRedacted(kv: KV, summary: string, pattern: string | null, lang: Lang, source: "text") {
  const report = { id: newReportId(), at: new Date().toISOString(), pattern_id: pattern ?? "unknown", summary: summary.slice(0, 300), language: lang, source };
  await kv.set(`report:${report.id}`, report, 90 * 24 * 3600);
  const idx = (await kv.get<string[]>("index:reports")) ?? [];
  idx.unshift(report.id);
  await kv.set("index:reports", idx.slice(0, 200), 90 * 24 * 3600);
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
  opts: { visitorKey: string; dailyCap: number; perHour: number; llm?: typeof nebiusChat },
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
  const candidates =
    matches
      .map((m) => {
        const p = m.pattern;
        return `- id: ${p.id}; name: ${p.name[lang]}; what it is: ${p.summary}; official truth: ${truthFor(p, lang)}; advice: ${p.advice[lang].join(" ")}`;
      })
      .join("\n") || "- (no keyword matches; judge from the description)";

  let reply: ChatReply | null = null;
  const llmAvailable = Boolean(nebiusKey() || opts.llm);
  const underCap = llmAvailable && (await limitCounter(kv, `cap:chat:${day}`, opts.dailyCap, 2 * 24 * 3600));
  if (underCap) {
    try {
      const out = await (opts.llm ?? nebiusChat)([{ role: "system", content: SYSTEM(lang, candidates) } as LlmMessage, ...clean], { json: true, maxTokens: 450 });
      const j = JSON.parse(out.replace(/^```(json)?|```$/g, "").trim()) as { reply?: string; risk?: string; pattern_id?: string; next_question?: string };
      const p = j.pattern_id && j.pattern_id !== "none" ? patternById(j.pattern_id) : undefined;
      reply = {
        reply: String(j.reply ?? "").slice(0, 900),
        risk: (["likely_scam", "possible_scam", "unclear", "unlikely"].includes(String(j.risk)) ? j.risk : "unclear") as ChatReply["risk"],
        pattern: p ? { id: p.id, name: p.name[lang] } : null,
        truth: p ? truthFor(p, lang) : null,
        advice: p ? p.advice[lang] : [],
        sources: p ? patternSources(p).map((s) => ({ title: s.title, publisher: s.publisher, url: s.url })) : [],
        next_question: j.next_question ? String(j.next_question).slice(0, 200) : null,
        method: "llm+library",
      };
    } catch {
      reply = null;
    }
  }
  if (!reply) {
    const top = matches[0]?.pattern;
    reply = {
      reply: top
        ? lang === "hi"
          ? `यह ${top.name.hi} जैसा लगता है। ${truthFor(top, "hi")}`
          : `This looks like ${top.name.en.toLowerCase()}. ${truthFor(top, "en")}`
        : lang === "hi"
          ? "यह किसी जाने-पहचाने पैटर्न से साफ़ मेल नहीं खाता। अनजान व्यक्ति को पैसे न भेजें, ओटीपी या पिन किसी को न बताएँ, और शक हो तो 1930 पर कॉल करें।"
          : "This doesn't clearly match a known pattern. Don't send money to someone you don't know, never share an OTP or PIN, and call 1930 if in doubt.",
      risk: top ? (matches[0].score >= 2 ? "likely_scam" : "possible_scam") : "unclear",
      pattern: top ? { id: top.id, name: top.name[lang] } : null,
      truth: top ? truthFor(top, lang) : null,
      advice: top ? top.advice[lang] : [],
      sources: top ? patternSources(top).map((s) => ({ title: s.title, publisher: s.publisher, url: s.url })) : [],
      next_question: null,
      method: "library-only",
    };
  }

  const firstMessage = clean.filter((m) => m.role === "user").length === 1;
  await bump(kv, { newConversation: firstMessage, pattern: reply.pattern?.id ?? null, lang, risk: reply.risk });
  if (firstMessage) await logRedacted(kv, clean[clean.length - 1].content, reply.pattern?.id ?? null, lang, "text");
  return reply;
}

export const CHANNELS = OFFICIAL_CHANNELS;
