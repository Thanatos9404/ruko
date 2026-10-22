import type { ModelOpinion } from "../../shared/types.js";
import type {
  AppStatus,
  AuditEvent,
  CallInfo,
  Check,
  CheckCreated,
  Confidence,
  ContactCall,
  ContactOutcome,
  CustomerProfile,
  Decision,
  DeviceSignals,
  Lang,
  Outcome,
  PaymentContext,
  Signal,
} from "../../shared/types.js";
import { signalDef, SEVERITY_RANK } from "../../shared/signals.js";
import { inferPattern, patternById, truthFor, PATTERNS } from "../../shared/patterns.js";
import type { KV } from "../store/store.js";
import { assessRisk, DEFAULT_POLICY, type PolicyConfig } from "./policy.js";
import { criticalRisk, positiveGenuineEvidence } from "./decision.js";

/** Probes for coached customers, asked only on critical pre-call risk with no positive evidence yet. */
const PROBES: { id: string; text: Record<"en" | "hi", string> }[] = [
  {
    id: "told_what_to_say",
    text: {
      en: "Has anyone told you what to say to the bank about this payment?",
      hi: "क्या किसी ने आपको बताया है कि इस भुगतान के बारे में बैंक को क्या कहना है?",
    },
  },
  {
    id: "hang_up",
    text: {
      en: "If someone is still on the other call, could you hang up? I'll wait.",
      hi: "अगर कोई अब भी दूसरी कॉल पर है, तो क्या आप वह कॉल काट सकते हैं? मैं इंतज़ार करूँगी।",
    },
  },
  {
    id: "checked_payee",
    text: {
      en: "Have you met this payee or checked them yourself, outside this call or chat?",
      hi: "क्या आप इस पाने वाले से मिले हैं, या इस कॉल या चैट के बाहर ख़ुद जाँच की है?",
    },
  },
];
import { decide } from "./decision.js";
import { newCheckId, newCodeWord, newSecret, newSignalId, sha256, safeEqual } from "./ids.js";

export const HOLD_MINUTES = 15;
/** Sandbox holds resolve quickly so an abandoned demo never sits "holding" for long. */
export const SANDBOX_HOLD_MINUTES = 3;
export const RETRY_MINUTES = 5;
export const SANDBOX_RETRY_MINUTES = 1.5;
const CHECK_TTL = 14 * 24 * 3600;
const INDEX_MAX = 300;

/** Stored form: the public Check plus fields that never leave the server. */
export interface StoredCheck extends Check {
  client_secret_hash?: string;
}

export interface CreateCheckInput {
  payment: PaymentContext;
  customer: CustomerProfile;
  device?: DeviceSignals;
  mode?: Check["mode"];
  origin?: Check["origin"];
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

export function validateCreate(body: unknown): CreateCheckInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const p = b.payment as Record<string, unknown> | undefined;
  const c = b.customer as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") throw new ValidationError("payment is required", "payment");
  if (!c || typeof c !== "object") throw new ValidationError("customer is required", "customer");
  const amount = Number(p.amount_inr);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_00_00_00_000)
    throw new ValidationError("payment.amount_inr must be a positive number of rupees", "payment.amount_inr");
  const payee = p.payee as Record<string, unknown> | undefined;
  if (!payee || typeof payee.name !== "string" || !payee.name.trim())
    throw new ValidationError("payment.payee.name is required", "payment.payee.name");
  if (typeof payee.handle !== "string") throw new ValidationError("payment.payee.handle is required", "payment.payee.handle");
  if (/\b\d{9,18}\b/.test(payee.handle) && !/[•*xX]/.test(payee.handle))
    throw new ValidationError("payment.payee.handle must be a UPI ID or a masked account number, never a full account number", "payment.payee.handle");
  if (typeof c.name !== "string" || !c.name.trim()) throw new ValidationError("customer.name is required", "customer.name");
  if (typeof c.customer_ref !== "string") throw new ValidationError("customer.customer_ref is required", "customer.customer_ref");
  const lang = (c.language ?? "en") as Lang;
  if (lang !== "en" && lang !== "hi") throw new ValidationError("customer.language must be 'en' or 'hi'", "customer.language");
  const rails = ["UPI", "IMPS", "NEFT", "RTGS", "CARD"];
  const rail = String(p.rail ?? "UPI").toUpperCase();
  if (!rails.includes(rail)) throw new ValidationError(`payment.rail must be one of ${rails.join(", ")}`, "payment.rail");
  if (c.phone_e164 !== undefined && !/^\+\d{8,15}$/.test(String(c.phone_e164)))
    throw new ValidationError("customer.phone_e164 must be E.164, e.g. +919000000000", "customer.phone_e164");
  const tc = c.trusted_contact as Record<string, unknown> | undefined;
  if (tc && !/^\+\d{8,15}$/.test(String(tc.phone_e164 ?? "")))
    throw new ValidationError("customer.trusted_contact.phone_e164 must be E.164", "customer.trusted_contact.phone_e164");
  const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    payment: {
      amount_inr: Math.round(amount),
      rail: rail as PaymentContext["rail"],
      payee: {
        name: payee.name.trim().slice(0, 80),
        handle: String(payee.handle).slice(0, 80),
        is_new: Boolean(payee.is_new),
        prior_payments: num(payee.prior_payments),
        in_contacts: Boolean(payee.in_contacts),
        flags: Array.isArray(payee.flags) ? (payee.flags as string[]).filter((f) => typeof f === "string").slice(0, 8) as PaymentContext["payee"]["flags"] : [],
      },
      note: typeof p.note === "string" ? p.note.slice(0, 140) : undefined,
      initiated_via: (["manual", "collect_request", "qr", "link"].includes(String(p.initiated_via)) ? p.initiated_via : "manual") as PaymentContext["initiated_via"],
      initiated_at: typeof p.initiated_at === "string" && !Number.isNaN(Date.parse(p.initiated_at)) ? p.initiated_at : new Date().toISOString(),
      timezone: typeof p.timezone === "string" ? p.timezone : "Asia/Kolkata",
    },
    customer: {
      customer_ref: c.customer_ref.slice(0, 64),
      name: c.name.trim().slice(0, 60),
      language: lang,
      phone_e164: c.phone_e164 as string | undefined,
      digital_tenure_days: num(c.digital_tenure_days, 365),
      avg_amount_90d: num(c.avg_amount_90d, 0),
      max_amount_90d: num(c.max_amount_90d, 0),
      payments_last_hour: num(c.payments_last_hour),
      amount_last_24h: num(c.amount_last_24h),
      vulnerability_flag: Boolean(c.vulnerability_flag),
      planned_large_payment: Boolean(c.planned_large_payment),
      trusted_contact: tc
        ? {
            name: String(tc.name ?? "").slice(0, 60),
            relation: String(tc.relation ?? "").slice(0, 30),
            phone_e164: String(tc.phone_e164),
            consent_on_file: Boolean(tc.consent_on_file),
          }
        : undefined,
    },
    device: (b.device ?? {}) as DeviceSignals,
    mode: (["live", "demo", "eval"].includes(String(b.mode)) ? b.mode : "live") as Check["mode"],
    origin: (["api", "sandbox", "eval-replay"].includes(String(b.origin)) ? b.origin : undefined) as Check["origin"],
  };
}

export class CheckService {
  constructor(
    private kv: KV,
    private policy: PolicyConfig = DEFAULT_POLICY,
    private now: () => Date = () => new Date(),
  ) {}

  private iso(): string {
    return this.now().toISOString();
  }

  private key(id: string) {
    return `check:${id}`;
  }

  async get(id: string): Promise<StoredCheck | null> {
    if (!/^chk_[A-Z0-9]{6,16}$/.test(id)) return null;
    const c = await this.kv.get<StoredCheck>(this.key(id));
    if (!c) return null;
    return this.expireIfDue(c);
  }

  async require(id: string): Promise<StoredCheck> {
    const c = await this.get(id);
    if (!c) throw new NotFoundError(`check ${id} not found`);
    return c;
  }

  private async save(c: StoredCheck): Promise<StoredCheck> {
    c.updated_at = this.iso();
    await this.kv.set(this.key(c.id), c, CHECK_TTL);
    return c;
  }

  private event(c: Check, type: string, detail: string): void {
    const e: AuditEvent = { at: this.iso(), type, detail };
    c.events.push(e);
    if (c.events.length > 200) c.events.splice(0, c.events.length - 200);
  }

  /** Read-modify-write with a re-read, so concurrent writers rarely clobber each other. */
  async mutate(id: string, fn: (c: StoredCheck) => void | Promise<void>): Promise<StoredCheck> {
    const c = await this.require(id);
    await fn(c);
    return this.save(c);
  }

  /**
   * Creates a check. With an idempotency key, a retry with the same body returns
   * the original result; the same key with a different body is a conflict.
   */
  async create(
    tenant: string,
    input: CreateCheckInput,
    idempotencyKey?: string,
  ): Promise<{ created: CheckCreated; check: StoredCheck; replayed: boolean }> {
    const fingerprint = sha256(JSON.stringify({ p: input.payment, c: input.customer, d: input.device ?? {} }));
    const idemKey = idempotencyKey ? `idem:${tenant}:${sha256(idempotencyKey)}` : null;
    if (idemKey) {
      const prev = await this.kv.get<{ fingerprint: string; created: CheckCreated; check_id: string }>(idemKey);
      if (prev) {
        if (prev.fingerprint !== fingerprint) throw new ConflictError("Idempotency-Key was already used with a different request body");
        const check = await this.require(prev.check_id);
        return { created: { ...prev.created, client_secret: undefined }, check, replayed: true };
      }
    }

    const risk = assessRisk(input.payment, input.customer, input.device ?? {}, this.policy);
    const now = this.iso();
    const id = newCheckId();
    const hold = risk.action === "hold";
    const secret = newSecret();
    const check: StoredCheck = {
      id,
      tenant,
      mode: input.mode ?? "live",
      origin: input.origin ?? "api",
      created_at: now,
      updated_at: now,
      status: hold ? "holding" : "allowed",
      payment: input.payment,
      customer: input.customer,
      device: input.device ?? {},
      risk,
      code_word: hold ? newCodeWord() : undefined,
      hold_expires_at: hold
        ? new Date(this.now().getTime() + (input.origin === "sandbox" ? SANDBOX_HOLD_MINUTES : HOLD_MINUTES) * 60_000).toISOString()
        : undefined,
      signals: [],
      contact: { status: "not_requested" },
      agent_recommendation: null,
      decision: null,
      events: [],
      client_secret_hash: sha256(secret),
    };
    this.event(
      check,
      "check.created",
      hold
        ? `Held for a voice check. Risk ${risk.score}/100 (${risk.band}): ${risk.reasons.slice(0, 3).map((r) => r.title).join("; ")}.`
        : `Allowed. Risk ${risk.score}/100.`,
    );
    await this.save(check);
    await this.addToIndex(tenant, id);

    const created: CheckCreated = {
      id,
      action: risk.action,
      risk,
      code_word: check.code_word,
      client_secret: secret,
      hold_expires_at: check.hold_expires_at,
      links: { self: `/v1/checks/${id}`, app_status: hold ? `/v1/checks/${id}/app-status` : undefined },
    };
    if (idemKey) await this.kv.set(idemKey, { fingerprint, created: { ...created, client_secret: undefined }, check_id: id }, 24 * 3600);
    return { created, check, replayed: false };
  }

  verifyClientSecret(c: StoredCheck, secret: string | null | undefined): boolean {
    if (!secret || !c.client_secret_hash) return false;
    return safeEqual(sha256(secret), c.client_secret_hash);
  }

  private async addToIndex(tenant: string, id: string): Promise<void> {
    const k = `index:${tenant}`;
    const ids = (await this.kv.get<string[]>(k)) ?? [];
    if (!ids.includes(id)) ids.unshift(id);
    await this.kv.set(k, ids.slice(0, INDEX_MAX), CHECK_TTL);
  }

  async list(tenant: string, limit = 50): Promise<StoredCheck[]> {
    const ids = (await this.kv.get<string[]>(`index:${tenant}`)) ?? [];
    const out: StoredCheck[] = [];
    for (const id of ids.slice(0, limit)) {
      const c = await this.get(id);
      if (c) out.push(c);
    }
    return out;
  }

  // ---- Call lifecycle ------------------------------------------------------

  async attachCall(id: string, call: CallInfo): Promise<StoredCheck> {
    return this.mutate(id, async (c) => {
      c.call = { ...(c.call ?? {}), ...call };
      if (call.execution_id) await this.kv.set(`exec:${call.execution_id}`, id, CHECK_TTL);
      if (c.status === "holding" && ["queued", "ringing", "in-progress"].includes(call.status)) c.status = "in_call";
      this.event(c, "call.updated", `${call.channel} call ${call.status}${call.execution_id ? ` (${call.execution_id})` : ""}`);
    });
  }

  async checkIdForExecution(executionId: string): Promise<string | null> {
    return this.kv.get<string>(`exec:${executionId}`);
  }

  async noteEvent(id: string, type: string, detail: string): Promise<void> {
    await this.mutate(id, (c) => this.event(c, type, detail));
  }

  async linkExecution(id: string, executionId: string, agentId?: string): Promise<void> {
    const c = await this.require(id);
    if (c.call?.execution_id === executionId) return;
    await this.kv.set(`exec:${executionId}`, id, CHECK_TTL);
    await this.mutate(id, (cc) => {
      cc.call = { ...(cc.call ?? { channel: "web", status: "in-progress" }), execution_id: executionId, agent_id: agentId ?? cc.call?.agent_id };
      if (cc.status === "holding") cc.status = "in_call";
    });
  }

  // ---- Signals ---------------------------------------------------------------

  async recordSignal(
    id: string,
    input: { type: string; evidence: string; confidence?: Confidence; pattern_hint?: string; source?: Signal["source"] },
  ): Promise<{ check: StoredCheck; signal: Signal; duplicate: boolean }> {
    const def = signalDef(input.type);
    if (!def) throw new ValidationError(`unknown signal type "${input.type}"`, "signal");
    let signal!: Signal;
    let duplicate = false;
    const check = await this.mutate(id, (c) => {
      if (c.decision && c.status === "decided" && c.call?.status === "completed") return;
      const evidence = scrubEvidence(input.evidence);
      const existing = c.signals.find((s) => s.type === input.type && s.evidence === evidence);
      if (existing) {
        signal = existing;
        duplicate = true;
        return;
      }
      signal = {
        id: newSignalId(),
        type: input.type,
        severity: def.severity,
        confidence: input.confidence ?? "medium",
        evidence,
        pattern_hint: input.pattern_hint && patternById(input.pattern_hint) ? input.pattern_hint : undefined,
        at: this.iso(),
        source: input.source ?? "agent",
      };
      c.signals.push(signal);
      if (c.status === "holding") c.status = "in_call";
      this.event(c, "signal.recorded", `${def.severity}: ${def.label} (“${evidence}”)`);
    });
    return { check, signal, duplicate };
  }

  /** Stores the text model's advisory opinion. It never touches signals or the decision. */
  async setModelOpinion(id: string, ml: ModelOpinion): Promise<StoredCheck> {
    return this.mutate(id, (c) => {
      const flag = ml.band === "likely_scam" && c.decision?.outcome === "release";
      c.ml = { ...ml, disagrees_with_decision: flag || undefined };
      if (flag) this.event(c, "model.disagrees", "The text model leans scam but the payment was released: flag for review (no automatic change).");
    });
  }

  /**
   * What the agent should say next, given everything heard so far. `fallbackPattern`
   * is the text model's best guess, used only when the recorded signals don't point
   * to a pattern yet, so the official truth sentence can arrive a turn earlier.
   */
  guidance(c: Check, fallbackPattern?: string | null): {
    likely_pattern: string | null;
    say_this: string | null;
    ask_next: string | null;
    strong_signs: number;
    decide_now: boolean;
    /** Set when ask_next is a cover-story probe (logged so it isn't asked twice). */
    probe: string | null;
    tip: string;
  } {
    const lang = c.customer.language;
    const inferred = inferPattern(c.signals);
    const p = inferred ? patternById(inferred.id) : fallbackPattern ? patternById(fallbackPattern) : undefined;
    const strong = c.signals.filter((s) => s.confidence !== "low" && SEVERITY_RANK[s.severity] >= 3).length;
    let ask: string | null = null;
    let probe: string | null = null;
    const critical = criticalRisk(c);
    const positive = positiveGenuineEvidence(c.signals);
    const probed = new Set(c.events.filter((e) => e.type === "guidance.probe").map((e) => e.detail));
    // The opening question already asked who is guiding them, so there is no default re-ask.
    if (p) ask = p.ask_next[lang];
    const mitigating = c.signals.filter((s) => s.confidence !== "low" && s.severity === "mitigating").length;
    // Adaptive depth: on critical pre-call risk, a cover story isn't enough. Probe once or twice
    // for what a coached customer is told to hide, then for positive evidence.
    const nextProbe = critical && !positive && strong === 0 ? PROBES.find((pr) => !probed.has(pr.id) && (pr.id !== "hang_up" || c.device.active_call)) : undefined;
    let tip: string;
    // Two strong warning signs are enough: decide now, then offer the trusted contact.
    // The fast path needs two warning signs heard with high confidence; anything less gets another question.
    const sure = c.signals.filter((s) => s.confidence === "high" && SEVERITY_RANK[s.severity] >= 3).length;
    const decideNow = sure >= 2 || c.signals.some((s) => s.type === "codeword_mismatch");
    if (decideNow) {
      tip = "Enough warning signs. Don't speak yet: call set_decision now (block or delay), then say say_this and tell_customer together.";
      ask = null;
    } else if (strong === 1) tip = "One warning sign. Say say_this, ask ask_next, then decide.";
    else if (p && strong === 0) {
      tip = "Their answer matches a known scam pattern but no warning sign is confirmed yet. Ask ask_next before deciding.";
    } else if (nextProbe) {
      probe = nextProbe.id;
      ask = nextProbe.text[lang];
      tip =
        "Pre-payment risk is critical. A release needs positive evidence: they checked the payee themselves, or know the payee personally and the purpose fits. Ask ask_next, kindly, before deciding.";
    } else if (mitigating >= 2) {
      tip = critical && !positive
        ? "No warning signs, but no positive evidence either on a critical-risk payment: recommend delay."
        : "No warning signs so far. If you have asked whether anyone else is on the call, finish with set_decision (release).";
      ask = null;
    } else tip = "Acknowledge briefly and ask the next question.";
    return {
      likely_pattern: p ? p.name[lang] : null,
      say_this: p && strong > 0 ? truthFor(p, lang) : null,
      ask_next: ask,
      strong_signs: strong,
      decide_now: decideNow,
      probe,
      tip,
    };
  }

  // ---- Trusted contact -----------------------------------------------------

  async setContact(id: string, patch: Partial<ContactCall>): Promise<StoredCheck> {
    return this.mutate(id, (c) => {
      c.contact = { ...(c.contact ?? { status: "not_requested" }), ...patch, updated_at: this.iso() };
      if (patch.execution_id) void this.kv.set(`exec:${patch.execution_id}`, id, CHECK_TTL);
      this.event(c, "contact.updated", `Trusted contact: ${c.contact.status}`);
    });
  }

  /** Called by the contact agent. A new outcome can change an earlier decision. */
  async reportContactOutcome(id: string, outcome: ContactOutcome): Promise<StoredCheck> {
    await this.mutate(id, (c) => {
      c.contact = {
        ...(c.contact ?? { status: "not_requested" }),
        status: outcome.reached ? "reached" : "no_answer",
        outcome,
        updated_at: this.iso(),
      };
      this.event(
        c,
        "contact.outcome",
        outcome.reached
          ? `Contact reached. Knew about payment: ${outcome.knows_about_payment ? "yes" : "no"}. Concern: ${outcome.concern_raised ? "yes" : "no"}.`
          : "Contact not reached.",
      );
    });
    const c = await this.require(id);
    // An earlier "delay" from the agent was made while waiting for this call, so
    // the contact's answer supersedes it. An earlier "block" still stands.
    const prev = c.agent_recommendation?.outcome ?? null;
    if (c.decision) return this.finalize(id, { agentRecommendation: prev === "block" ? "block" : null, reason: "contact outcome" });
    return c;
  }

  // ---- Decision --------------------------------------------------------------

  async recommend(id: string, outcome: Outcome, reason: string): Promise<StoredCheck> {
    return this.mutate(id, (c) => {
      c.agent_recommendation = { outcome, reason: scrubEvidence(reason).slice(0, 300), at: this.iso() };
      this.event(c, "agent.recommendation", `Agent recommends ${outcome}: ${c.agent_recommendation.reason}`);
    });
  }

  /**
   * Applies the decision policy. Safe to call repeatedly; later evidence can make
   * a decision stricter, and a trusted contact's confirmation can lift a delay.
   */
  async finalize(
    id: string,
    opts: { agentRecommendation?: Outcome | null; noConversation?: boolean; reason?: string } = {},
  ): Promise<StoredCheck> {
    return this.mutate(id, (c) => {
      if (c.risk.action === "allow") return;
      const contactPending = c.contact?.status === "dialing" || c.contact?.status === "ringing_web";
      const d: Decision = decide({
        check: c,
        agentRecommendation: opts.agentRecommendation !== undefined ? opts.agentRecommendation : (c.agent_recommendation?.outcome ?? null),
        noConversation: opts.noConversation,
        now: this.iso(),
      });
      if (contactPending && d.outcome === "release") {
        d.outcome = "delay";
        d.delay_minutes = 60;
        d.reasons.push({ code: "AWAITING_CONTACT", text: "Waiting to hear back from the customer's trusted contact." });
        d.customer_message =
          c.customer.language === "hi"
            ? "आपका भुगतान तब तक रुका रहेगा जब तक आपके भरोसेमंद संपर्क से बात नहीं हो जाती। पैसा आपके खाते में सुरक्षित है।"
            : "Your payment will wait until we have spoken with your trusted contact. The money is safe in your account.";
      }
      const prev = c.decision;
      c.decision = d;
      c.status = "decided";
      this.event(
        c,
        prev ? "decision.updated" : "decision.made",
        `${prev ? `${prev.outcome} → ` : ""}${d.outcome}${d.delay_minutes ? ` (${d.delay_minutes} min)` : ""}${opts.reason ? ` after ${opts.reason}` : ""}: ${d.reasons.map((r) => r.code).join(", ")}`,
      );
    });
  }

  retryCount(c: Check): number {
    return c.events.filter((e) => e.type === "call.retry").length;
  }

  /**
   * The no-answer path. First miss: retry once (the app tells the customer the bank
   * is calling) and extend the hold. Second miss: delay, never block, with an
   * in-app prompt and, for high-risk holds, the bank's fraud desk.
   */
  async noAnswer(id: string, why: string): Promise<StoredCheck> {
    // Read the stored record directly: going through get() would run expireIfDue,
    // which itself calls the no-answer path.
    const c = await this.kv.get<StoredCheck>(this.key(id));
    if (!c) throw new NotFoundError(`check ${id} not found`);
    return this.applyNoAnswer(c, why);
  }

  private async applyNoAnswer(c: StoredCheck, why: string): Promise<StoredCheck> {
    if (c.decision) return c;
    if (this.retryCount(c) < 1) {
      const mins = c.origin === "sandbox" ? SANDBOX_RETRY_MINUTES : RETRY_MINUTES;
      c.hold_expires_at = new Date(this.now().getTime() + mins * 60_000).toISOString();
      c.status = "holding";
      this.event(c, "call.retry", `${why}. Retrying once; the app shows the customer that their bank is calling.`);
      return this.save(c);
    }
    const d = decide({ check: c, noConversation: true, retried: true, now: this.iso() });
    c.decision = d;
    c.status = "decided";
    this.event(c, "decision.made", `${why} after one retry; ${d.outcome}: ${d.reasons.map((r) => r.code).join(", ")}`);
    return this.save(c);
  }

  /** A hold that nobody resolved in time: decide from what was heard, or follow the no-answer path. */
  private async expireIfDue(c: StoredCheck): Promise<StoredCheck> {
    if (c.decision || c.risk.action !== "hold" || !c.hold_expires_at) return c;
    if (Date.parse(c.hold_expires_at) > this.now().getTime()) return c;
    const talked = (c.call?.transcript?.some((t) => t.role === "customer") ?? false) || c.signals.length > 0;
    if (!talked) return this.applyNoAnswer(c, "Hold expired with no answer");
    const d = decide({ check: c, agentRecommendation: c.agent_recommendation?.outcome ?? null, now: this.iso() });
    c.decision = d;
    c.status = "decided";
    this.event(c, "decision.made", `Hold expired; policy applied: ${d.outcome}.`);
    return this.save(c);
  }

  // ---- Views -----------------------------------------------------------------

  appStatus(c: Check): AppStatus {
    return {
      id: c.id,
      status: c.status,
      action: c.risk.action,
      code_word: c.code_word,
      amount_inr: c.payment.amount_inr,
      payee_name: c.payment.payee.name,
      call: c.call ? { channel: c.call.channel, status: c.call.status } : undefined,
      signals: c.signals.map((s) => ({ type: s.type, severity: s.severity, evidence: s.evidence })),
      contact: c.contact ? { status: c.contact.status } : undefined,
      decision: c.decision
        ? {
            outcome: c.decision.outcome,
            customer_message: c.decision.customer_message,
            delay_minutes: c.decision.delay_minutes,
            pattern: c.decision.pattern,
            reasons: c.decision.reasons,
            escalated_over_agent: c.decision.escalated_over_agent,
            agent_recommendation: c.decision.agent_recommendation,
          }
        : null,
      risk: { score: c.risk.score, band: c.risk.band, reasons: c.risk.reasons },
      customer_name: c.customer.name,
      language: c.customer.language,
      trusted_contact: c.customer.trusted_contact ? { name: c.customer.trusted_contact.name, relation: c.customer.trusted_contact.relation } : null,
      created_at: c.created_at,
      events: c.events.slice(-40),
    };
  }
}

/** Public view: never return the secret hash. */
export function publicCheck(c: StoredCheck): Check {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { client_secret_hash, ...rest } = c;
  return rest;
}

/**
 * Evidence quotes go into an audit log, so strip anything that looks like a
 * secret or an identifier a customer might read out by mistake (OTP, PIN, card
 * or account digits).
 */
export function scrubEvidence(s: string): string {
  return String(s ?? "")
    .replace(/\b\d[\d\s-]{3,}\d\b/g, (m) => (m.replace(/\D/g, "").length >= 4 ? "[number removed]" : m))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export const ALL_PATTERN_IDS = PATTERNS.map((p) => p.id);
