import type { Outcome, Rail } from "../shared/types.js";
import type { EvalScenario, Style } from "./scenarios.js";
import { phone, rules, type Story } from "./holdout.js";

/**
 * Fourth held-out set, written and frozen on 22 Oct 2026, before any run, for
 * the v5 agent. The stories come from public reporting on Indian payment fraud,
 * not from the agent's prompts, tools, policy or earlier results, and nothing
 * here is to be edited after the first run.
 *
 * The emphasis is heavily coached customers speaking Hindi and Hinglish, the
 * hardest case.
 * 9 scam stories, each a different key and mechanism from every story in
 * scenarios.ts, holdout.ts, holdout2.ts and holdout3.ts. Five are spoken in
 * Hindi (Devanagari) and Hinglish, four in English and Hindi. Five have the
 * scammer on the line, one of them watching through a screen-sharing app.
 * Seven stories are `always_heavy` (all five Hindi/Hinglish ones and two
 * English/Hindi ones): every conversation of those plays the coached customer.
 * The other two alternate light and heavy as in the earlier sets, which leaves
 * 16 heavy and 2 light scam conversations, and every Hindi or Hinglish scam
 * conversation heavy.
 * 5 genuine payments in English and Hindi, chosen to look risky: the largest
 * sum in the set to a builder under a same-day deadline, an elderly father
 * guided through a hospital payment on the phone, a night-time purchase from a
 * new rural dealer, a lawyer on the line while she is paid, and a large
 * repayment to a never-paid gold-loan account.
 * 14 stories × 2 styles = 28 conversations. Every name, payee and handle is invented.
 */
type Story4 = Story & {
  /** The customer's gender, so the name fits the story and Hindi verb forms. */
  gender: "f" | "m";
  remote?: boolean;
  /** Overrides the default styles for the kind. */
  styles?: Style[];
  /** Overrides the rail derived from the handle. */
  rail?: Rail;
  /** Overrides the default expectation for the kind. */
  expect?: Outcome[];
  /** Scams only: every conversation of this story is heavily coached, instead of alternating light and heavy. */
  always_heavy?: boolean;
};

const STORIES_4: Story4[] = [
  // Hindi + Hinglish scams, all heavily coached
  {
    key: "scholarship_release_fee",
    kind: "scam",
    gender: "f",
    payee: "District Scholarship Disbursal Cell",
    handle: "scholarship.disbursal@okdemo",
    amount: 24_800,
    on_call: true,
    always_heavy: true,
    story:
      "Your daughter is in class 11 at a government school. A man called saying he is from the district education office: she has been sanctioned a 68,000 rupee post-matric scholarship, but this year's portal closes at 6 p.m. today and the money will lapse unless you first pay a 24,800 rupee 'processing and stamp' charge. He knew her full name, her roll number and her class teacher's name, and sent a sanction letter with a government emblem on WhatsApp. He is still on the line, telling you which buttons to press, and says he will stay until the payment goes through.",
    coached:
      "If the bank calls, say it is the school's board registration and exam fee. If you mention the scholarship, the bank will report it and her name will be struck off.",
  },
  {
    key: "cloud_mining_machine_rental",
    kind: "scam",
    gender: "m",
    payee: "Shubhlakshmi Electronics Hub",
    handle: "shubhlakshmi.electronics@okdemo",
    amount: 85_000,
    on_call: false,
    always_heavy: true,
    story:
      "Six weeks ago a friend from your gym added you to a Telegram group for a 'cloud mining' app. You rented a 'starter machine' for 5,000 rupees; the app credits about 210 rupees a day, and you have withdrawn 3,800 rupees to your bank, so you believe it works. You also brought in two cousins and earn a 'team bonus' on them. Now a 'Diwali offer' in the app says a 'Pro miner' costs 85,000 rupees and earns 3,900 rupees a day, the offer ends at midnight, and your 'team leader' says members who do not upgrade this month will be moved down a level and lose their team bonus. The app gives a different 'channel partner' UPI ID for each payment; today's belongs to an electronics shop.",
    coached:
      "Banks report crypto to the income-tax department. If they call, say you are buying a TV and a fridge for Diwali from that shop.",
  },
  {
    key: "kidney_donor_reward",
    kind: "scam",
    gender: "m",
    payee: "Amrutdhara Transplant Coordination",
    handle: "amrutdhara.transplant@okdemo",
    amount: 42_500,
    on_call: false,
    always_heavy: true,
    story:
      "Your tent-house business failed and you owe private moneylenders about 9 lakh rupees. On Facebook you saw a post from what looked like a big hospital saying kidney donors are urgently needed and will be paid 4 crore rupees, half in advance. You messaged the number; a 'transplant coordinator' on WhatsApp sent you a donor form, his hospital ID card and a screenshot showing 2 crore rupees 'reserved' in your name, and says the blood-group report you sent him is a match. He says you must pay 42,500 rupees today for 'registration, tissue matching and the donor card', and the advance will reach your account tomorrow. You know selling a kidney is illegal and you have told no one, not even your wife.",
    coached:
      "Organ payments are watched by the government. If the bank calls, say it is for your mother's medical tests, and never mention the hospital or a donation.",
  },
  {
    key: "online_tantrik_ritual",
    kind: "scam",
    gender: "f",
    payee: "Siddhshakti Jyotish Peeth",
    handle: "siddhshakti.jyotish@okdemo",
    amount: 71_000,
    on_call: true,
    always_heavy: true,
    story:
      "Your son has been without a job for a year and your husband's health is poor. You saw an astrologer 'Guruji' on Instagram reels and messaged him for a free reading. He said a jealous relative has done black magic on your family, and you paid him 2,100 rupees for a first puja. He now calls you every day. Today he says the main ritual must be done tonight, before the new moon, or your son will meet with an accident, and you must pay 71,000 rupees for the havan materials and the priests' dakshina. He is on the phone now, chanting, and has told you that if anyone else learns of the ritual, its power will turn back on your son.",
    coached:
      "If the bank calls, say it is a donation to a temple for your son's job. Do not say my name, or the remedy will turn against him.",
  },
  {
    key: "loan_app_recovery_shaming",
    kind: "scam",
    gender: "m",
    payee: "Mohit Verma",
    handle: "mohit.verma1188@okdemo",
    amount: 46_000,
    on_call: true,
    always_heavy: true,
    story:
      "You are 24 and work at a call centre. Three months ago you took a 6,000 rupee loan on an instant-loan app you found through an Instagram ad; it paid you only 3,900 after 'charges', and you repaid 6,000 within a week. Since then 'recovery agents' say you still owe 46,000 rupees in penalties. Yesterday they messaged some people in your phone contacts calling you a fraud and a loan defaulter, with your photo, and sent you a 'legal notice' with a police logo. One of them is on the phone now, saying that unless you pay by 2 p.m. he will call your office's HR and message every contact, including your parents. You are frightened and ashamed.",
    coached:
      "If the bank calls, say you are sending money to your cousin Mohit. If you mention the app, your HR gets the first call.",
  },
  // English + Hindi scams
  {
    key: "solar_pump_subsidy_portal",
    kind: "scam",
    gender: "m",
    styles: ["en", "hi"],
    payee: "Kisan Urja Yojana Registration Cell",
    handle: "XXXXXXXX6083",
    amount: 82_300,
    on_call: true,
    remote: true,
    always_heavy: true,
    story:
      "You farm four acres and want a solar irrigation pump. Searching online for the government's solar pump subsidy scheme, you found a website with the Prime Minister's photo and the agriculture ministry's logo, registered on it and paid a 5,600 rupee registration fee two days ago. Today a 'scheme officer' called: your pump is sanctioned at a 90 percent subsidy, and you must pay your 'farmer's share' of 82,300 rupees today because the district quota closes tonight. He had you install a screen-sharing app 'to upload your land papers' and is still on the line, watching your screen. You have not been to the agriculture office.",
    coached:
      "If the bank calls, say it is for seeds and fertiliser for the rabi crop. Banks hold subsidy payments, and your quota will go to someone else.",
  },
  {
    key: "ayurvedic_cure_course",
    kind: "scam",
    gender: "f",
    styles: ["en", "hi"],
    payee: "Vaidyaraj Herbal Kidney Care",
    handle: "XXXXXXXX2917",
    amount: 1_45_000,
    on_call: true,
    always_heavy: true,
    story:
      "Your husband has chronic kidney disease, and his hospital says he will soon need dialysis. On YouTube you saw a video about an ayurvedic 'vaidya' who 'cures kidney failure without dialysis'. You called the number; a 'senior doctor' heard his reports read out over the phone and said a 90-day herbal course will cure him, at 1,45,000 rupees, with only three courses left at this price. Last week you paid 18,000 rupees for a first box of powders, and the 'doctor' now says stopping halfway will make the kidneys fail faster. He is on the phone now and says the hospital's doctors are paid by dialysis companies and must not be told.",
    coached: "If the bank calls, say it is for your husband's hospital treatment. Do not mention us; banks and hospitals work together.",
  },
  {
    key: "gold_rate_lock_app",
    kind: "scam",
    gender: "f",
    styles: ["en", "hi"],
    payee: "Swarnrekha Gold House",
    handle: "XXXXXXXX4385",
    amount: 1_98_000,
    on_call: false,
    story:
      "Gold prices keep rising and your daughter's wedding is next year. An Instagram reel from 'a 60-year-old family jeweller in Jaipur' offered gold coins at 12 percent below the market rate to 'app members', delivered by insured courier within 10 days. You installed their app, which shows live gold prices, a hallmark badge and hundreds of five-star reviews. A 'relationship manager' on WhatsApp says today's 'locked rate' for 25 grams ends at 8 p.m. and you must pay 1,98,000 rupees now to the company account shown in the app. You have never been to the shop, and nobody you know has bought from them.",
    coached: "If the bank asks, say you are paying your family jeweller. Banks want to sell you their own gold bonds and will try to stop you.",
  },
  {
    key: "card_dues_settlement_offer",
    kind: "scam",
    gender: "m",
    styles: ["en", "hi"],
    payee: "Apex Resolve Legal Associates",
    handle: "XXXXXXXX7726",
    amount: 64_000,
    on_call: false,
    story:
      "Two years ago you lost your job and stopped paying a credit card from another bank; about 2.3 lakh rupees is overdue, and you do get real recovery calls. This morning a man from a 'legal settlement firm' called: that bank has approved a one-time settlement of 64,000 rupees if you pay today, after which you will get a no-dues certificate and your credit score will be cleaned. He knew the last four digits of the card and the overdue amount, and sent a settlement letter with the bank's logo on WhatsApp. He said that if it is not paid by evening, a non-bailable warrant will be issued tomorrow. The account in the letter is in the firm's name, not the card bank's.",
    // The cover is the genuine advocate_retainer_on_call story below, on purpose.
    coached: "If your bank asks, say it is a lawyer's fee for a family property matter. Do not mention the settlement, or the card bank will cancel the discount.",
  },
  // Genuine, English + Hindi. All deliberately look risky.
  {
    // Largest sum in the set, new payee, first payment, a salesperson pressing a same-day deadline.
    key: "rowhouse_builder_site_office",
    kind: "genuine",
    gender: "m",
    payee: "Nilgiri Crest Developers",
    handle: "XXXXXXXX5540",
    rail: "RTGS",
    amount: 4_75_000,
    on_call: false,
    story:
      "You are buying a row house in a new gated project on the edge of your city. You have visited the site three times, checked the project's registration on the state RERA website, and your bank's home-loan team has approved the project for your loan. This morning you signed and registered the agreement for sale at the sub-registrar's office; now you are at the builder's site office paying your own-contribution instalment of 4,75,000 rupees by RTGS to the account printed on the agreement and the builder's demand letter. It is your first payment to them. The sales manager is sitting with you and keeps saying the launch price ends today, which the price list on the wall also says.",
  },
  {
    // An elderly customer at home, walked through a large payment step by step
    // by a voice on the phone: the exact shape of an impersonation scam. The
    // caller is his daughter's saved number, he met the cardiologist yesterday
    // and the payee is the hospital on the deposit slip, so release is right.
    // He is not at the hospital himself, so a short delay while he calls his
    // daughter back or speaks to the billing desk is a defensible bank practice
    // for an elderly customer guided remotely. Same labelling as holdout3's
    // son_guides_mother_hospital and the dev set's family_helping_on_call.
    key: "daughter_guides_father_hospital",
    kind: "genuine",
    gender: "m",
    payee: "Sevadham Heart Care Hospital",
    handle: "XXXXXXXX8361",
    amount: 1_35_000,
    on_call: true,
    caller_known: true,
    expect: ["release", "delay"],
    story:
      "You are 74. Your wife was admitted two days ago with a heart problem at a private hospital in your city; you were there yesterday and met her cardiologist. Today your daughter is with her, and the billing desk needs 1,35,000 rupees before an angioplasty this afternoon. Your daughter's own card limit is used up, so she photographed the hospital's account details from the deposit slip and sent them to you on WhatsApp, and she is now on a phone call from her usual number, saved in your contacts, telling you step by step where to tap. You are at home and not confident with the app.",
  },
  {
    // Late at night, urgent, first payment to a rural dealer found through a neighbour.
    key: "night_harvest_tractor_parts",
    kind: "genuine",
    gender: "m",
    payee: "Bhoomiputra Tractor Spares",
    handle: "bhoomiputra.spares@okdemo",
    amount: 46_500,
    on_call: false,
    story:
      "It is 10:45 at night in the middle of the paddy harvest, and your tractor's hydraulic pump has failed in the field. The tractor-parts dealer in the nearby town, whom your neighbour uses, agreed on the phone to open his shop for you, and you rode there on your motorbike. You are at his counter with the new pump in your hands, checked against the old one, and are paying 46,500 rupees with the QR code on the counter. You have never bought from him before.",
  },
  {
    // A lawyer on the line while she is paid: the shape of the bail and
    // digital-arrest scams. The customer chose the advocate, met her in person,
    // saved her number and is paying the account on a signed fee letter.
    key: "advocate_retainer_on_call",
    kind: "genuine",
    gender: "f",
    payee: "Adv Meenal Rathore and Associates",
    handle: "XXXXXXXX1953",
    amount: 75_000,
    on_call: true,
    caller_known: true,
    story:
      "Your late father's house is in a dispute with a cousin, and the civil court hearing is next week. Your brother-in-law recommended an advocate; you met her at her chamber in the district court complex last week with your documents, signed her fee letter and saved her number. She is on a phone call with you now from that saved number, because she needs her 75,000 rupee retainer before she files your written statement tomorrow. You are paying to her firm's account printed on the fee letter, and she is only confirming the amount and the reference.",
  },
  {
    // Large, far above the customer's usual amounts, to an account never paid before.
    key: "gold_loan_topup_release",
    kind: "genuine",
    gender: "f",
    payee: "Suvarnaraksha Gold Finance Loan Collection",
    handle: "XXXXXXXX4072",
    rail: "NEFT",
    amount: 1_86_000,
    on_call: false,
    story:
      "Eight months ago you pledged your gold jewellery for a loan at a gold-loan company's branch in your town, and last month you took a top-up on the same pledge. Your niece's wedding is next week, so today you are at that branch to repay the loan and the top-up with interest and take the jewellery back. The cashier printed a slip with your loan number and the company's collection account, which is unique to your loan, and the manager has your sealed jewellery packet on the counter. You are paying 1,86,000 rupees by NEFT; you have never paid this account before.",
  },
];

const NAMES: Record<Story4["gender"], string[]> = {
  f: ["Kusum", "Shabnam", "Rukmini", "Geeta", "Parveen", "Sushila", "Anita", "Lalita"],
  m: ["Jitendra", "Mukesh", "Omprakash", "Brijesh", "Salim", "Ramkishan", "Harpal", "Naresh"],
};

export function buildHoldout4(): EvalScenario[] {
  const out: EvalScenario[] = [];
  let i = 170;
  for (const st of STORIES_4) {
    for (const style of st.styles ?? (st.kind === "scam" ? (["hi", "hinglish"] as Style[]) : (["en", "hi"] as Style[]))) {
      i++;
      const name = NAMES[st.gender][i % 8];
      const heavy = st.kind === "scam" && (Boolean(st.always_heavy) || i % 2 === 0);
      const attitude =
        st.kind === "scam"
          ? heavy
            ? `You have been coached${st.coached ? `: "${st.coached}"` : ""}. Stick to that at first and deny anyone is instructing you; admit the truth only if asked directly and kindly.`
            : "You are worried; if the assistant asks what is happening, you explain honestly."
          : "Nobody pressured you. You answer honestly and want it done quickly.";
      out.push({
        id: `holdout4-${st.kind}-${st.key}-${style}`,
        kind: st.kind,
        pattern: st.kind === "scam" ? st.key : undefined,
        style,
        coaching: st.kind === "scam" ? (heavy ? "heavy" : "light") : undefined,
        persona: `You are ${name}. ${st.story} ${attitude} ${rules(style)}`,
        payment: {
          amount_inr: st.amount,
          rail: st.rail ?? (st.handle.startsWith("XXXX") ? "IMPS" : "UPI"),
          payee: { name: st.payee, handle: st.handle, is_new: true, prior_payments: 0, in_contacts: false },
          initiated_via: "manual",
          timezone: "Asia/Kolkata",
        },
        customer: {
          customer_ref: `holdout4-${i}`,
          name,
          language: style === "en" ? "en" : "hi",
          phone_e164: phone(i),
          digital_tenure_days: 700,
          avg_amount_90d: 7_000,
          max_amount_90d: 24_000,
          trusted_contact: i % 3 ? { name: "Arun", relation: "brother", phone_e164: phone(i + 100), consent_on_file: true } : undefined,
        },
        device: st.on_call
          ? { active_call: true, active_call_minutes: st.caller_known ? 5 : 30, caller_in_contacts: Boolean(st.caller_known), remote_access_app: Boolean(st.remote) }
          : { active_call: false },
        expect: st.expect ?? (st.kind === "scam" ? ["delay", "block"] : ["release"]),
      });
    }
  }
  return out;
}
