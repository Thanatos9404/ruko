import type { Severity } from "./types.js";

export interface SignalDef {
  type: string;
  severity: Severity;
  label: string;
  /** What the agent should listen for. Shown to the LLM in the tool description. */
  listen_for: string;
}

/**
 * The signals the voice agent can record during a check. Severity drives the
 * decision policy; the agent only labels what it hears, it never decides alone.
 */
export const SIGNALS: SignalDef[] = [
  {
    type: "coached_on_call",
    severity: "critical",
    label: "A stranger or 'official' is directing them on another call",
    listen_for:
      "Someone the customer does not know personally, or who claims to be an official, is on another phone or video call (or was) telling them what to do or say. NOT a family member or friend who is helping: use family_helping for that.",
  },
  {
    type: "authority_threat",
    severity: "critical",
    label: "Told they are under investigation or arrest",
    listen_for:
      "Someone said they are under investigation, facing arrest or 'digital arrest', or linked to a crime, and claimed to be police, CBI, ED, customs, RBI, TRAI, a court or a courier.",
  },
  {
    type: "secrecy_demand",
    severity: "critical",
    label: "Told to keep it secret",
    listen_for: "Someone told them not to tell family, the bank or anyone else about this payment.",
  },
  {
    type: "remote_access",
    severity: "critical",
    label: "Screen-sharing or remote app installed on request",
    listen_for: "They installed an app or shared their screen because someone asked them to (AnyDesk, TeamViewer, a 'support' app, an APK).",
  },
  {
    type: "urgency_pressure",
    severity: "high",
    label: "Pressured to pay immediately",
    listen_for: "They were told to pay right now or face a penalty, arrest, blocked account or lost opportunity.",
  },
  {
    type: "payee_unknown",
    severity: "high",
    label: "Does not really know the payee",
    listen_for: "They cannot say who the payee is, or the payee does not match the purpose they describe.",
  },
  {
    type: "promised_returns",
    severity: "high",
    label: "Promised high returns",
    listen_for: "An investment, trading app, IPO or 'tips' group promising high or guaranteed returns, often met on WhatsApp or Telegram.",
  },
  {
    type: "pay_to_earn",
    severity: "high",
    label: "Paying to unlock earnings or a job",
    listen_for: "They must pay to unlock task earnings, a part-time job, a commission or a withdrawal.",
  },
  {
    type: "pay_to_receive",
    severity: "high",
    label: "Paying a fee to receive money",
    listen_for: "They must pay a fee or tax to receive a refund, prize, lottery, loan, parcel or gift.",
  },
  {
    type: "account_block_threat",
    severity: "high",
    label: "Threat that account, KYC or SIM will be blocked",
    listen_for: "They were told their bank account, KYC, card, electricity or SIM will be blocked or cut off unless they act.",
  },
  {
    type: "relative_emergency",
    severity: "high",
    label: "Unverified emergency involving a relative",
    listen_for: "A caller said a relative is arrested, injured or stuck and needs money now, and the customer has not spoken to that relative directly.",
  },
  {
    type: "codeword_mismatch",
    severity: "high",
    label: "Code word did not match",
    listen_for: "The customer says the code word in their app is different from the one you said.",
  },
  {
    type: "story_conflict",
    severity: "high",
    label: "Their story doesn't fit the facts",
    listen_for:
      "What they say contradicts what the bank can see: a 'cousin' when the payee is a 'Safe Custody Account', or 'family is on the call' when the caller's number isn't in their contacts.",
  },
  {
    type: "distress",
    severity: "medium",
    label: "Sounds afraid or distressed",
    listen_for: "The customer sounds frightened, is crying, or says they are scared.",
  },
  {
    type: "family_helping",
    severity: "mitigating",
    label: "A family member or friend is helping",
    listen_for: "A family member or friend they know personally is on the phone or with them, helping with the app or the payment.",
  },
  {
    type: "knows_payee",
    severity: "mitigating",
    label: "Knows the payee personally",
    listen_for: "They know the payee personally (family, landlord, employer, a shop or hospital they deal with) and can say how.",
  },
  {
    type: "own_initiative",
    severity: "mitigating",
    label: "Started the payment on their own",
    listen_for: "Nobody asked or told them to make this payment; it was their own plan.",
  },
  {
    type: "purpose_consistent",
    severity: "mitigating",
    label: "Purpose fits payee and amount",
    listen_for: "The purpose they describe fits the payee and the amount (for example rent to their landlord, fees to a college).",
  },
  {
    type: "verified_independently",
    severity: "mitigating",
    label: "Verified through an official channel",
    listen_for: "They checked the request themselves through a channel they found independently, such as the official website or by calling the relative back.",
  },
  {
    type: "wants_to_cancel",
    severity: "process",
    label: "Customer wants to cancel",
    listen_for: "The customer says they want to stop or cancel the payment.",
  },
  {
    type: "wants_more_time",
    severity: "process",
    label: "Customer wants time to check",
    listen_for: "The customer wants time to think or check with someone before paying.",
  },
];

export const SIGNAL_TYPES = SIGNALS.map((s) => s.type);

export const signalDef = (type: string): SignalDef | undefined => SIGNALS.find((s) => s.type === type);

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  process: 1,
  mitigating: 0,
};
