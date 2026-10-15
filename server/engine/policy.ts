import type {
  CustomerProfile,
  DeviceSignals,
  PaymentContext,
  RiskAssessment,
  RiskBand,
  RiskReason,
} from "../../shared/types.js";
import { formatINR } from "../../shared/format.js";

/**
 * Pre-payment risk policy. Transparent on purpose: every point of the score comes
 * from a named rule with a plain-language reason, so a bank's fraud team (and a
 * customer who asks) can see exactly why a payment was held.
 *
 * The weights are a starting point a bank tunes on its own data. They are not
 * learned from data in this repository.
 */
export const POLICY_VERSION = "2026-10-16.1";

export interface PolicyConfig {
  holdThreshold: number;
  highThreshold: number;
  largeAmount: number;
  veryLargeAmount: number;
  oddHourStart: number;
  oddHourEnd: number;
}

export const DEFAULT_POLICY: PolicyConfig = {
  holdThreshold: 30,
  highThreshold: 60,
  largeAmount: 50_000,
  veryLargeAmount: 2_00_000,
  oddHourStart: 0,
  oddHourEnd: 5,
};

const SAFE_ACCOUNT_WORDS = [
  "safe account",
  "safe custody",
  "custody",
  "verification",
  "rbi",
  "cbi",
  "police",
  "court",
  "escrow",
  "suspense",
  "refund",
  "customs",
  "investigation",
  "settlement",
];

/** True when a payee name reads like the "safe account" that impersonators ask victims to move money into. */
export function looksLikeSafeAccount(name: string): boolean {
  const n = name.toLowerCase();
  return SAFE_ACCOUNT_WORDS.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(n));
}

export function localHour(iso: string | undefined, timezone = "Asia/Kolkata"): number {
  const d = iso ? new Date(iso) : new Date();
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(d);
  return Number(h) % 24;
}

interface Ctx {
  payment: PaymentContext;
  customer: CustomerProfile;
  device: DeviceSignals;
  cfg: PolicyConfig;
}

type Rule = (ctx: Ctx) => RiskReason | null;

const rules: Rule[] = [
  // Hard holds: these patterns are strongly tied to authorised-push-payment fraud.
  ({ device }) =>
    device.remote_access_app
      ? {
          code: "REMOTE_ACCESS_ACTIVE",
          weight: 35,
          hard: true,
          title: "Screen-sharing app running",
          detail: "A remote-access or screen-sharing app was running while the payment was made.",
        }
      : null,
  ({ payment }) => {
    const flagged = payment.payee.flags?.includes("safe_account_name") || looksLikeSafeAccount(payment.payee.name);
    return flagged
      ? {
          code: "SAFE_ACCOUNT_PAYEE",
          weight: 35,
          hard: true,
          title: "Payee looks like a 'safe account'",
          detail: `The payee name "${payment.payee.name}" reads like a custody, verification or agency account. Real agencies never ask people to move money into one.`,
        }
      : null;
  },
  ({ payment }) =>
    payment.payee.flags?.includes("mule_risk_list")
      ? {
          code: "PAYEE_ON_RISK_LIST",
          weight: 35,
          hard: true,
          title: "Payee on a mule-risk list",
          detail: "The receiving account is on the bank's or a shared mule-account risk list.",
        }
      : null,
  ({ payment }) =>
    payment.payee.flags?.includes("reported_by_users")
      ? {
          code: "PAYEE_REPORTED",
          weight: 20,
          title: "Payee reported by others",
          detail: "Other customers have reported this payee.",
        }
      : null,
  ({ device }) => {
    if (!device.active_call) return null;
    const long = (device.active_call_minutes ?? 0) >= 10;
    const unknown = device.caller_in_contacts === false;
    const extra = (long ? 5 : 0) + (unknown ? 10 : 0);
    const bits = [
      "A phone call was active on the device during the payment",
      long ? `, for ${device.active_call_minutes} minutes` : "",
      unknown ? ", with a number not in the customer's contacts" : "",
    ].join("");
    return {
      code: "ACTIVE_CALL_DURING_PAYMENT",
      weight: 22 + extra,
      title: "On a call while paying",
      detail: `${bits}. Coached victims are usually still on the line with the caller.`,
    };
  },
  ({ payment }) =>
    payment.payee.is_new
      ? {
          code: "NEW_PAYEE",
          weight: 15,
          title: "First payment to this payee",
          detail: "The customer has never paid this payee before.",
        }
      : null,
  ({ payment }) =>
    payment.payee.flags?.includes("new_account")
      ? {
          code: "PAYEE_NEW_ACCOUNT",
          weight: 10,
          title: "Receiving account is new",
          detail: "The receiving account was opened recently.",
        }
      : null,
  ({ payment, customer }) => {
    const max = Math.max(customer.max_amount_90d, 1);
    const ratio = payment.amount_inr / max;
    if (ratio >= 3) {
      return {
        code: "AMOUNT_FAR_ABOVE_USUAL",
        weight: 20,
        title: "Much larger than usual",
        detail: `${formatINR(payment.amount_inr)} is ${ratio.toFixed(1)}× the largest payment in the last 90 days (${formatINR(customer.max_amount_90d)}).`,
      };
    }
    if (payment.amount_inr >= 5 * Math.max(customer.avg_amount_90d, 1) && ratio >= 1.5) {
      return {
        code: "AMOUNT_ABOVE_USUAL",
        weight: 10,
        title: "Larger than usual",
        detail: `${formatINR(payment.amount_inr)} is well above the customer's usual payments (average ${formatINR(customer.avg_amount_90d)}).`,
      };
    }
    return null;
  },
  ({ payment, cfg }) => {
    if (payment.amount_inr >= cfg.veryLargeAmount)
      return {
        code: "VERY_LARGE_AMOUNT",
        weight: 15,
        title: "Very large amount",
        detail: `${formatINR(payment.amount_inr)} is at or above ${formatINR(cfg.veryLargeAmount)}.`,
      };
    if (payment.amount_inr >= cfg.largeAmount)
      return {
        code: "LARGE_AMOUNT",
        weight: 8,
        title: "Large amount",
        detail: `${formatINR(payment.amount_inr)} is at or above ${formatINR(cfg.largeAmount)}.`,
      };
    return null;
  },
  ({ payment, cfg }) => {
    const h = localHour(payment.initiated_at, payment.timezone);
    return h >= cfg.oddHourStart && h < cfg.oddHourEnd
      ? {
          code: "ODD_HOUR",
          weight: 8,
          title: "Unusual hour",
          detail: `Started at ${String(h).padStart(2, "0")}:00 local time.`,
        }
      : null;
  },
  ({ payment, customer }) =>
    customer.digital_tenure_days < 90 && payment.amount_inr >= 20_000
      ? {
          code: "NEW_DIGITAL_PAYER_HIGH_VALUE",
          weight: 12,
          title: "New digital payer, high value",
          detail: `The customer started paying digitally ${customer.digital_tenure_days} days ago and this is a high-value payment.`,
        }
      : null,
  ({ customer }) => {
    const n = customer.payments_last_hour ?? 0;
    const sum = customer.amount_last_24h ?? 0;
    if (n >= 3 || sum >= 1_00_000)
      return {
        code: "VELOCITY",
        weight: 15,
        title: "Several payments in a short time",
        detail: `${n} payments in the last hour; ${formatINR(sum)} sent in the last 24 hours.`,
      };
    return null;
  },
  ({ payment }) =>
    payment.initiated_via === "collect_request" || payment.initiated_via === "link"
      ? {
          code: "STARTED_FROM_REQUEST_OR_LINK",
          weight: 10,
          title: "Started from a request or link",
          detail:
            payment.initiated_via === "collect_request"
              ? "The payment answers a collect request. Approving a request sends money; it never receives it."
              : "The payment was opened from a link.",
        }
      : null,
  ({ device }) =>
    device.new_device
      ? {
          code: "NEW_DEVICE",
          weight: 8,
          title: "New device",
          detail: "The app was set up on this device recently.",
        }
      : null,
  ({ customer }) =>
    customer.vulnerability_flag
      ? {
          code: "EXTRA_PROTECTION",
          weight: 6,
          title: "Customer opted into extra protection",
          detail: "The customer (or the bank, with their agreement) turned on extra protection for large payments.",
        }
      : null,
  // Mitigations. These lower the score; they never cancel a hard hold.
  ({ payment }) =>
    !payment.payee.is_new && (payment.payee.prior_payments ?? 0) >= 3
      ? {
          code: "ESTABLISHED_PAYEE",
          weight: -20,
          title: "Established payee",
          detail: `The customer has paid this payee ${payment.payee.prior_payments} times before.`,
        }
      : null,
  ({ payment }) =>
    payment.payee.in_contacts
      ? {
          code: "PAYEE_IN_CONTACTS",
          weight: -8,
          title: "Payee is in contacts",
          detail: "The payee's number is saved in the customer's contacts.",
        }
      : null,
  ({ customer }) =>
    customer.planned_large_payment
      ? {
          code: "PLANNED_PAYMENT",
          weight: -15,
          title: "Planned in advance",
          detail: "The customer told the bank about this large payment in advance.",
        }
      : null,
];

export function assessRisk(
  payment: PaymentContext,
  customer: CustomerProfile,
  device: DeviceSignals = {},
  cfg: PolicyConfig = DEFAULT_POLICY,
): RiskAssessment {
  const ctx: Ctx = { payment, customer, device, cfg };
  const reasons = rules.map((r) => r(ctx)).filter((r): r is RiskReason => r !== null);
  reasons.sort((a, b) => b.weight - a.weight);
  const raw = reasons.reduce((s, r) => s + r.weight, 0);
  const score = Math.max(0, Math.min(100, raw));
  const hard = reasons.some((r) => r.hard);
  const action = hard || score >= cfg.holdThreshold ? "hold" : "allow";
  const band: RiskBand = score >= cfg.highThreshold || hard ? "high" : score >= cfg.holdThreshold ? "elevated" : "low";
  return { score, band, action, reasons, policy_version: POLICY_VERSION };
}
