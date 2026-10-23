import type { Confidence, ContactStatus, Lang, Outcome } from "../../shared/types.js";
import { signalDef } from "../../shared/signals.js";
import { matchText, patternById, truthFor } from "../../shared/patterns.js";
import { amountForSpeech, formatINR, relationFor, yourRelationHi } from "../../shared/format.js";
import { CheckService, NotFoundError, ValidationError, scrubEvidence, type StoredCheck } from "./checks.js";
import { criticalRisk } from "./decision.js";
import { codeWordHi, newReportId } from "./ids.js";
import type { KV } from "../store/store.js";
import { analyzeText, libraryPattern, pick } from "../ml/index.js";
import type { ModelOpinion } from "../../shared/types.js";

/**
 * The text model's view of the customer's words (here: the agent's evidence quotes).
 * Advisory: it can suggest a pattern and a question, never a decision. Never throws.
 */
export function modelOpinion(text: string, source: ModelOpinion["source"], now = new Date()): { opinion: ModelOpinion; corePattern: string | null } | null {
  if (!text.trim()) return null;
  try {
    // Calls are with Indian bank customers, so rank only the library's Indian patterns.
    const a = analyzeText(text, { topK: 3, region: "india" });
    if (a.engine.mode === "none") return null;
    const top = a.patterns[0];
    const lp = top ? libraryPattern(top.id) : undefined;
    const coreId = lp && patternById(lp.id) ? lp.id : top && patternById(top.id) ? top.id : null;
    const confident = Boolean(top && (top.p_given_scam ?? 0) >= 0.5 && a.band !== "unlikely_scam");
    return {
      opinion: {
        source,
        band: a.band,
        scam_probability: a.scam_probability,
        patterns: a.patterns.map((m) => ({ id: m.id, name: m.name, p_given_scam: m.p_given_scam })),
        cues: [...new Set(a.patterns.flatMap((m) => m.cues.filter((c) => !c.negated).map((c) => c.phrase)))].slice(0, 8),
        model_version: a.engine.model_version,
        at: now.toISOString(),
      },
      corePattern: confident ? coreId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Handlers for the voice agents' custom functions. Shared by the Bolna tool
 * endpoints and the text-mode eval. Every response is short, plain JSON the LLM
 * can read aloud from, in the customer's language.
 */

export interface ContactDialer {
  /** Starts the trusted-contact call. Returns the resulting contact status. */
  dial(check: StoredCheck): Promise<{ status: ContactStatus; channel?: "phone" | "web" | "text-eval"; execution_id?: string; note?: string }>;
}

export interface ToolDeps {
  checks: CheckService;
  kv: KV;
  contact?: ContactDialer;
}

type Args = Record<string, unknown>;
export type ToolResult = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v));
const yes = (v: unknown) => /^(yes|true|y|haan|ha|1)$/i.test(str(v));

function lang(c: StoredCheck): Lang {
  return c.customer.language;
}

/** IDs sometimes come back wrapped in quotes or with the literal template; clean them. */
function checkIdFrom(args: Args): string {
  const raw = str(args.check_id).replace(/["'{}\s]/g, "");
  if (!/^chk_[A-Z0-9]{6,16}$/.test(raw)) throw new ValidationError("check_id is missing or malformed", "check_id");
  return raw;
}

export async function getCheckContext(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const execId = str(args.execution_id).replace(/["'{}\s]/g, "");
  if (execId && /^[0-9a-f-]{20,}$/i.test(execId)) await deps.checks.linkExecution(id, execId);
  await deps.checks.noteEvent(id, "context.read", "Agent read the check context.");
  const c = await deps.checks.require(id);
  const l = lang(c);
  const tc = c.customer.trusted_contact;
  return {
    customer_name: c.customer.name,
    amount: amountForSpeech(c.payment.amount_inr, l),
    amount_display: formatINR(c.payment.amount_inr),
    payee: c.payment.payee.name,
    first_payment_to_payee: c.payment.payee.is_new,
    code_word: l === "hi" && c.code_word ? codeWordHi(c.code_word) : c.code_word,
    why_paused: c.risk.reasons.filter((r) => r.weight > 0).slice(0, 3).map((r) => r.title),
    trusted_contact_on_file: tc ? `${tc.name} (${relationFor(tc.relation, l)})` : "none",
    pre_call_risk: criticalRisk(c) ? "critical" : c.risk.band,
    release_needs: criticalRisk(c)
      ? "positive evidence: they checked the payee themselves, or know the payee personally and the purpose fits"
      : "no warning signs",
    on_a_call_while_paying: c.device.active_call
      ? `yes${c.device.active_call_minutes ? `, for ${c.device.active_call_minutes} minutes` : ""}${c.device.caller_in_contacts === false ? ", with a number not in their contacts" : c.device.caller_in_contacts ? ", with a saved contact" : ""}`
      : "no",
    first_question: firstQuestion(c),
    reminder: "Never ask for OTP, PIN, card or account numbers. One question at a time.",
  };
}

/** One combined opening question: what the payment is for, and whether anyone is steering it. */
export function firstQuestion(c: StoredCheck): string {
  const l = lang(c);
  if (c.device.active_call)
    return l === "hi"
      ? "आपके ऐप के अनुसार भुगतान करते समय आप एक कॉल पर थे। यह भुगतान किस लिए है, और आप किससे बात कर रहे थे?"
      : "Your app shows you were on a call while paying. What's this payment for, and who were you speaking with?";
  return l === "hi"
    ? "यह भुगतान किस लिए है, और क्या कोई और कॉल पर आपको बता रहा है कि क्या करना है?"
    : "What's this payment for, and is anyone on another call telling you what to do?";
}

/** After a decision: offer the trusted contact once, only if there was a warning sign and nobody has been asked yet. */
function contactOffer(c: StoredCheck): string | null {
  const tc = c.customer.trusted_contact;
  if (!tc || (c.contact?.status && c.contact.status !== "not_requested")) return null;
  const warned = c.signals.some((s) => s.confidence !== "low" && ["critical", "high", "medium"].includes(s.severity));
  if (!warned) return null;
  return lang(c) === "hi"
    ? `क्या मैं ${yourRelationHi(tc.relation)} ${tc.name} जी को कॉल करवाऊँ, ताकि आप उनसे बात कर लें?`
    : `Shall I call ${tc.name}, your ${tc.relation}, so you can talk it over?`;
}

export async function recordSignal(deps: ToolDeps, args: Args, source: "agent" | "contact_agent" = "agent"): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const type = str(args.signal);
  if (!signalDef(type)) {
    return { recorded: false, error: `Unknown signal "${type}". Use one of the listed signal names.` };
  }
  const conf = (["high", "medium", "low"].includes(str(args.confidence)) ? str(args.confidence) : "medium") as Confidence;
  const hint = str(args.pattern_hint);
  const recorded = await deps.checks.recordSignal(id, {
    type,
    evidence: str(args.evidence) || "(no quote given)",
    confidence: conf,
    pattern_hint: hint && hint !== "none" ? hint : undefined,
    source,
  });
  const duplicate = recorded.duplicate;
  let check = recorded.check;
  // "Family is on the call", but the bank sees a caller who isn't in their contacts: the story conflicts.
  if (type === "family_helping" && check.device.active_call && check.device.caller_in_contacts === false && !check.signals.some((s) => s.type === "story_conflict")) {
    ({ check } = await deps.checks.recordSignal(id, {
      type: "story_conflict",
      evidence: "Says family is on the call, but the caller's number isn't in their contacts",
      confidence: "high",
      source: "policy",
    }));
  }
  // Customer evidence only: Ruko's own questions are the same in scam and genuine calls.
  const ml = modelOpinion(
    check.signals.filter((x) => x.source !== "contact_agent").map((x) => x.evidence).join("\n"),
    "evidence",
  );
  let current = check;
  if (ml) current = await deps.checks.setModelOpinion(id, ml.opinion);
  const g = deps.checks.guidance(current, ml?.corePattern ?? null);
  // A question from the research library for the model's pattern, when the core library has none yet.
  const libP = ml?.opinion.patterns[0] && ml.opinion.band !== "unlikely_scam" ? libraryPattern(ml.opinion.patterns[0].id) : undefined;
  const mlAsk = libP?.red_flag_questions ? (pick(libP.red_flag_questions as { en: string[] }, lang(current)) as string[] | undefined)?.[0] : undefined;
  if (g.probe) await deps.checks.noteEvent(id, "guidance.probe", g.probe);
  if (g.decide_now) {
    // Put the instruction first, so the model calls set_decision before it speaks.
    return {
      recorded: true,
      decide_now: "yes",
      next: "Call set_decision now. Do not ask another question.",
      likely_pattern: g.likely_pattern ?? "not clear yet",
      say_this: g.say_this ?? "",
      tip: g.tip,
    };
  }
  return {
    recorded: true,
    duplicate,
    likely_pattern: g.likely_pattern ?? "not clear yet",
    say_this: g.say_this ?? "",
    ask_next: g.ask_next ?? (g.strong_signs > 0 && mlAsk ? mlAsk : ""),
    decide_now: g.decide_now ? "yes" : "no",
    tip: g.tip,
  };
}

export async function callTrustedContact(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const c = await deps.checks.require(id);
  const l = lang(c);
  const tc = c.customer.trusted_contact;
  if (!yes(args.customer_consent)) {
    await deps.checks.setContact(id, { status: "consent_declined", requested_at: new Date().toISOString() });
    return { status: "not_called", say: l === "hi" ? "ठीक है, हम उन्हें कॉल नहीं करेंगे।" : "Okay, we won't call them." };
  }
  // Data minimisation: the contact is only called when the check found a reason to.
  const warnings = c.signals.filter((s) => s.confidence !== "low" && ["critical", "high", "medium"].includes(s.severity));
  if (!warnings.length) {
    return {
      status: "not_needed",
      say: l === "hi" ? "अभी किसी और को कॉल करने की ज़रूरत नहीं है।" : "There's no need to call anyone else right now.",
      next: "No warning signs are recorded, so the contact is not called. Continue, then call set_decision.",
    };
  }
  if (!tc) {
    await deps.checks.setContact(id, { status: "no_contact_on_file" });
    return {
      status: "no_contact_on_file",
      say:
        l === "hi"
          ? "आपके खाते में कोई भरोसेमंद संपर्क दर्ज नहीं है। आप खुद परिवार के किसी सदस्य से बात कर लें।"
          : "There's no trusted contact on your account. Please speak to a family member yourself before paying.",
    };
  }
  if (c.contact?.status === "dialing" || c.contact?.status === "ringing_web" || c.contact?.status === "reached") {
    return { status: c.contact.status, say: l === "hi" ? `${tc.name} को पहले ही कॉल किया जा रहा है।` : `We're already calling ${tc.name}.` };
  }
  if (!deps.contact) {
    await deps.checks.setContact(id, { status: "not_configured", requested_at: new Date().toISOString() });
    return {
      status: "not_configured",
      say:
        l === "hi"
          ? `अभी हम ${tc.name} को कॉल नहीं कर पा रहे हैं। कृपया भुगतान से पहले आप खुद उनसे बात कर लें।`
          : `I can't place that call right now. Please call ${tc.name} yourself before any money moves.`,
    };
  }
  const r = await deps.contact.dial(c);
  await deps.checks.setContact(id, {
    status: r.status,
    channel: r.channel,
    execution_id: r.execution_id,
    requested_at: new Date().toISOString(),
  });
  return {
    status: r.status,
    say:
      l === "hi"
        ? `मैंने ${tc.name} को कॉल करने के लिए कह दिया है। जब तक आप उनसे बात नहीं कर लेते, पैसा आपके खाते में ही रहेगा।`
        : `I've asked ${tc.name} to be called now. The money stays in your account until you've talked.`,
    next: c.decision
      ? "Say this, thank them and say goodbye."
      : "Say this, then call set_decision now with recommendation delay. Do not wait for the contact on this call.",
  };
}

export async function checkTrustedContact(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const c = await deps.checks.require(id);
  const o = c.contact?.outcome;
  return {
    status: c.contact?.status ?? "not_requested",
    reached: o?.reached ?? false,
    knows_about_payment: o?.knows_about_payment ?? null,
    concern_raised: o?.concern_raised ?? null,
    will_call_customer: o?.will_call_customer ?? null,
  };
}

export async function setDecision(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const rec = str(args.recommendation) as Outcome;
  if (!["release", "delay", "block"].includes(rec)) return { error: "recommendation must be release, delay or block" };
  await deps.checks.recommend(id, rec, str(args.reason));
  const c = await deps.checks.finalize(id, { agentRecommendation: rec, reason: "agent recommendation" });
  const d = c.decision!;
  const p = d.pattern ? patternById(d.pattern.id) : undefined;
  const offer = contactOffer(c);
  return {
    final_decision: d.outcome,
    tell_customer: d.customer_message,
    pattern: p ? p.name[lang(c)] : "none",
    offer_contact: offer ?? "",
    then: offer
      ? "Read tell_customer as it is, then ask offer_contact once. Call call_trusted_contact only if they say yes. Then say goodbye."
      : "Read tell_customer as it is, then say goodbye and end the call.",
    if_they_object: "Don't argue and don't promise a release. Say they can call the bank on the number on their card or in the app.",
  };
}

export async function reportContactOutcome(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const id = checkIdFrom(args);
  const knows = str(args.knows_about_payment);
  const c = await deps.checks.reportContactOutcome(id, {
    reached: true,
    knows_about_payment: knows === "yes" ? true : knows === "no" ? false : undefined,
    concern_raised: yes(args.concern_raised),
    will_call_customer: yes(args.will_call_customer),
    notes: scrubEvidence(str(args.notes)).slice(0, 200),
  });
  return { recorded: true, decision_now: c.decision?.outcome ?? "pending" };
}

// ---- Public "Is this a scam?" line -------------------------------------------

export async function lookupPattern(_deps: ToolDeps, args: Args): Promise<ToolResult> {
  const l: Lang = str(args.language) === "hi" ? "hi" : "en";
  const matches = matchText(str(args.description));
  if (!matches.length) {
    return {
      match: "none",
      say:
        l === "hi"
          ? "यह किसी जाने-पहचाने पैटर्न से साफ़ मेल नहीं खाता, पर सावधानी रखें: अनजान व्यक्ति को पैसे न भेजें, ओटीपी या पिन किसी को न बताएँ, और शक हो तो 1930 पर कॉल करें।"
          : "This doesn't clearly match a known pattern, but stay careful: don't send money to someone you don't know, never share an OTP or PIN, and call 1930 if in doubt.",
      report: "1930 or cybercrime.gov.in; suspicious calls and messages on Sanchar Saathi (Chakshu).",
    };
  }
  const top = matches[0].pattern;
  return {
    match: top.name[l],
    pattern_id: top.id,
    truth: truthFor(top, l),
    advice: top.advice[l],
    other_possible: matches.slice(1).map((m) => m.pattern.name[l]),
  };
}

const PHONE_LIKE = /\+?\d[\d\s-]{7,}\d/g;
const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.]+/g;

export async function logReport(deps: ToolDeps, args: Args): Promise<ToolResult> {
  const summary = str(args.summary).replace(PHONE_LIKE, "[number]").replace(EMAIL_LIKE, "[email]").slice(0, 400);
  const pid = str(args.pattern_id);
  const report = {
    id: newReportId(),
    at: new Date().toISOString(),
    pattern_id: patternById(pid) ? pid : "unknown",
    summary,
    language: str(args.language) === "hi" ? "hi" : "en",
  };
  await deps.kv.set(`report:${report.id}`, report, 90 * 24 * 3600);
  const idx = (await deps.kv.get<string[]>("index:reports")) ?? [];
  idx.unshift(report.id);
  await deps.kv.set("index:reports", idx.slice(0, 200), 90 * 24 * 3600);
  return { logged: true };
}

export const TOOL_HANDLERS: Record<string, (deps: ToolDeps, args: Args) => Promise<ToolResult>> = {
  get_check_context: getCheckContext,
  record_signal: (d, a) => recordSignal(d, a, "agent"),
  call_trusted_contact: callTrustedContact,
  check_trusted_contact: checkTrustedContact,
  set_decision: setDecision,
  report_contact_outcome: reportContactOutcome,
  lookup_pattern: lookupPattern,
  log_report: logReport,
};

export async function runTool(deps: ToolDeps, name: string, args: Args): Promise<{ status: number; body: ToolResult }> {
  const h = TOOL_HANDLERS[name];
  if (!h) return { status: 404, body: { error: `unknown tool ${name}` } };
  // A wrong or garbled check_id: recover the check from this call's execution id, server-side.
  const execId = str(args.execution_id).replace(/["'{}\s]/g, "");
  if (execId && /^[0-9a-zA-Z-]{8,80}$/.test(execId)) {
    const raw = str(args.check_id).replace(/["'{}\s]/g, "");
    const known = /^chk_[A-Z0-9]{6,16}$/.test(raw) ? await deps.checks.get(raw) : null;
    if (!known) {
      const mapped = await deps.checks.checkIdForExecution(execId);
      if (mapped) args = { ...args, check_id: mapped };
    }
  }
  try {
    return { status: 200, body: await h(deps, args) };
  } catch (e) {
    if (e instanceof ValidationError) return { status: 200, body: { error: e.message } };
    if (e instanceof NotFoundError) return { status: 200, body: { error: "This check was not found. Apologise, say the bank will follow up, and end the call politely." } };
    throw e;
  }
}
