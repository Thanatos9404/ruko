/**
 * Runs one text-mode safety check: an LLM plays the customer, another LLM runs
 * Ruko's agent with the SAME system prompt, greeting and tool definitions the
 * Bolna voice agent uses, and the tools execute against the real engine
 * (CheckService + decision policy) in memory. Only the audio layer is missing.
 */
import type { Check, Outcome } from "../shared/types.js";
import { MemoryStore } from "../server/store/store.js";
import { CheckService, validateCreate } from "../server/engine/checks.js";
import { newCodeWord } from "../server/engine/ids.js";
import { runTool, type ToolDeps } from "../server/engine/toolHandlers.js";
import { CHECK_AGENT_TOOLS, openAiTools } from "../server/bolna/tools.js";
import { CHECK_PROMPT_EN, CHECK_PROMPT_HI, renderPrompt } from "../server/bolna/prompts.js";
import { checkUserData } from "../server/bolna/agents.js";
import type { ChatMessage, Nebius } from "./nebius.js";
import type { EvalScenario } from "./scenarios.js";

export interface TurnLog {
  role: "agent" | "customer" | "tool";
  text: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface ConversationResult {
  scenario_id: string;
  precall: { action: "allow" | "hold"; score: number; band: string; reasons: string[] };
  forced_call: boolean;
  turns: TurnLog[];
  customer_turns: number;
  agent_turns: number;
  set_decision_called: boolean;
  agent_recommendation: Outcome | null;
  decision: Outcome | null;
  delay_minutes?: number;
  pattern: string | null;
  signals: { type: string; severity: string; confidence: string; evidence: string }[];
  escalated_over_agent: boolean;
  contact_requested: boolean;
  truth_said: boolean;
  ended_by: "agent" | "customer" | "max_turns" | "error";
  error?: string;
  llm_calls: number;
  tokens: { prompt: number; completion: number };
  wall_ms: number;
}

export interface RunOptions {
  agentModel: string;
  customerModel: string;
  maxCustomerTurns: number;
  seed: number;
}

const BANK = "Demo Bank";

export async function runConversation(llm: Nebius, sc: EvalScenario, opts: RunOptions): Promise<ConversationResult> {
  const t0 = Date.now();
  const kv = new MemoryStore();
  const checks = new CheckService(kv);
  const deps: ToolDeps = {
    checks,
    kv,
    // In text mode the contact's call is placed but never answered.
    contact: { dial: async () => ({ status: "dialing", channel: "text-eval" }) },
  };
  const input = validateCreate({ payment: { ...sc.payment, initiated_at: "2026-10-16T06:30:00.000Z" }, customer: sc.customer, device: sc.device, mode: "eval" });
  const { check: created } = await checks.create("eval", input);
  const precall = {
    action: created.risk.action,
    score: created.risk.score,
    band: created.risk.band,
    reasons: created.risk.reasons.map((r) => r.code),
  };
  // Every scenario gets a call so the agent itself is measured; the end-to-end
  // view (with the pre-call policy) is computed separately in score.ts.
  const forced = created.risk.action === "allow";
  if (forced) {
    await checks.mutate(created.id, (c) => {
      c.risk = { ...c.risk, action: "hold" };
      c.code_word = newCodeWord();
      c.status = "holding";
    });
  }
  const check = (await checks.require(created.id)) as Check;
  const execId = `eval-${sc.id}`;
  const ud: Record<string, string> = { ...checkUserData(check, BANK), execution_id: execId };
  const system = renderPrompt(check.customer.language === "hi" ? CHECK_PROMPT_HI : CHECK_PROMPT_EN, ud);
  const greeting = ud.greeting;

  const agentMsgs: ChatMessage[] = [
    { role: "system", content: system },
    { role: "assistant", content: greeting },
  ];
  const custMsgs: ChatMessage[] = [
    { role: "system", content: sc.persona },
    { role: "user", content: greeting },
  ];
  const turns: TurnLog[] = [{ role: "agent", text: greeting }];
  const tools = openAiTools(CHECK_AGENT_TOOLS);
  let llmCalls = 0;
  const tokens = { prompt: 0, completion: 0 };
  let decided = false;
  let agentRec: Outcome | null = null;
  let contactRequested = false;
  let customerTurns = 0;
  let agentTurns = 1;
  let endedBy: ConversationResult["ended_by"] = "max_turns";
  const sayThis = new Set<string>();
  let error: string | undefined;

  try {
    for (let turn = 0; turn < opts.maxCustomerTurns; turn++) {
      // Customer speaks.
      let said = "";
      for (let attempt = 0; attempt < 2 && !said; attempt++) {
        // Reasoning models can spend the budget thinking; retry once with a new seed.
        const cr = await llm.chat({ model: opts.customerModel, messages: custMsgs, temperature: 0.7, max_tokens: 900, seed: opts.seed + turn + attempt * 1000 });
        llmCalls++;
        tokens.prompt += cr.usage?.prompt_tokens ?? 0;
        tokens.completion += cr.usage?.completion_tokens ?? 0;
        said = cleanSpeech(cr.message.content);
      }
      if (!said || /\[END\]/i.test(said)) {
        endedBy = "customer";
        break;
      }
      customerTurns++;
      turns.push({ role: "customer", text: said });
      custMsgs.push({ role: "assistant", content: said });
      agentMsgs.push({ role: "user", content: said });

      // Agent thinks, possibly calling tools, until it speaks.
      let spoke = "";
      for (let hop = 0; hop < 6; hop++) {
        const ar = await llm.chat({ model: opts.agentModel, messages: agentMsgs, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 400, seed: opts.seed });
        llmCalls++;
        tokens.prompt += ar.usage?.prompt_tokens ?? 0;
        tokens.completion += ar.usage?.completion_tokens ?? 0;
        const m = ar.message;
        const calls = m.tool_calls ?? [];
        if (calls.length) {
          agentMsgs.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
          for (const tc of calls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              args = {};
            }
            // Bolna substitutes these prompt variables into tool parameters.
            args.check_id = check.id;
            if ("execution_id" in args || tc.function.name === "get_check_context") args.execution_id = execId;
            const { body } = await runTool(deps, tc.function.name, args);
            if (tc.function.name === "set_decision") {
              decided = true;
              agentRec = (String(args.recommendation) as Outcome) ?? null;
            }
            if (tc.function.name === "call_trusted_contact" && /^yes$/i.test(String(args.customer_consent))) contactRequested = true;
            if (typeof (body as { say_this?: unknown }).say_this === "string" && (body as { say_this: string }).say_this)
              sayThis.add((body as { say_this: string }).say_this);
            turns.push({ role: "tool", text: "", tool: tc.function.name, args, result: body });
            agentMsgs.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(body) });
          }
          if (m.content && cleanSpeech(m.content)) spoke = cleanSpeech(m.content);
          if (spoke) break;
          continue;
        }
        spoke = cleanSpeech(m.content);
        agentMsgs.push({ role: "assistant", content: m.content ?? "" });
        break;
      }
      if (spoke) {
        agentTurns++;
        turns.push({ role: "agent", text: spoke });
        custMsgs.push({ role: "user", content: spoke });
      }
      if (decided && spoke) {
        endedBy = "agent";
        break;
      }
    }
  } catch (e) {
    endedBy = "error";
    error = (e as Error).message.slice(0, 300);
  }

  if (!decided) {
    // Same as a call that ended without set_decision: the webhook path applies the policy.
    const talked = customerTurns > 0;
    await checks.finalize(check.id, { noConversation: !talked, reason: "call ended without set_decision" });
  }
  const final = await checks.require(check.id);
  const agentText = turns.filter((t) => t.role === "agent").map((t) => t.text).join(" \n ");
  const truthSaid = [...sayThis].some((s) => overlap(s, agentText) >= 0.6);

  return {
    scenario_id: sc.id,
    precall,
    forced_call: forced,
    turns,
    customer_turns: customerTurns,
    agent_turns: agentTurns,
    set_decision_called: decided,
    agent_recommendation: agentRec,
    decision: final.decision?.outcome ?? null,
    delay_minutes: final.decision?.delay_minutes,
    pattern: final.decision?.pattern?.id ?? null,
    signals: final.signals.map((s) => ({ type: s.type, severity: s.severity, confidence: s.confidence, evidence: s.evidence })),
    escalated_over_agent: final.decision?.escalated_over_agent ?? false,
    contact_requested: contactRequested,
    truth_said: truthSaid,
    ended_by: endedBy,
    error,
    llm_calls: llmCalls,
    tokens,
    wall_ms: Date.now() - t0,
  };
}

/** Strips stage directions and reasoning tags some models emit. */
export function cleanSpeech(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^\s*(customer|assistant|agent|ruko)\s*:\s*/i, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*[^*]{1,60}\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Share of the sentence's words that appear in the text (rough "did they say it"). */
export function overlap(sentence: string, text: string): number {
  const words = sentence.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 2);
  if (!words.length) return 0;
  const t = text.toLowerCase();
  return words.filter((w) => t.includes(w)).length / words.length;
}
