// Types shared by the Ruko API, the eval harness and the web app.
// Amounts are whole rupees (INR). Times are ISO 8601 strings in UTC.

export type Lang = "en" | "hi";
/** Languages the pattern library carries text for (call languages are a subset). */
export type LibraryLang = "en" | "hi" | "ta" | "bn" | "mr";

export type Rail = "UPI" | "IMPS" | "NEFT" | "RTGS" | "CARD";

export type PayeeFlag =
  /** On the bank's or a shared mule-account risk list. */
  | "mule_risk_list"
  /** Reported by other customers or on NCRP. */
  | "reported_by_users"
  /** Receiving account opened recently. */
  | "new_account"
  /** Payee name looks like a "safe", "custody" or "verification" account. */
  | "safe_account_name";

export interface Payee {
  name: string;
  /** UPI ID or a masked account number. Never a full account number. */
  handle: string;
  is_new: boolean;
  prior_payments?: number;
  in_contacts?: boolean;
  flags?: PayeeFlag[];
}

export interface PaymentContext {
  amount_inr: number;
  rail: Rail;
  payee: Payee;
  note?: string;
  /** How the payment was started. */
  initiated_via?: "manual" | "collect_request" | "qr" | "link";
  initiated_at?: string;
  /** IANA timezone of the customer; defaults to Asia/Kolkata. */
  timezone?: string;
}

export interface TrustedContact {
  name: string;
  relation: string;
  phone_e164: string;
  /** The customer agreed, in advance, that the bank may call this person in a safety check. */
  consent_on_file: boolean;
}

export interface CustomerProfile {
  /** Bank's own opaque reference. Ruko never needs the account number. */
  customer_ref: string;
  name: string;
  language: Lang;
  phone_e164?: string;
  digital_tenure_days: number;
  avg_amount_90d: number;
  max_amount_90d: number;
  payments_last_hour?: number;
  amount_last_24h?: number;
  /** Bank-set flag for customers who asked for extra protection or are known to be at higher risk. */
  vulnerability_flag?: boolean;
  /** Customer told the bank in advance about a planned large payment (e.g. a house deposit). */
  planned_large_payment?: boolean;
  trusted_contact?: TrustedContact;
}

export interface DeviceSignals {
  /** A phone or VoIP call was active on the device while the payment was being made. */
  active_call?: boolean;
  active_call_minutes?: number;
  caller_in_contacts?: boolean;
  /** A remote-access or screen-sharing app is running. */
  remote_access_app?: boolean;
  new_device?: boolean;
}

export type RiskBand = "low" | "elevated" | "high";

export interface RiskReason {
  code: string;
  weight: number;
  title: string;
  detail: string;
  hard?: boolean;
}

export interface RiskAssessment {
  score: number;
  band: RiskBand;
  action: "allow" | "hold";
  reasons: RiskReason[];
  policy_version: string;
}

export type Severity = "critical" | "high" | "medium" | "mitigating" | "process";
export type Confidence = "high" | "medium" | "low";

export interface Signal {
  id: string;
  type: string;
  severity: Severity;
  confidence: Confidence;
  evidence: string;
  pattern_hint?: string;
  at: string;
  source: "agent" | "contact_agent" | "device" | "policy";
}

export type Outcome = "release" | "delay" | "block";

export interface DecisionReason {
  code: string;
  text: string;
  signal_ids?: string[];
}

export interface Decision {
  outcome: Outcome;
  reasons: DecisionReason[];
  delay_minutes?: number;
  pattern?: { id: string; name: string } | null;
  agent_recommendation?: Outcome | null;
  /** True when the policy was stricter than the agent's recommendation. */
  escalated_over_agent?: boolean;
  customer_message: string;
  /** What happens when a delay runs out: never an automatic release. */
  on_expiry?: "fraud_desk_callback";
  /** Whether the customer may confirm the payment themselves in the app (never after a hard rule). */
  self_confirm_allowed?: boolean;
  decided_at: string;
  policy_version: string;
}

export interface Turn {
  role: "agent" | "customer" | "tool";
  text: string;
  at?: string;
  tool?: string;
}

export type CallChannel = "phone" | "web" | "text-eval";

export type CallStatus =
  | "pending"
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "no-answer"
  | "busy"
  | "failed"
  | "error"
  | "not_configured";

export interface CallInfo {
  channel: CallChannel;
  status: CallStatus;
  execution_id?: string;
  agent_id?: string;
  started_at?: string;
  ended_at?: string;
  duration_s?: number;
  transcript?: Turn[];
  hangup_reason?: string;
  cost_cents?: number;
  /** Set when the call record was fetched back from Bolna to verify a webhook. */
  verified_with_bolna?: boolean;
  error?: string;
}

export type ContactStatus =
  | "not_requested"
  | "consent_declined"
  | "no_contact_on_file"
  | "dialing"
  /** Demo only: phone calls are off, so the contact's call rings in a browser tab instead. */
  | "ringing_web"
  | "reached"
  | "no_answer"
  | "not_configured"
  /** Recorded (text-mode) replays: the contact call is shown but not placed. */
  | "simulated";

export interface ContactOutcome {
  reached: boolean;
  knows_about_payment?: boolean;
  will_call_customer?: boolean;
  concern_raised?: boolean;
  notes?: string;
}

export interface ContactCall {
  status: ContactStatus;
  channel?: "phone" | "web" | "text-eval";
  requested_at?: string;
  updated_at?: string;
  execution_id?: string;
  outcome?: ContactOutcome;
}

export type CheckStatus = "allowed" | "holding" | "in_call" | "decided" | "expired";

export interface AuditEvent {
  at: string;
  type: string;
  detail: string;
}

export type CheckOrigin = "api" | "sandbox" | "eval-replay";

/**
 * The on-server text model's opinion of what the customer said. Advisory only:
 * it is kept apart from the agent's signals and never enters the decision policy.
 */
export interface ModelOpinion {
  source: "evidence" | "transcript";
  band: "likely_scam" | "possible_scam" | "unlikely_scam" | "unknown";
  scam_probability: number | null;
  patterns: { id: string; name: string; p_given_scam: number | null }[];
  /** Cue phrases the model saw (customer turns only, redacted). */
  cues: string[];
  model_version: string | null;
  /** True when the model leans scam but the decision released the payment: a human should look. */
  disagrees_with_decision?: boolean;
  at: string;
}

export interface Check {
  id: string;
  tenant: string;
  mode: "live" | "demo" | "eval";
  /** Where the check came from: a bank's API call, the public sandbox, or an eval conversation replayed through the engine (synthetic customer). */
  origin?: CheckOrigin;
  created_at: string;
  updated_at: string;
  status: CheckStatus;
  payment: PaymentContext;
  customer: CustomerProfile;
  device: DeviceSignals;
  risk: RiskAssessment;
  code_word?: string;
  hold_expires_at?: string;
  call?: CallInfo;
  signals: Signal[];
  contact?: ContactCall;
  agent_recommendation?: { outcome: Outcome; reason: string; at: string } | null;
  decision?: Decision | null;
  /** Advisory text-model opinion (see ModelOpinion). Never used by the decision policy. */
  ml?: ModelOpinion;
  events: AuditEvent[];
}

/** What the bank's backend receives from POST /v1/checks. */
export interface CheckCreated {
  id: string;
  action: "allow" | "hold";
  risk: RiskAssessment;
  code_word?: string;
  client_secret?: string;
  hold_expires_at?: string;
  call?: CallInfo;
  links: { self: string; app_status?: string };
}

/** Minimal status the customer's app polls with the check's client secret. */
export interface AppStatus {
  id: string;
  status: CheckStatus;
  action: "allow" | "hold";
  code_word?: string;
  amount_inr: number;
  payee_name: string;
  call?: Pick<CallInfo, "channel" | "status">;
  signals: Pick<Signal, "type" | "severity" | "evidence">[];
  contact?: Pick<ContactCall, "status">;
  decision?: Pick<Decision, "outcome" | "customer_message" | "delay_minutes" | "pattern" | "reasons" | "escalated_over_agent" | "agent_recommendation"> | null;
  risk: Pick<RiskAssessment, "score" | "band" | "reasons">;
  customer_name: string;
  language: Lang;
  trusted_contact?: { name: string; relation: string } | null;
  created_at: string;
  /** The engine's audit trail for this check, newest last. */
  events: AuditEvent[];
}
