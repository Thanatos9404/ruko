import type { EvalScenario, Style } from "./scenarios.js";

/**
 * Held-out scenarios, written after the first full run and never used to tune
 * prompts or policy. New stories (different scam variants and payers) so the
 * reported numbers are not just the development set.
 */

const STYLE_RULE: Record<Style, string> = {
  en: "Speak natural Indian English.",
  hi: "Speak only in simple, natural Hindi written in Devanagari script.",
  hinglish: "Speak Hinglish: everyday Hindi mixed with English words, written in Roman script.",
};
export const rules = (s: Style) =>
  `${STYLE_RULE[s]} You are on a phone call with your bank's safety assistant. Say only what you would say out loud, in one or two short sentences. Never mention that you are role-playing or an AI. If the assistant says goodbye or the call clearly ends, reply exactly [END].`;

export const phone = (i: number) => `+447700900${String(700 + i).padStart(3, "0")}`;

export interface Story {
  key: string;
  kind: "scam" | "genuine";
  payee: string;
  handle: string;
  amount: number;
  on_call: boolean;
  caller_known?: boolean;
  story: string;
  coached?: string;
}

const STORIES: Story[] = [
  {
    key: "fake_bank_safe_account",
    kind: "scam",
    payee: "Account Security Holding",
    handle: "XXXXXXXX5521",
    amount: 3_10_000,
    on_call: true,
    story:
      "A man saying he's from your bank's fraud department called: hackers are inside your account and you must move all your money to a 'secure holding account' right now. He knew your name and last transaction. He's still on the line.",
    coached: "Say it's for a fixed deposit at another bank. Don't mention me, the hackers may be listening.",
  },
  {
    key: "wrong_transfer_refund",
    kind: "scam",
    payee: "Sameer Khan",
    handle: "sameer.khan77@okdemo",
    amount: 15_000,
    on_call: true,
    story:
      "You got an SMS saying ₹15,000 was credited to you, then a man called crying that he sent it by mistake and needs it back for his mother's treatment. Your bank app doesn't actually show any credit, but he says it takes time to reflect.",
    coached: "Say you're returning money to a friend.",
  },
  {
    key: "loan_processing_fee",
    kind: "scam",
    payee: "Quick Finance Approval Desk",
    handle: "qfdesk.approval@okdemo",
    amount: 22_500,
    on_call: false,
    story:
      "You applied online for a ₹5 lakh personal loan. An 'agent' on WhatsApp says it's approved, but you must pay a ₹22,500 'insurance and processing fee' first for disbursal today.",
  },
  {
    key: "crypto_recovery",
    kind: "scam",
    payee: "Global Asset Recovery Cell",
    handle: "recovery.cell@okdemo",
    amount: 48_000,
    on_call: false,
    story:
      "You lost money to a trading app last year. Someone on Instagram claiming to be a 'cyber recovery agent' working with the police says he can recover ₹6 lakh if you pay a ₹48,000 legal fee first.",
  },
  {
    key: "army_buyer_qr",
    kind: "scam",
    payee: "Ramesh Kumar Army Canteen",
    handle: "rk.armycanteen@okdemo",
    amount: 20_000,
    on_call: true,
    story:
      "You're selling your sofa online. A buyer who says he's in the army sent a QR code and says you must 'scan and pay ₹20,000 to receive ₹40,000' as part of the army payment process. He's on the phone guiding you.",
    coached: "It's a payment for a purchase.",
  },
  {
    key: "romance_customs_gift",
    kind: "scam",
    payee: "Delhi Airport Customs Duty",
    handle: "customs.duty.del@okdemo",
    amount: 75_000,
    on_call: false,
    story:
      "A man you met on a dating app two months ago, who says he's a surgeon in the UK, sent you a gift parcel with jewellery and pounds. A 'customs officer' says you must pay ₹75,000 duty or he'll be arrested for money laundering. Your friend says it's a trap, but you trust him.",
  },
  {
    key: "fake_traffic_challan",
    kind: "scam",
    payee: "e-Challan Payment Centre",
    handle: "echallan.centre@okdemo",
    amount: 9_500,
    on_call: true,
    story:
      "You got a WhatsApp message about a traffic challan with an app to download. After installing it, a 'traffic officer' called and says your vehicle will be seized unless you pay pending fines of ₹9,500 now. He asked you to keep the app open while you pay.",
    coached: "Just say it's a challan.",
  },
  {
    key: "insurance_lapse_bonus",
    kind: "scam",
    payee: "Policy Bonus Release Cell",
    handle: "bonus.release@okdemo",
    amount: 38_000,
    on_call: true,
    story:
      "A caller saying he's from the insurance regulator says your old life insurance policy has a ₹8 lakh bonus waiting, but you must first pay ₹38,000 in GST and 'NOC charges'. He has your policy number and is still on the line.",
    coached: "Don't tell the bank about the bonus or they'll deduct tax.",
  },
  {
    key: "school_fees",
    kind: "genuine",
    payee: "St Xavier's School Fee Account",
    handle: "stxaviers.fees@okdemo",
    amount: 46_000,
    on_call: false,
    story: "You're paying your son's annual school fees using the UPI ID printed on the school's fee circular that came home in his diary.",
  },
  {
    key: "carpenter",
    kind: "genuine",
    payee: "Mohd Salim Furniture Works",
    handle: "salim.furniture@okdemo",
    amount: 64_000,
    on_call: false,
    story: "A carpenter has finished your new kitchen cabinets. He's standing in your kitchen; you've checked the work and are paying the agreed balance.",
  },
  {
    key: "son_abroad",
    kind: "genuine",
    payee: "Aditya Rao",
    handle: "XXXXXXXX8812",
    amount: 1_80_000,
    on_call: true,
    caller_known: true,
    story: "You're sending your son Aditya money for his master's tuition in Germany. He's on a video call with you right now showing you the university's fee invoice; this is his Indian account.",
  },
  {
    key: "jeweller",
    kind: "genuine",
    payee: "Shree Laxmi Jewellers",
    handle: "XXXXXXXX3307",
    amount: 2_40_000,
    on_call: false,
    story: "You're buying gold bangles for your daughter's wedding at the family jeweller you've used for years. You're at the shop and the bill is in your hand.",
  },
  {
    key: "caterer",
    kind: "genuine",
    payee: "Annapurna Caterers",
    handle: "annapurna.caterers@okdemo",
    amount: 90_000,
    on_call: true,
    caller_known: true,
    story: "You're paying the advance for your daughter's wedding catering. You tasted their food last week; your wife is on the phone confirming the menu with you.",
  },
  {
    key: "temple_donation",
    kind: "genuine",
    payee: "Shri Ram Mandir Trust",
    handle: "srmtrust@okdemo",
    amount: 21_000,
    on_call: false,
    story: "You're donating to your local temple's renovation fund using the QR code displayed at the temple office, as you decided with your family on your father's death anniversary.",
  },
];

export function buildHoldout(): EvalScenario[] {
  const out: EvalScenario[] = [];
  let i = 0;
  const styles: Style[] = ["en", "hinglish", "hi"];
  for (const st of STORIES) {
    for (const style of st.kind === "scam" ? (["en", "hinglish"] as Style[]) : (["en", "hi"] as Style[])) {
      i++;
      const name = ["Lata", "Suresh", "Divya", "Prakash", "Rani", "Gopal", "Shalini", "Anil"][i % 8];
      const attitude =
        st.kind === "scam"
          ? i % 2
            ? "You are worried; if the assistant asks what is happening, you explain honestly."
            : `You have been coached${st.coached ? `: "${st.coached}"` : ""}. Stick to that at first and deny anyone is instructing you; admit the truth only if asked directly and kindly.`
          : "Nobody pressured you. You answer honestly and want it done quickly.";
      out.push({
        id: `holdout-${st.kind}-${st.key}-${style}`,
        kind: st.kind,
        pattern: st.kind === "scam" ? st.key : undefined,
        style,
        coaching: st.kind === "scam" ? (i % 2 ? "light" : "heavy") : undefined,
        persona: `You are ${name}. ${st.story} ${attitude} ${rules(style)}`,
        payment: {
          amount_inr: st.amount,
          rail: st.handle.startsWith("XXXX") ? "IMPS" : "UPI",
          payee: { name: st.payee, handle: st.handle, is_new: true, prior_payments: 0, in_contacts: false },
          initiated_via: "manual",
          timezone: "Asia/Kolkata",
        },
        customer: {
          customer_ref: `holdout-${i}`,
          name,
          language: style === "en" ? "en" : "hi",
          phone_e164: phone(i),
          digital_tenure_days: 500,
          avg_amount_90d: 6_000,
          max_amount_90d: 20_000,
          trusted_contact: i % 3 ? { name: "Kiran", relation: "sister", phone_e164: phone(i + 100), consent_on_file: true } : undefined,
        },
        device: st.on_call ? { active_call: true, active_call_minutes: 12, caller_in_contacts: Boolean(st.caller_known) } : { active_call: false },
        expect: st.kind === "scam" ? ["delay", "block"] : ["release"],
      });
    }
  }
  void styles;
  return out;
}
