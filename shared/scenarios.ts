import type { CustomerProfile, DeviceSignals, PaymentContext } from "./types.js";

/**
 * Demo payments for the sandbox app. Every person, payee and number is invented.
 * India has no reserved range of fictional phone numbers, so fixtures use the
 * UK Ofcom drama range (+44 7700 900000–900999), which is never assigned.
 */
export interface DemoScenario {
  id: string;
  title: string;
  blurb: string;
  truth: "scam" | "genuine";
  payment: Omit<PaymentContext, "initiated_at">;
  customer: CustomerProfile;
  device: DeviceSignals;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "digital-arrest",
    title: "A 'CBI officer' on video call",
    blurb: "Kamla, 68, has been on a video call for 47 minutes. She's told to move her savings to a 'safe custody' account.",
    truth: "scam",
    payment: {
      amount_inr: 1_90_000,
      rail: "IMPS",
      payee: { name: "Safe Custody Account RBI", handle: "XXXXXXXX4417 · IFSC ending 0457", is_new: true, prior_payments: 0, in_contacts: false },
      note: "verification",
      initiated_via: "manual",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-001",
      name: "Kamla",
      language: "hi",
      phone_e164: "+447700900101",
      digital_tenure_days: 210,
      avg_amount_90d: 3_200,
      max_amount_90d: 12_000,
      vulnerability_flag: true,
      trusted_contact: { name: "Ravi", relation: "son", phone_e164: "+447700900102", consent_on_file: true },
    },
    device: { active_call: true, active_call_minutes: 47, caller_in_contacts: false, remote_access_app: false },
  },
  {
    id: "investment-group",
    title: "A WhatsApp 'stock tips' group",
    blurb: "Rohan has made 'profits' on a trading app. To withdraw, he's told to pay a 15% 'tax' first.",
    truth: "scam",
    payment: {
      amount_inr: 75_000,
      rail: "UPI",
      payee: { name: "Alpha Trade Desk", handle: "alphatrade.desk@okdemo", is_new: true, prior_payments: 0, in_contacts: false },
      note: "tax",
      initiated_via: "manual",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-002",
      name: "Rohan",
      language: "en",
      phone_e164: "+447700900103",
      digital_tenure_days: 900,
      avg_amount_90d: 6_500,
      max_amount_90d: 22_000,
      trusted_contact: { name: "Meera", relation: "sister", phone_e164: "+447700900104", consent_on_file: true },
    },
    device: { active_call: false },
  },
  {
    id: "flat-deposit",
    title: "A deposit for a new flat",
    blurb: "Priya is paying a booking amount to a builder she met at their site office. Large and first-time, but genuine.",
    truth: "genuine",
    payment: {
      amount_inr: 1_50_000,
      rail: "NEFT",
      payee: { name: "Shree Ganesh Builders", handle: "XXXXXXXX2290 · IFSC ending 0112", is_new: true, prior_payments: 0, in_contacts: false },
      note: "booking amount flat B-1204",
      initiated_via: "manual",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-003",
      name: "Priya",
      language: "en",
      phone_e164: "+447700900105",
      digital_tenure_days: 1400,
      avg_amount_90d: 14_000,
      max_amount_90d: 40_000,
      trusted_contact: { name: "Anil", relation: "husband", phone_e164: "+447700900106", consent_on_file: true },
    },
    device: { active_call: true, active_call_minutes: 4, caller_in_contacts: true },
  },
  {
    id: "task-job",
    title: "A 'like videos, earn money' job",
    blurb: "Neha earned ₹450 liking videos. Now a 'prepaid task' needs ₹12,000 to unlock her commission.",
    truth: "scam",
    payment: {
      amount_inr: 12_000,
      rail: "UPI",
      payee: { name: "TaskPay Rewards", handle: "taskpay.rewards@okdemo", is_new: true, prior_payments: 0, in_contacts: false },
      initiated_via: "manual",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-004",
      name: "Neha",
      language: "hi",
      phone_e164: "+447700900107",
      digital_tenure_days: 60,
      avg_amount_90d: 900,
      max_amount_90d: 3_000,
      payments_last_hour: 3,
      amount_last_24h: 14_500,
    },
    device: { active_call: false, new_device: false },
  },
  {
    id: "hospital-bill",
    title: "A hospital bill for a parent",
    blurb: "Mohan is paying his father's hospital deposit while his brother calls from the ward. Urgent, but genuine.",
    truth: "genuine",
    payment: {
      amount_inr: 85_000,
      rail: "UPI",
      payee: { name: "City Care Hospital", handle: "citycare.billing@okdemo", is_new: true, prior_payments: 0, in_contacts: false },
      note: "ipd deposit",
      initiated_via: "qr",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-005",
      name: "Mohan",
      language: "hi",
      phone_e164: "+447700900109",
      digital_tenure_days: 700,
      avg_amount_90d: 5_000,
      max_amount_90d: 25_000,
      trusted_contact: { name: "Sunita", relation: "wife", phone_e164: "+447700900110", consent_on_file: true },
    },
    device: { active_call: true, active_call_minutes: 6, caller_in_contacts: true },
  },
  {
    id: "rent",
    title: "Monthly rent",
    blurb: "Arjun pays his landlord, as he has for a year. No hold: Ruko stays out of the way.",
    truth: "genuine",
    payment: {
      amount_inr: 28_000,
      rail: "UPI",
      payee: { name: "Suresh Iyer", handle: "suresh.iyer@okdemo", is_new: false, prior_payments: 11, in_contacts: true },
      note: "rent october",
      initiated_via: "manual",
      timezone: "Asia/Kolkata",
    },
    customer: {
      customer_ref: "demo-cust-006",
      name: "Arjun",
      language: "en",
      phone_e164: "+447700900111",
      digital_tenure_days: 1800,
      avg_amount_90d: 9_000,
      max_amount_90d: 28_000,
    },
    device: { active_call: false },
  },
];

export const scenarioById = (id: string) => DEMO_SCENARIOS.find((s) => s.id === id);
