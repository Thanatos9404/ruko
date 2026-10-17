import type {
  Check,
  Decision,
  DecisionReason,
  Lang,
  Outcome,
  Signal,
} from "../../shared/types.js";
import { POLICY_VERSION } from "./policy.js";
import { inferPattern } from "../../shared/patterns.js";
import { amountForSpeech, minutesLabel } from "../../shared/format.js";

/**
 * Post-call decision policy. The voice agent listens and labels; this function
 * decides. The agent's own recommendation can make the outcome stricter, never
 * more lenient than the evidence: an LLM that was talked round by a coached
 * customer cannot release a payment the signals say to stop.
 */

const RANK: Record<Outcome, number> = { release: 0, delay: 1, block: 2 };
const stricter = (a: Outcome, b: Outcome): Outcome => (RANK[a] >= RANK[b] ? a : b);

export const DELAY_CRITICAL_MIN = 24 * 60;
export const DELAY_HIGH_MIN = 4 * 60;
export const DELAY_NO_ANSWER_MIN = 30;

function counted(s: Signal): boolean {
  return s.confidence !== "low";
}

export interface DecisionInput {
  check: Pick<Check, "signals" | "contact" | "risk" | "customer" | "payment" | "call">;
  agentRecommendation?: Outcome | null;
  /** True when the customer was never reached (no answer, failed, hung up before speaking). */
  noConversation?: boolean;
  /** The engine already retried the call once without reaching the customer. */
  retried?: boolean;
  now?: string;
}

export function decide(input: DecisionInput): Decision {
  const { check } = input;
  const now = input.now ?? new Date().toISOString();
  const lang: Lang = check.customer.language;
  const sigs = check.signals.filter(counted);
  const of = (sev: Signal["severity"]) => sigs.filter((s) => s.severity === sev);
  const critical = of("critical");
  const high = of("high");
  const mitigating = of("mitigating");
  const wantsCancel = sigs.some((s) => s.type === "wants_to_cancel");
  const wantsTime = sigs.some((s) => s.type === "wants_more_time");
  const contact = check.contact?.outcome;
  const reasons: DecisionReason[] = [];
  const ids = (xs: Signal[]) => xs.map((s) => s.id);

  let outcome: Outcome = "release";
  let delay: number | undefined;

  if (input.noConversation) {
    // Never block someone we could not talk to: delay, tell them in the app, offer a call-back,
    // and hand high-risk cases to the bank's fraud desk.
    outcome = "delay";
    delay = input.retried ? DELAY_HIGH_MIN : DELAY_NO_ANSWER_MIN;
    reasons.push({
      code: input.retried ? "NO_ANSWER_AFTER_RETRY" : "NO_CONVERSATION",
      text: input.retried
        ? "The customer didn't answer the call or the retry. The payment waits; the app asks them to confirm or request a call-back from the bank's official number."
        : "The customer could not be reached, so the held payment waits for a retry or an in-app confirmation.",
    });
    if (check.risk.band === "high" || check.risk.reasons.some((r) => r.hard)) {
      reasons.push({
        code: "ESCALATED_TO_FRAUD_DESK",
        text: "Pre-payment risk was high, so the case goes to the bank's fraud desk for a human call-back.",
      });
    }
  } else if (wantsCancel) {
    outcome = "block";
    reasons.push({
      code: "CUSTOMER_CANCELLED",
      text: "The customer chose to cancel the payment during the check.",
      signal_ids: ids(sigs.filter((s) => s.type === "wants_to_cancel")),
    });
  } else if (critical.length >= 1 && critical.length + high.length >= 2) {
    outcome = "block";
    reasons.push({
      code: "MULTIPLE_STRONG_SIGNS",
      text: `${critical.length + high.length} strong warning signs, including ${critical.length} critical: ${describe(critical.concat(high))}.`,
      signal_ids: ids(critical.concat(high)),
    });
  } else if (critical.length === 1) {
    outcome = "delay";
    delay = DELAY_CRITICAL_MIN;
    reasons.push({
      code: "CRITICAL_SIGN",
      text: `One critical warning sign: ${describe(critical)}. The payment waits 24 hours, or until the customer confirms through the bank's official number.`,
      signal_ids: ids(critical),
    });
  } else if (high.length >= 2) {
    outcome = "delay";
    delay = DELAY_HIGH_MIN;
    reasons.push({
      code: "SEVERAL_WARNING_SIGNS",
      text: `${high.length} warning signs: ${describe(high)}.`,
      signal_ids: ids(high),
    });
  } else if (high.length === 1 && mitigating.length === 0) {
    outcome = "delay";
    delay = DELAY_HIGH_MIN;
    reasons.push({
      code: "UNEXPLAINED_WARNING_SIGN",
      text: `A warning sign with nothing to offset it: ${describe(high)}.`,
      signal_ids: ids(high),
    });
  } else {
    reasons.push({
      code: mitigating.length ? "EXPLAINED" : "NO_WARNING_SIGNS",
      text: mitigating.length
        ? `No critical signs, and the customer's answers support the payment: ${describe(mitigating)}.`
        : "The conversation raised no warning signs.",
      signal_ids: ids(mitigating),
    });
  }

  if (wantsTime && outcome === "release") {
    outcome = "delay";
    delay = DELAY_HIGH_MIN;
    reasons.push({ code: "CUSTOMER_WANTS_TIME", text: "The customer asked for time to check before paying." });
  }

  // Trusted contact: a concern raised by the contact escalates; a confirmation
  // can lift a delay that came only from high (not critical) signs.
  if (contact?.reached) {
    if (contact.concern_raised || contact.knows_about_payment === false) {
      if (outcome !== "block") {
        outcome = critical.length ? "block" : "delay";
        delay = outcome === "delay" ? DELAY_CRITICAL_MIN : undefined;
      }
      reasons.push({
        code: "CONTACT_CONCERNED",
        text: "The customer's trusted contact did not know about this payment or raised a concern.",
      });
    } else if (contact.knows_about_payment && outcome === "delay" && critical.length === 0 && !wantsTime) {
      outcome = "release";
      delay = undefined;
      reasons.push({
        code: "CONTACT_CONFIRMED",
        text: "The customer's trusted contact knew about the payment and had no concerns.",
      });
    }
  }

  // The agent may escalate, never de-escalate.
  const agentRec = input.agentRecommendation ?? null;
  let escalated = false;
  if (agentRec && !input.noConversation) {
    const evidenceFloor = outcome;
    // An agent "block" with no strong evidence becomes a delay: holding money needs a reason a person can read.
    const agentWants: Outcome = agentRec === "block" && critical.length === 0 && high.length === 0 && !wantsCancel ? "delay" : agentRec;
    const next = stricter(evidenceFloor, agentWants);
    if (next !== outcome) {
      outcome = next;
      if (outcome === "delay" && !delay) delay = DELAY_HIGH_MIN;
      if (outcome === "block") delay = undefined;
      reasons.push({
        code: "AGENT_CAUTION",
        text: "The safety assistant recommended more caution than the recorded signs alone required.",
      });
    }
    escalated = RANK[outcome] > RANK[agentRec];
    if (escalated) {
      reasons.push({
        code: "POLICY_OVERRODE_AGENT",
        text: `The assistant recommended "${agentRec}", but the recorded evidence requires "${outcome}".`,
      });
    }
  }
  if (outcome !== "delay") delay = undefined;

  const pattern = outcome === "release" ? null : inferPattern(check.signals);
  return {
    outcome,
    reasons,
    delay_minutes: delay,
    pattern,
    agent_recommendation: agentRec,
    escalated_over_agent: escalated,
    customer_message: input.noConversation ? noAnswerMessage(lang) : customerMessage(outcome, lang, check.payment.amount_inr, delay),
    decided_at: now,
    policy_version: POLICY_VERSION,
  };
}

function describe(xs: Signal[]): string {
  const labels = [...new Set(xs.map((s) => s.type.replace(/_/g, " ")))];
  return labels.join(", ");
}

export function noAnswerMessage(lang: Lang): string {
  return lang === "hi"
    ? "हम आपसे बात नहीं कर पाए। आपका भुगतान रुका है और पैसा सुरक्षित है। ऐप में पुष्टि करें या बैंक से कॉल-बैक माँगें।"
    : "We couldn't reach you. Your payment is on hold and your money is safe. Confirm in the app, or ask the bank to call you back.";
}

export function customerMessage(outcome: Outcome, lang: Lang, amount: number, delay?: number): string {
  const amt = amountForSpeech(amount, lang);
  if (lang === "hi") {
    if (outcome === "release") return `धन्यवाद। आपका ${amt} का भुगतान अब जा रहा है।`;
    if (outcome === "block")
      return `आपकी सुरक्षा के लिए यह भुगतान रोक दिया गया है। पैसा आपके खाते में सुरक्षित है। अगर किसी ने दबाव डाला है, तो 1930 पर कॉल करें।`;
    return `आपका भुगतान ${hiDelay(delay)} के लिए रुका है। पैसा सुरक्षित है। किसी भरोसेमंद व्यक्ति से बात कर लें; बैंक अपने आधिकारिक नंबर से फिर कॉल करेगा।`;
  }
  if (outcome === "release") return `Thank you. Your payment of ${amt} is going through now.`;
  if (outcome === "block")
    return "For your safety, this payment is stopped. Your money is safe in your account. If someone has been pressuring you, call 1930.";
  return `Your payment is on hold for ${minutesLabel(delay) || "a few hours"}. Your money is safe. Please talk to someone you trust; the bank will call from its official number.`;
}

function hiDelay(min?: number): string {
  if (!min) return "कुछ घंटों";
  if (min < 60) return `${min} मिनट`;
  const h = Math.round(min / 60);
  return `${h} घंटे`;
}
