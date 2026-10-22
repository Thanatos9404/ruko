import type { CallInfo, CallStatus, Turn } from "../../shared/types.js";
import type { KV } from "../store/store.js";
import type { CheckService } from "../engine/checks.js";
import { BolnaClient, TERMINAL_STATUSES, parseTranscript, type BolnaExecution } from "./client.js";
import { modelOpinion } from "../engine/toolHandlers.js";
import { confirmSlot, refundSlot } from "../engine/gate.js";

/**
 * Handles Bolna's execution webhooks. Bolna POSTs the execution record several
 * times per call as its status changes, and its documented authenticity controls
 * are a fixed set of source IPs. Ruko layers three checks on top:
 *  1. a secret token in the webhook URL (constant-time compared by the caller),
 *  2. optional source-IP allowlisting,
 *  3. fetch-back: for terminal events, the execution is re-read from Bolna's API
 *     with our key and that copy is used, so a forged body cannot change a check.
 * Deliveries are idempotent per (execution id, status).
 */

export interface WebhookDeps {
  checks: CheckService;
  kv: KV;
  bolna?: BolnaClient;
  agents: { check?: string; contact?: string; line?: string };
}

export interface WebhookResult {
  handled: boolean;
  reason?: string;
  check_id?: string;
  status?: string;
  verified?: boolean;
}

const STATUS_MAP: Record<string, CallStatus> = {
  queued: "queued",
  scheduled: "queued",
  initiated: "queued",
  ringing: "ringing",
  "in-progress": "in-progress",
  "call-disconnected": "in-progress",
  completed: "completed",
  "no-answer": "no-answer",
  busy: "busy",
  failed: "failed",
  canceled: "failed",
  stopped: "failed",
  error: "error",
  "balance-low": "error",
};

export function toTurns(transcript: string | null | undefined): Turn[] {
  return parseTranscript(transcript).map((t) => ({ role: t.role, text: t.text }));
}

export async function handleExecutionWebhook(deps: WebhookDeps, body: unknown): Promise<WebhookResult> {
  const b = (body ?? {}) as Partial<BolnaExecution> & Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : typeof b.execution_id === "string" ? (b.execution_id as string) : null;
  const status = typeof b.status === "string" ? b.status : null;
  if (!id || !status) return { handled: false, reason: "missing id or status" };

  const dedupeKey = `wh:${id}:${status}`;
  if (await deps.kv.get(dedupeKey)) return { handled: false, reason: "duplicate delivery", status };
  const result = await process(deps, b, id, status);
  // Only remember deliveries we actually processed, so a failed verification can be retried.
  if (result.handled) await deps.kv.set(dedupeKey, 1, 7 * 24 * 3600);
  return result;
}

async function process(
  deps: WebhookDeps,
  b: Partial<BolnaExecution> & Record<string, unknown>,
  id: string,
  status: string,
): Promise<WebhookResult> {

  let exec: Partial<BolnaExecution> = b;
  let verified = false;
  if (TERMINAL_STATUSES.has(status) && deps.bolna) {
    try {
      exec = await deps.bolna.getExecution(id);
      verified = true;
    } catch (e) {
      return { handled: false, reason: `could not verify execution with Bolna: ${(e as Error).message}` };
    }
  }

  // Live-call budget: a call that connected spends its slot; one that never connected gets it back.
  if (!TERMINAL_STATUSES.has(status) && /progress|ongoing/i.test(status)) await confirmSlot(deps.kv, id);
  if (TERMINAL_STATUSES.has(status)) {
    const talked = (exec.conversation_duration ?? 0) > 0 || Boolean(exec.transcript && String(exec.transcript).trim());
    if (talked) await confirmSlot(deps.kv, id);
    else await refundSlot(deps.kv, id);
  }

  // Which check? From our execution map, else from the user_data echoed back.
  const recipient = (exec.context_details?.recipient_data ?? b.context_details?.recipient_data ?? {}) as Record<string, unknown>;
  let checkId = await deps.checks.checkIdForExecution(id);
  if (!checkId && typeof recipient.check_id === "string") checkId = recipient.check_id;

  // Public line calls carry no check; just log their cost.
  if (exec.agent_id && exec.agent_id === deps.agents.line) {
    if (TERMINAL_STATUSES.has(status)) await logSpend(deps.kv, { kind: "line", execution_id: id, cost_cents: exec.total_cost ?? null, duration_s: exec.conversation_duration ?? null });
    return { handled: true, status, verified };
  }
  if (!checkId) return { handled: false, reason: "no check linked to this execution", status };
  const check = await deps.checks.get(checkId);
  if (!check) return { handled: false, reason: "check not found", status };

  const isContact = (exec.agent_id && exec.agent_id === deps.agents.contact) || check.contact?.execution_id === id;
  const mapped = STATUS_MAP[status] ?? "in-progress";

  if (isContact) {
    if (TERMINAL_STATUSES.has(status) && check.contact?.status !== "reached") {
      const talked = (exec.conversation_duration ?? 0) > 0;
      if (!talked) await deps.checks.setContact(checkId, { status: "no_answer", execution_id: id });
    }
    if (TERMINAL_STATUSES.has(status)) await logSpend(deps.kv, { kind: "contact", check_id: checkId, execution_id: id, cost_cents: exec.total_cost ?? null, duration_s: exec.conversation_duration ?? null });
    return { handled: true, check_id: checkId, status, verified };
  }

  const call: CallInfo = {
    channel: check.call?.channel ?? (exec.telephony_data?.provider ? "phone" : "web"),
    status: mapped,
    execution_id: id,
    agent_id: exec.agent_id,
    started_at: exec.initiated_at ?? exec.created_at,
    verified_with_bolna: verified || check.call?.verified_with_bolna,
  };
  if (TERMINAL_STATUSES.has(status)) {
    call.ended_at = exec.updated_at ?? new Date().toISOString();
    call.duration_s = exec.conversation_duration ?? exec.telephony_data?.duration ?? undefined;
    call.transcript = toTurns(exec.transcript);
    call.hangup_reason = exec.telephony_data?.hangup_reason;
    call.cost_cents = typeof exec.total_cost === "number" ? exec.total_cost : undefined;
    if (exec.error_message) call.error = String(exec.error_message).slice(0, 200);
  }
  await deps.checks.attachCall(checkId, call);

  if (TERMINAL_STATUSES.has(status)) {
    await logSpend(deps.kv, { kind: "check", check_id: checkId, execution_id: id, cost_cents: exec.total_cost ?? null, duration_s: exec.conversation_duration ?? null });
    const fresh = await deps.checks.require(checkId);
    if (!fresh.decision) {
      const customerSpoke = (call.transcript ?? []).some((t) => t.role === "customer");
      const noConversation = !customerSpoke && fresh.signals.length === 0;
      if (noConversation) await deps.checks.noAnswer(checkId, `Call ${status}, no conversation`);
      else await deps.checks.finalize(checkId, { reason: `call ${status}` });
    }
    // The text model reads the customer's own turns for the console. Advisory: it can flag a
    // release for human review, never change a decision.
    const said = (call.transcript ?? []).filter((t) => t.role === "customer").map((t) => t.text).join("\n");
    const ml = modelOpinion(said, "transcript");
    if (ml) await deps.checks.setModelOpinion(checkId, ml.opinion);
  }
  return { handled: true, check_id: checkId, status, verified };
}

export interface SpendEntry {
  at: string;
  kind: "check" | "contact" | "line" | "mint";
  check_id?: string;
  execution_id?: string;
  cost_cents: number | null;
  duration_s: number | null;
  wallet_before?: number | null;
}

export async function logSpend(kv: KV, e: Omit<SpendEntry, "at">): Promise<void> {
  const list = (await kv.get<SpendEntry[]>("spend:log")) ?? [];
  list.unshift({ at: new Date().toISOString(), ...e });
  await kv.set("spend:log", list.slice(0, 500), 365 * 24 * 3600);
}
