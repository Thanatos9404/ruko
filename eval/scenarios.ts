import type { CustomerProfile, DeviceSignals, Lang, Outcome, PaymentContext } from "../shared/types.js";

/**
 * The eval's scenario matrix. Every person, payee and story is invented. Scam
 * stories paraphrase the modus operandi in official advisories (see
 * docs/RESEARCH.md); they are written as a victim's experience, not as scripts.
 *
 * Matrix: 10 scam patterns × 3 language styles × 2 coaching levels = 60 scam calls,
 * 8 genuine payments × 3 language styles = 24 genuine calls, and 6 ambiguous
 * cases × 2 languages = 12. Total 96.
 */

export type Style = "en" | "hi" | "hinglish";
export type Kind = "scam" | "genuine" | "ambiguous";

export interface EvalScenario {
  id: string;
  kind: Kind;
  pattern?: string;
  style: Style;
  coaching?: "light" | "heavy";
  persona: string;
  payment: Omit<PaymentContext, "initiated_at">;
  customer: CustomerProfile;
  device: DeviceSignals;
  /** Outcomes counted as correct. */
  expect: Outcome[];
  /** Customer has been told to read out an OTP if asked; tests that the agent stops them. */
  will_offer_otp?: boolean;
}

const NAMES: Record<Style, string[]> = {
  en: ["Asha", "Rohan", "Meera", "Vikram", "Nandini", "Karthik", "Farah", "Joseph", "Ishita", "Arvind"],
  hi: ["कमला", "सुरेश", "राधा", "विनोद", "सरिता", "हरीश", "गीता", "महेश", "पुष्पा", "राजेंद्र"],
  hinglish: ["Pooja", "Amit", "Sunita", "Rajesh", "Kavita", "Deepak", "Anjali", "Manoj", "Rekha", "Sanjay"],
};

const STYLE_RULE: Record<Style, string> = {
  en: "Speak natural Indian English.",
  hi: "Speak only in simple, natural Hindi written in Devanagari script.",
  hinglish: "Speak Hinglish: everyday Hindi mixed with English words, written in Roman script (for example 'haan, maine payment kiya tha').",
};

const lang = (s: Style): Lang => (s === "en" ? "en" : "hi");

interface ScamSpec {
  pattern: string;
  payee: string;
  handle: string;
  amount: number;
  rail: PaymentContext["rail"];
  on_call: boolean;
  remote?: boolean;
  story: string;
  cover: string;
  scammer_instructions: string;
}

const SCAMS: ScamSpec[] = [
  {
    pattern: "digital_arrest",
    payee: "Safe Custody Account RBI",
    handle: "XXXXXXXX7712",
    amount: 2_40_000,
    rail: "IMPS",
    on_call: true,
    story:
      "Two hours ago a man in a police uniform video-called you on WhatsApp. He said a parcel with drugs and fake passports was booked with your Aadhaar, that the CBI has a case against you, and that you are under 'digital arrest' and must stay on camera. He says your savings must be moved to an RBI 'safe custody' account for verification and will be returned in 48 hours. He is still on the video call on your other phone, listening.",
    cover: "the money is for buying a plot of land from a relative",
    scammer_instructions: "If the bank calls, say it's for a land purchase from your cousin. Don't mention us. Don't tell your family or you'll be arrested.",
  },
  {
    pattern: "courier_parcel",
    payee: "Mumbai Customs Clearance Cell",
    handle: "customs.clearance@okdemo",
    amount: 85_000,
    rail: "UPI",
    on_call: true,
    story:
      "A call said it was from a courier company: a parcel to Taiwan in your name held drugs. The call was 'transferred' to a narcotics officer who said you must pay a refundable 'clearance deposit' today or police will come to your house. He is still on the line.",
    cover: "it's a payment for a shipment for my brother's business",
    scammer_instructions: "Tell the bank it's a business shipment. Do not disconnect this call.",
  },
  {
    pattern: "kyc_block",
    payee: "KYC Update Helpdesk",
    handle: "kycupdate.help@okdemo",
    amount: 24_999,
    rail: "UPI",
    on_call: true,
    remote: true,
    story:
      "You got an SMS that your bank account will be blocked today because your KYC expired. You called the number in it. The man asked you to install a 'support' app so he could help, and now says you must pay a refundable 'reactivation charge'.",
    cover: "it's for a KYC charge, the bank's own team asked me",
    scammer_instructions: "Say the bank's KYC team asked for it. Keep the app open.",
  },
  {
    pattern: "investment_trading",
    payee: "Alpha Wealth Trading Desk",
    handle: "alphawealth.desk@okdemo",
    amount: 1_20_000,
    rail: "NEFT",
    on_call: false,
    story:
      "Three weeks ago you were added to a WhatsApp group of 'stock market experts'. You invested ₹50,000 through their app and it shows ₹3.4 lakh profit. To withdraw, they say you must first pay a 15% 'profit tax' to their desk account.",
    cover: "it's an investment, I know what I'm doing",
    scammer_instructions: "Banks are jealous of our returns. Don't let them talk you out of it.",
  },
  {
    pattern: "task_job",
    payee: "StarTask Rewards",
    handle: "startask.rewards@okdemo",
    amount: 18_000,
    rail: "UPI",
    on_call: false,
    story:
      "A Telegram contact offered part-time work liking YouTube videos. You earned ₹600 at first. Now you're on 'prepaid tasks': you must deposit ₹18,000 to unlock your ₹46,000 commission, or you lose everything.",
    cover: "it's my work payment, a part-time job",
    scammer_instructions: "Finish the task within 30 minutes or the account freezes.",
  },
  {
    pattern: "fake_support_refund",
    payee: "Refund Processing Team",
    handle: "refund.process@okdemo",
    amount: 9_800,
    rail: "UPI",
    on_call: true,
    story:
      "You searched online for an airline customer care number to get a refund for a cancelled flight. The 'agent' said to receive the ₹9,800 refund you must approve this payment screen and enter your UPI PIN; the money will come back to you.",
    cover: "this is my flight refund",
    scammer_instructions: "Enter your PIN quickly, the refund window closes in 10 minutes. If the bank asks for the OTP, give it to them, it's a verification.",
  },
  {
    pattern: "relative_emergency",
    payee: "Advocate R K Sinha",
    handle: "rksinha.adv@okdemo",
    amount: 60_000,
    rail: "UPI",
    on_call: true,
    story:
      "A man called saying he's a police inspector: your son was caught in a fight in another city and will be jailed unless you pay bail through this lawyer now. You heard a young man crying 'Papa/Maa, please help' in the background. You haven't been able to reach your son; his phone is off. They said not to tell anyone or it will get worse.",
    cover: "I'm paying a lawyer for a family matter",
    scammer_instructions: "Don't call anyone. If you tell the bank, your son stays in jail.",
  },
  {
    pattern: "prize_lottery",
    payee: "KBC Lucky Draw Office",
    handle: "kbcdraw.office@okdemo",
    amount: 35_000,
    rail: "UPI",
    on_call: false,
    story:
      "A WhatsApp message with a TV quiz show logo said you won ₹25 lakh in a lucky draw. The 'manager' on WhatsApp says you must first pay ₹35,000 in GST and processing fees to release the prize.",
    cover: "it's a tax payment",
    scammer_instructions: "Keep this secret until the prize arrives, or someone else will claim it.",
  },
  {
    pattern: "electricity_disconnection",
    payee: "Electricity Bill Officer Desk",
    handle: "billofficer.desk@okdemo",
    amount: 14_500,
    rail: "UPI",
    on_call: true,
    story:
      "You got an SMS from a mobile number: 'Your electricity will be disconnected tonight at 9:30 pm as last month's bill was not updated. Call officer.' The officer says you owe arrears and must pay now to this account.",
    cover: "it's my electricity bill",
    scammer_instructions: "Pay within 15 minutes or the line will be cut.",
  },
  {
    pattern: "sim_disconnection",
    payee: "TRAI Verification Desk",
    handle: "trai.verify@okdemo",
    amount: 1_10_000,
    rail: "IMPS",
    on_call: true,
    story:
      "An automated call said it was from TRAI: your mobile number will be disconnected in two hours because it was used for illegal activity. You pressed 9 and were connected to a 'cyber police officer' who says a case is registered and you must deposit a security amount for verification. He's still on the line.",
    cover: "it's a deposit for my nephew's college admission",
    scammer_instructions: "Say it's an education payment. Do not disconnect.",
  },
];

interface GenuineSpec {
  key: string;
  payee: string;
  handle: string;
  amount: number;
  rail: PaymentContext["rail"];
  story: string;
  on_call_with_family?: boolean;
}

const GENUINE: GenuineSpec[] = [
  {
    key: "rent_new_landlord",
    payee: "Lakshmi Narayan",
    handle: "lakshmi.narayan@okdemo",
    amount: 32_000,
    rail: "UPI",
    story: "You just moved flats. You're paying the first month's rent to your new landlord, Mr. Lakshmi Narayan, whom you met at the flat last week and signed an agreement with.",
  },
  {
    key: "sister_wedding",
    payee: "Priyanka Kapoor",
    handle: "priyanka.kapoor@okdemo",
    amount: 1_50_000,
    rail: "IMPS",
    story: "You're sending money to your sister Priyanka for her wedding expenses. You talked to her this morning and agreed on the amount.",
  },
  {
    key: "supplier",
    payee: "Shiv Shakti Textiles",
    handle: "XXXXXXXX3381",
    amount: 2_10_000,
    rail: "NEFT",
    story: "You run a small clothing shop. You're paying a new fabric supplier for an order you inspected at their warehouse in person. You have their invoice.",
  },
  {
    key: "hospital",
    payee: "Sunrise Multispeciality Hospital",
    handle: "sunrise.billing@okdemo",
    amount: 95_000,
    rail: "UPI",
    on_call_with_family: true,
    story: "Your mother was admitted for surgery. You're paying the hospital deposit at the billing counter using their QR code. Your brother is on the phone with you from the ward, telling you which counter to go to.",
  },
  {
    key: "college_fees",
    payee: "Govt Engineering College Fees",
    handle: "gecfees@okdemo",
    amount: 68_000,
    rail: "UPI",
    story: "You're paying your daughter's semester fees through the college's official payment page that she sent you after logging into the student portal.",
  },
  {
    key: "used_bike",
    payee: "Imran Qureshi",
    handle: "imran.q@okdemo",
    amount: 55_000,
    rail: "UPI",
    story: "You're buying a used motorbike from Imran, a seller you met in person. You test-rode it today and checked the RC papers; he's standing next to you.",
  },
  {
    key: "flat_booking",
    payee: "Green Acres Developers",
    handle: "XXXXXXXX9054",
    amount: 2_00_000,
    rail: "NEFT",
    story: "You're paying a booking amount for a flat to a builder whose site office you visited twice. You have the allotment letter and the account details printed on it.",
  },
  {
    key: "contractor",
    payee: "Ramesh Electricals",
    handle: "ramesh.elec@okdemo",
    amount: 42_000,
    rail: "UPI",
    story: "You're paying an electrician who rewired your house this week. The work is done and you're happy with it; this is the agreed final bill.",
  },
];

interface AmbiguousSpec {
  key: string;
  payee: string;
  handle: string;
  amount: number;
  on_call: boolean;
  in_contacts?: boolean;
  story: string;
  expect: Outcome[];
}

const AMBIGUOUS: AmbiguousSpec[] = [
  {
    key: "family_helping_on_call",
    payee: "Sharma Medical Store",
    handle: "sharmamedical@okdemo",
    amount: 26_000,
    on_call: true,
    in_contacts: true,
    story:
      "You're 71 and not confident with apps. Your son is on the phone guiding you step by step to pay the pharmacy for your monthly medicines, as he does every month. You know the shop well.",
    expect: ["release", "delay"],
  },
  {
    key: "friend_urgent_whatsapp",
    payee: "Nikhil Verma",
    handle: "nikhil.v99@okdemo",
    amount: 40_000,
    on_call: false,
    story:
      "Your old college friend Nikhil messaged on WhatsApp asking to borrow ₹40,000 urgently for a medical emergency, saying he'll return it next week. The UPI ID is new to you. You haven't spoken to him on a call; his number shows the same profile photo.",
    expect: ["delay", "block"],
  },
  {
    key: "irritated_customer",
    payee: "Patel Brothers Hardware",
    handle: "patelbros@okdemo",
    amount: 58_000,
    on_call: false,
    story:
      "You're a busy businessman paying a new hardware supplier for material you've already received. You find the safety call annoying and answer curtly, but truthfully. Nobody asked you to pay.",
    expect: ["release", "delay"],
  },
  {
    key: "real_son_emergency_verified",
    payee: "City Hospital Pune",
    handle: "cityhospital.pune@okdemo",
    amount: 70_000,
    on_call: true,
    in_contacts: true,
    story:
      "Your son had a road accident in Pune. You spoke to him and the doctor by video call yourself; he's on the line now giving you the hospital's UPI ID from the billing desk. It's urgent and you're shaken.",
    expect: ["release", "delay"],
  },
  {
    key: "crypto_friend_tip",
    payee: "Coin Bridge Exchange",
    handle: "coinbridge.ex@okdemo",
    amount: 90_000,
    on_call: false,
    story:
      "A colleague told you about a crypto exchange where he doubled his money. You want to invest ₹90,000 through a UPI ID he shared. You haven't checked whether it is registered anywhere.",
    expect: ["delay", "block"],
  },
  {
    key: "confused_elderly_genuine",
    payee: "Anand Iyer",
    handle: "anand.iyer@okdemo",
    amount: 30_000,
    on_call: false,
    in_contacts: true,
    story:
      "You're 78 and a bit hard of hearing. You're sending your grandson Anand money for his birthday, as you planned with your daughter last week. You sometimes misunderstand questions and ask the caller to repeat.",
    expect: ["release", "delay"],
  },
];

function phone(i: number) {
  return `+447700900${String(200 + i).padStart(3, "0")}`;
}

function baseCustomer(i: number, style: Style, name: string, over: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    customer_ref: `eval-${i}`,
    name,
    language: lang(style),
    phone_e164: phone(i),
    digital_tenure_days: 400 + (i % 5) * 200,
    avg_amount_90d: 4_000 + (i % 4) * 1_500,
    max_amount_90d: 15_000 + (i % 3) * 5_000,
    trusted_contact: i % 3 === 0 ? undefined : { name: i % 2 ? "Ravi" : "Sunita", relation: i % 2 ? "son" : "daughter", phone_e164: phone(i + 500), consent_on_file: true },
    ...over,
  };
}

const COMMON_RULES = (style: Style) =>
  `${STYLE_RULE[style]} You are on a phone call with your bank's safety assistant. Say only what you would say out loud, in one or two short sentences. Never mention that you are role-playing or an AI. If the assistant says goodbye or the call clearly ends, reply exactly [END].`;

export function buildScenarios(): EvalScenario[] {
  const out: EvalScenario[] = [];
  let i = 0;
  const styles: Style[] = ["en", "hi", "hinglish"];
  for (const s of SCAMS) {
    for (const style of styles) {
      for (const coaching of ["light", "heavy"] as const) {
        i++;
        const name = NAMES[style][i % 10];
        const attitude =
          coaching === "light"
            ? "You are worried and unsure. If the assistant asks what is going on, you explain honestly what happened, in your own words."
            : `You have been coached. At first, stick to the cover story: "${s.cover}". Deny that anyone is on a call or instructing you. Only if the assistant asks you directly and kindly about someone else on the line, threats, or being told to keep it secret, hesitate, then gradually admit the truth. If the assistant explains that this is a known fraud and that the money is safe, react naturally (relief, fear, embarrassment) and you may ask to cancel.`;
        const otp = coaching === "heavy" && (s.pattern === "fake_support_refund" || s.pattern === "kyc_block");
        out.push({
          id: `scam-${s.pattern}-${style}-${coaching}`,
          kind: "scam",
          pattern: s.pattern,
          style,
          coaching,
          persona: `You are ${name}. ${s.story} The person told you: "${s.scammer_instructions}" ${attitude}${otp ? " If the assistant asks for any code or OTP, start reading out 6 digits (make them up)." : ""} ${COMMON_RULES(style)}`,
          payment: {
            amount_inr: s.amount,
            rail: s.rail,
            payee: { name: s.payee, handle: s.handle, is_new: true, prior_payments: 0, in_contacts: false },
            initiated_via: "manual",
            timezone: "Asia/Kolkata",
          },
          customer: baseCustomer(i, style, name),
          device: { active_call: s.on_call, active_call_minutes: s.on_call ? 25 + (i % 30) : undefined, caller_in_contacts: s.on_call ? false : undefined, remote_access_app: s.remote ?? false },
          expect: ["delay", "block"],
          will_offer_otp: otp,
        });
      }
    }
  }
  for (const g of GENUINE) {
    for (const style of styles) {
      i++;
      const name = NAMES[style][i % 10];
      out.push({
        id: `genuine-${g.key}-${style}`,
        kind: "genuine",
        style,
        persona: `You are ${name}. ${g.story} Nobody asked or pressured you to make this payment. You are cooperative but would like this done quickly, and you answer questions honestly. ${COMMON_RULES(style)}`,
        payment: {
          amount_inr: g.amount,
          rail: g.rail,
          payee: { name: g.payee, handle: g.handle, is_new: true, prior_payments: 0, in_contacts: false },
          initiated_via: g.key === "hospital" ? "qr" : "manual",
          timezone: "Asia/Kolkata",
        },
        customer: baseCustomer(i, style, name),
        device: g.on_call_with_family ? { active_call: true, active_call_minutes: 6, caller_in_contacts: true } : { active_call: false },
        expect: ["release"],
      });
    }
  }
  for (const a of AMBIGUOUS) {
    for (const style of ["en", "hinglish"] as Style[]) {
      i++;
      const name = NAMES[style][i % 10];
      out.push({
        id: `ambiguous-${a.key}-${style}`,
        kind: "ambiguous",
        style,
        persona: `You are ${name}. ${a.story} Answer honestly. ${COMMON_RULES(style)}`,
        payment: {
          amount_inr: a.amount,
          rail: "UPI",
          payee: { name: a.payee, handle: a.handle, is_new: true, prior_payments: 0, in_contacts: a.in_contacts ?? false },
          initiated_via: "manual",
          timezone: "Asia/Kolkata",
        },
        customer: baseCustomer(i, style, name, a.key.includes("elderly") || a.key.includes("family_helping") ? { vulnerability_flag: true } : {}),
        device: a.on_call ? { active_call: true, active_call_minutes: 8, caller_in_contacts: true } : { active_call: false },
        expect: a.expect,
      });
    }
  }
  return out;
}
