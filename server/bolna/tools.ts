import { SIGNALS } from "../../shared/signals.js";
import { PATTERNS } from "../../shared/patterns.js";

/**
 * Tool (custom function) definitions. The same definitions are used to build the
 * Bolna agents (api_tools) and to run the text-mode eval, so the eval exercises
 * exactly what the voice agent sees.
 *
 * Bolna substitutes prompt variables into tool parameters with the same name
 * ({check_id}, {execution_id}), so the LLM never has to read IDs aloud or copy
 * them. All parameter values arrive as strings.
 */

export interface ToolDef {
  name: string;
  description: string;
  pre_call_message?: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: "string"; description: string; enum?: string[] }>;
    required: string[];
  };
}

const checkId = { type: "string" as const, description: "The check ID for this call. Always use the value from your instructions." };
const executionId = { type: "string" as const, description: "This call's reference. Always use the value from your instructions." };

export const CHECK_AGENT_TOOLS: ToolDef[] = [
  {
    name: "get_check_context",
    description:
      "Call this once, right after the customer confirms the code word. Returns the payment details, why the bank paused it, whether a trusted contact is on file, and the first question to ask.",
    parameters: {
      type: "object",
      properties: { check_id: checkId, execution_id: executionId },
      required: ["check_id"],
    },
  },
  {
    name: "record_signal",
    description:
      "Record something the customer said that matters for the safety check, as soon as you hear it: warning signs (someone on another call directing them, threats of arrest or investigation, secrecy, remote-access apps, pressure, promises of returns, fees to receive money) and reassuring facts (knows the payee, their own idea, purpose fits). One signal per call. Returns guidance: the likely fraud pattern, an official sentence to say, and the next question.",
    parameters: {
      type: "object",
      properties: {
        check_id: checkId,
        signal: {
          type: "string",
          description: SIGNALS.map((s) => `${s.type}: ${s.listen_for}`).join(" | "),
          enum: SIGNALS.map((s) => s.type),
        },
        evidence: { type: "string", description: "A short quote or paraphrase of what the customer said (under 20 words). Never include numbers they read out." },
        confidence: { type: "string", description: "How sure you are.", enum: ["high", "medium", "low"] },
        pattern_hint: {
          type: "string",
          description: "Optional: the fraud pattern this sounds like, if any.",
          enum: ["none", ...PATTERNS.map((p) => p.id)],
        },
      },
      required: ["check_id", "signal", "evidence", "confidence"],
    },
  },
  {
    name: "call_trusted_contact",
    description:
      "Phone the customer's trusted contact (a family member they chose in advance) so they can talk before any money moves. Only call this after the customer clearly says yes when you offer it.",
    pre_call_message: "One moment, I'm asking them to call you.",
    parameters: {
      type: "object",
      properties: {
        check_id: checkId,
        customer_consent: { type: "string", description: "Did the customer clearly agree?", enum: ["yes", "no"] },
      },
      required: ["check_id", "customer_consent"],
    },
  },
  {
    name: "check_trusted_contact",
    description: "Check whether the trusted contact has been reached and what they said.",
    parameters: { type: "object", properties: { check_id: checkId }, required: ["check_id"] },
  },
  {
    name: "set_decision",
    description:
      "Call this once at the end with your recommendation. The bank's policy makes the final decision from the recorded signals and returns the exact message to tell the customer.",
    parameters: {
      type: "object",
      properties: {
        check_id: checkId,
        recommendation: {
          type: "string",
          description: "release = safe to send; delay = hold for a few hours to verify; block = stop the payment.",
          enum: ["release", "delay", "block"],
        },
        reason: { type: "string", description: "One sentence explaining your recommendation." },
      },
      required: ["check_id", "recommendation", "reason"],
    },
  },
];

export const CONTACT_AGENT_TOOLS: ToolDef[] = [
  {
    name: "report_contact_outcome",
    description: "Call this once before ending, to record what the trusted contact said.",
    parameters: {
      type: "object",
      properties: {
        check_id: checkId,
        knows_about_payment: { type: "string", description: "Did they already know about this payment?", enum: ["yes", "no", "unsure"] },
        concern_raised: { type: "string", description: "Are they worried it could be fraud?", enum: ["yes", "no"] },
        will_call_customer: { type: "string", description: "Will they call the customer now?", enum: ["yes", "no"] },
        notes: { type: "string", description: "One short sentence. No phone numbers." },
      },
      required: ["check_id", "knows_about_payment", "concern_raised", "will_call_customer"],
    },
  },
];

export const PUBLIC_LINE_TOOLS: ToolDef[] = [
  {
    name: "lookup_pattern",
    description:
      "Look up which known fraud pattern a caller's story matches, with the official advice. Call it once you have heard what happened.",
    pre_call_message: "Let me check that against known patterns.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "A short summary of what the caller described. No names or phone numbers." },
        language: { type: "string", description: "Language to answer in.", enum: ["en", "hi"] },
      },
      required: ["description", "language"],
    },
  },
  {
    name: "log_report",
    description:
      "Log an anonymised summary of the caller's story so new patterns can be spotted. Call once near the end. Never include names, numbers or other personal details.",
    parameters: {
      type: "object",
      properties: {
        pattern_id: { type: "string", description: "Best matching pattern, or 'unknown'.", enum: ["unknown", ...PATTERNS.map((p) => p.id)] },
        summary: { type: "string", description: "Two sentences, anonymised." },
        language: { type: "string", description: "Language of the call.", enum: ["en", "hi"] },
      },
      required: ["pattern_id", "summary", "language"],
    },
  },
];

/** Bolna api_tools block for a set of tools pointing at this deployment. */
export function bolnaApiTools(tools: ToolDef[], baseUrl: string, toolToken: string) {
  return {
    tools: tools.map((t) => ({
      key: "custom_task",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      ...(t.pre_call_message ? { pre_call_message: t.pre_call_message } : {}),
    })),
    tools_params: Object.fromEntries(
      tools.map((t) => [
        t.name,
        {
          method: "POST",
          url: `${baseUrl.replace(/\/$/, "")}/v1/bolna/tools/${t.name}`,
          api_token: `Bearer ${toolToken}`,
          headers: { "Content-Type": "application/json" },
          param: Object.fromEntries(Object.keys(t.parameters.properties).map((k) => [k, `%(${k})s`])),
        },
      ]),
    ),
  };
}

/** OpenAI-style tool list for the text-mode eval. */
export function openAiTools(tools: ToolDef[]) {
  return tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
