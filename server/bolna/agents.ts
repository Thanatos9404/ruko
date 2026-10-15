import type { Check, Lang } from "../../shared/types.js";
import { amountForSpeech } from "../../shared/format.js";
import { codeWordHi } from "../engine/ids.js";
import {
  CHECK_HANGUP,
  CHECK_PROMPT_EN,
  CHECK_PROMPT_HI,
  CONTACT_PROMPT_EN,
  CONTACT_PROMPT_HI,
  LINE_GREETING,
  LINE_PROMPT_EN,
  LINE_PROMPT_HI,
  checkGreeting,
  contactGreeting,
} from "./prompts.js";
import { CHECK_AGENT_TOOLS, CONTACT_AGENT_TOOLS, PUBLIC_LINE_TOOLS, bolnaApiTools, type ToolDef } from "./tools.js";

/**
 * Bolna agent definitions. Only "preferred" models that sit inside Bolna's flat
 * per-minute rate are used (docs: pricing/preferred-models, Oct 2026):
 *   LLM  openai gpt-4.1-mini
 *   STT  deepgram nova-3 (English), sarvam saaras:v3 (Hindi)
 *   TTS  elevenlabs eleven_turbo_v2_5 (English), sarvam bulbul:v3 (Hindi)
 * Voices were picked from GET /api/v1/voice-config/tts for each language.
 */

export const VOICES = {
  en: { provider: "elevenlabs", voice: "Anika - Customer Care Agent", voice_id: "90ipbRoKi4CpHXvKVtl0", model: "eleven_turbo_v2_5" },
  hi: { provider: "sarvam", voice: "Kavya", voice_id: "kavya", model: "bulbul:v3" },
} as const;

export interface AgentBuildOptions {
  baseUrl: string;
  toolToken: string;
  webhookUrl?: string;
  callTerminateSeconds?: number;
}

function task(opts: {
  tools: ToolDef[];
  baseUrl: string;
  toolToken: string;
  promptEn: string;
  promptHi: string;
  nameEn: string;
  nameHi: string;
  callTerminate: number;
  hangup: Record<Lang, string>;
}) {
  return {
    task_type: "conversation",
    toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
    tools_config: {
      llm_agent: {
        agent_type: "simple_llm_agent",
        agent_flow_type: "streaming",
        llm_config: { provider: "openai", model: "gpt-4.1-mini", max_tokens: 220, temperature: 0.2 },
      },
      transcriber: {
        provider: "deepgram",
        model: "nova-3",
        language: "en",
        stream: true,
        encoding: "linear16",
        sampling_rate: 16000,
        endpointing: 250,
      },
      synthesizer: {
        provider: VOICES.en.provider,
        provider_config: { voice: VOICES.en.voice, voice_id: VOICES.en.voice_id, model: VOICES.en.model },
        stream: true,
        buffer_size: 200,
        audio_format: "wav",
      },
      input: { provider: "plivo", format: "wav" },
      output: { provider: "plivo", format: "wav" },
      api_tools: bolnaApiTools(opts.tools, opts.baseUrl, opts.toolToken),
      multilingual_config: {
        enabled: true,
        active_language: "en",
        language_switch_trigger: "requested_or_auto_detected",
        languages: {
          en: {
            synthesizer: {
              provider: VOICES.en.provider,
              provider_config: { voice: VOICES.en.voice, voice_id: VOICES.en.voice_id, model: VOICES.en.model },
            },
            system_prompt: opts.promptEn,
            agent_name: opts.nameEn,
          },
          hi: {
            transcriber: { provider: "sarvam", model: "saaras:v3", language: "hi" },
            synthesizer: {
              provider: VOICES.hi.provider,
              provider_config: { voice: VOICES.hi.voice, voice_id: VOICES.hi.voice_id, model: VOICES.hi.model, language: "hi" },
            },
            system_prompt: opts.promptHi,
            handoff_message: "ठीक है, हम हिंदी में बात करते हैं।",
            agent_name: opts.nameHi,
          },
        },
      },
    },
    task_config: {
      call_terminate: opts.callTerminate,
      hangup_after_silence: 12,
      hangup_after_LLMCall: true,
      call_cancellation_prompt:
        "End the call only after the assistant has told the customer the final message and said goodbye, or if the customer asks to end the call.",
      call_hangup_message: opts.hangup,
      number_of_words_for_interruption: 2,
      check_if_user_online: true,
      trigger_user_online_message_after: 8,
      backchanneling: false,
      voicemail: false,
    },
  };
}

function agent(name: string, welcome: string, t: ReturnType<typeof task>, promptEn: string, webhookUrl?: string) {
  return {
    agent_config: {
      agent_name: name,
      agent_welcome_message: welcome,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      call_summary_enabled: false,
      tasks: [t],
    },
    agent_prompts: { task_1: { system_prompt: promptEn } },
  };
}

export function checkAgentConfig(o: AgentBuildOptions) {
  const t = task({
    tools: CHECK_AGENT_TOOLS,
    baseUrl: o.baseUrl,
    toolToken: o.toolToken,
    promptEn: CHECK_PROMPT_EN,
    promptHi: CHECK_PROMPT_HI,
    nameEn: "Ruko",
    nameHi: "रुको",
    callTerminate: o.callTerminateSeconds ?? 90,
    hangup: CHECK_HANGUP,
  });
  return agent("Ruko - Payment Safety Check (bank customer protection)", "{greeting}", t, CHECK_PROMPT_EN, o.webhookUrl);
}

export function contactAgentConfig(o: AgentBuildOptions) {
  const t = task({
    tools: CONTACT_AGENT_TOOLS,
    baseUrl: o.baseUrl,
    toolToken: o.toolToken,
    promptEn: CONTACT_PROMPT_EN,
    promptHi: CONTACT_PROMPT_HI,
    nameEn: "Ruko",
    nameHi: "रुको",
    callTerminate: Math.min(o.callTerminateSeconds ?? 75, 75),
    hangup: CHECK_HANGUP,
  });
  return agent("Ruko - Trusted Contact Call (bank customer protection)", "{greeting}", t, CONTACT_PROMPT_EN, o.webhookUrl);
}

export function lineAgentConfig(o: AgentBuildOptions) {
  const t = task({
    tools: PUBLIC_LINE_TOOLS,
    baseUrl: o.baseUrl,
    toolToken: o.toolToken,
    promptEn: LINE_PROMPT_EN,
    promptHi: LINE_PROMPT_HI,
    nameEn: "Ruko",
    nameHi: "रुको",
    callTerminate: o.callTerminateSeconds ?? 90,
    hangup: { en: "Thank you for checking. Stay safe.", hi: "जाँच करने के लिए धन्यवाद। सुरक्षित रहें।" },
  });
  return agent("Ruko - Public Fraud Safety Line", "{greeting}", t, LINE_PROMPT_EN, o.webhookUrl);
}

// ---- Per-call variables (user_data) -----------------------------------------

export function checkUserData(c: Check, bankName: string): Record<string, string> {
  const lang = c.customer.language;
  const code = lang === "hi" && c.code_word ? codeWordHi(c.code_word) : (c.code_word ?? "");
  const tc = c.customer.trusted_contact;
  return {
    check_id: c.id,
    customer_name: c.customer.name,
    bank_name: bankName,
    amount: amountForSpeech(c.payment.amount_inr, lang),
    payee_name: c.payment.payee.name,
    code_word: code,
    hold_reasons: c.risk.reasons.filter((r) => r.weight > 0).slice(0, 3).map((r) => r.title.toLowerCase()).join("; "),
    trusted_contact: tc ? `${tc.name}, ${tc.relation}` : "none",
    greeting: checkGreeting(lang, { customer_name: c.customer.name, bank_name: bankName, code_word: code }),
    agent_language: lang,
  };
}

export function contactUserData(c: Check, bankName: string): Record<string, string> {
  const lang = c.customer.language;
  const tc = c.customer.trusted_contact!;
  const concerns = c.signals.filter((s) => s.severity === "critical" || s.severity === "high").map((s) => s.type.replace(/_/g, " "));
  return {
    check_id: c.id,
    contact_name: tc.name,
    customer_name: c.customer.name,
    bank_name: bankName,
    amount: amountForSpeech(c.payment.amount_inr, lang),
    payee_name: c.payment.payee.name,
    concern_summary: concerns.length ? [...new Set(concerns)].join(", ") : "a large first-time payment",
    greeting: contactGreeting(lang, { contact_name: tc.name, bank_name: bankName, customer_name: c.customer.name }),
    agent_language: lang,
  };
}

export function lineUserData(lang: Lang): Record<string, string> {
  return { greeting: LINE_GREETING[lang], agent_language: lang };
}
