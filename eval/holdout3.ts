import type { Outcome, Rail } from "../shared/types.js";
import type { EvalScenario, Style } from "./scenarios.js";
import { phone, rules, type Story } from "./holdout.js";

/**
 * Third held-out set, written and frozen on 22 Oct 2026 before any run. The
 * stories come from public reporting on Indian payment fraud, not from the
 * agent's prompts, tools or earlier results, and nothing here is to be edited
 * after the first run. It measures the agent that was tuned on the earlier sets.
 *
 * 8 scam stories, each a different pattern from every story in scenarios.ts,
 * holdout.ts and holdout2.ts. Four are spoken in English and Hinglish, four in
 * English and Hindi (Devanagari). Four have the scammer on the line.
 * 6 genuine payments chosen to look risky: large sums to new payees, a known
 * person guiding the payment on a call, a middle-of-the-night emergency, a
 * relative's new account and a property token paid in front of a broker.
 * 14 stories × 2 styles = 28 conversations. Every name, payee and handle is invented.
 */
type Story3 = Story & {
  remote?: boolean;
  /** Overrides the default styles for the kind. */
  styles?: Style[];
  /** Overrides the rail derived from the handle. */
  rail?: Rail;
  /** Overrides the default expectation for the kind. */
  expect?: Outcome[];
};

const STORIES_3: Story3[] = [
  // English + Hinglish scams
  {
    key: "overseas_job_visa_fee",
    kind: "scam",
    payee: "Maple Bridge Overseas Manpower",
    handle: "XXXXXXXX5809",
    amount: 1_35_000,
    on_call: true,
    story:
      "You applied on a job portal for a hotel job in Canada. A 'recruitment agency' interviewed you for ten minutes on a WhatsApp video call and emailed an offer letter with a 3,200 dollar monthly salary. They say the visa slot closes today and you must pay 1,35,000 rupees for 'visa processing, medical and air ticket' now. The 'HR manager' is on the phone with you, saying other candidates are waiting. You have never visited their office.",
    coached: "Say it is money for your sister's wedding. Banks always hold payments for overseas jobs.",
  },
  {
    key: "sextortion_video_call",
    kind: "scam",
    payee: "Kanak Mobile Point",
    handle: "kanakmobile.point@okdemo",
    amount: 45_000,
    on_call: false,
    story:
      "Last night an unknown woman video-called you on WhatsApp; for a few seconds the screen showed obscene content and you cut the call. This morning someone sent you a clip with your face edited into it, with screenshots of your family's and colleagues' profiles, threatening to send it to all of them and put it on YouTube unless you pay 45,000 rupees within the hour. You already paid them 8,000 rupees this morning and now they want more. You are ashamed and have not told anyone.",
    coached: "If the bank calls, say you are paying a friend back, or the video goes to everyone.",
  },
  {
    key: "card_upgrade_screen_share",
    kind: "scam",
    payee: "Card Upgrade Activation Cell",
    handle: "card.activation.cell@okdemo",
    amount: 19_999,
    on_call: true,
    remote: true,
    story:
      "A man called saying he was from your bank's card department: your debit card is being upgraded to a 'Platinum' card and the old one will stop working tonight. He knew your name and the last four digits of your card. He had you install a screen-sharing app 'to complete the upgrade', and now says you must pay a refundable 19,999 rupee 'activation deposit' that will come back with reward points. He is still on the line and can see your screen.",
    coached: "An automatic call from the bank may come. Say you are buying a phone, or the upgrade gets cancelled.",
  },
  {
    key: "fake_landlord_deposit",
    kind: "scam",
    payee: "Rajiv Menon",
    handle: "rajivmenon.homes@okdemo",
    amount: 48_000,
    on_call: false,
    story:
      "You are moving to Pune for a new job. On a rental website you found a furnished 2BHK at a rent well below others nearby. The 'owner' says he works in Dubai and cannot show it; he sent photos, an ID card image and a rent agreement PDF, and says another family is ready to pay, so you must send 48,000 rupees of deposit and first month's rent today and he will courier the keys. You have not seen the flat or met him.",
    coached: "If the bank asks, say you have already seen the flat.",
  },
  // English + Hindi scams
  {
    key: "mobile_tower_lease",
    kind: "scam",
    styles: ["en", "hi"],
    payee: "Tower Site Allotment Office",
    handle: "towersite.allotment@okdemo",
    amount: 28_500,
    on_call: true,
    story:
      "A caller said he was from a mobile tower company: your rooftop has been selected for a 5G tower, with 35,000 rupees a month in rent and a 25 lakh rupee advance. He sent an 'approval letter' with government stamps on WhatsApp and says you must first pay 28,500 rupees for 'registration and the telecom department NOC'. He is still on the phone, saying the approval lapses at 5 p.m.",
    coached: "Tell the bank it is for repair work on your house.",
  },
  {
    key: "pilgrimage_helicopter_booking",
    kind: "scam",
    styles: ["en", "hi"],
    payee: "Himalayan Heli Yatra Desk",
    handle: "heliyatra.desk@okdemo",
    amount: 64_000,
    on_call: false,
    story:
      "You are planning a pilgrimage to a Himalayan shrine with your elderly parents. You searched online for helicopter tickets; a website at the top of the results, full of temple photos, showed seats available even though the official booking site showed them sold out. A 'booking agent' on WhatsApp confirmed four seats, sent ticket PDFs and says you must pay 64,000 rupees now or the seats will be released at 6 p.m.",
    coached: "If the bank asks, just say it is a hotel booking.",
  },
  {
    key: "medical_seat_quota",
    kind: "scam",
    styles: ["en", "hi"],
    payee: "Vidya Path Education Consultants",
    handle: "XXXXXXXX4417",
    amount: 3_00_000,
    on_call: true,
    story:
      "Your daughter did not get a government MBBS seat in counselling. A man from an 'education consultancy' called, saying that through his contacts with the director he can get her a 'management quota' seat at a private medical college if you pay a 3 lakh rupee booking amount today, because seats close tonight. He sent a provisional admission letter on WhatsApp. He is on the phone with you now.",
    coached: "Say it is the college's own admission fee. If you mention me, the seat goes to someone else.",
  },
  {
    key: "boss_whatsapp_vendor_advance",
    kind: "scam",
    styles: ["en", "hi"],
    payee: "Sterling Edge Trade Links",
    handle: "XXXXXXXX7240",
    amount: 4_80_000,
    on_call: false,
    story:
      "You are the accountant at a small garment export firm and can make payments from the firm's account. A WhatsApp message came from a new number with your managing director's photo: he is in a meeting with investors, cannot talk, and needs you to pay a 4,80,000 rupee advance to a new vendor for a confidential deal before 3 p.m., and not to mention it to anyone in the office yet. When you called that number he cut the call and texted 'in meeting, just do it'. You have not tried his usual number.",
    coached: "Say it is a routine vendor payment.",
  },
  // Genuine, English + Hindi. All deliberately look risky.
  {
    // Large, new payee, a third party (the broker) present and steering.
    key: "property_token_broker",
    kind: "genuine",
    payee: "Anuradha Kulkarni",
    handle: "XXXXXXXX6152",
    amount: 2_51_000,
    on_call: false,
    story:
      "You are buying a resale 2BHK flat. Today you are at the broker's office with the owner, Mrs Anuradha Kulkarni, whom you met at the flat twice; your lawyer checked the title papers last week. You are paying a 2,51,000 rupee token amount into her account, and the account name matches the name on the sale deed. The broker, whom a colleague used last year, is sitting with you and drafted the token receipt that you both signed.",
  },
  {
    // Known caller guiding a large payment to a tax account: the shape of a
    // GST/income-tax threat scam, but the customer rang their own CA and the
    // payee is the challan's NEFT mandate account.
    key: "advance_tax_ca_on_call",
    kind: "genuine",
    payee: "Direct Tax Collection Challan CRN",
    handle: "XXXXXXXX2804",
    rail: "NEFT",
    amount: 1_85_000,
    on_call: true,
    caller_known: true,
    story:
      "You run a small printing business. Today is the deadline for this quarter's advance-tax instalment, so you phoned your chartered accountant of nine years, who is saved in your contacts. He is on the line while you pay: he worked out the amount, you generated the challan yourself on the income-tax portal, and you are paying by NEFT to the account printed on the challan's mandate form.",
  },
  {
    // Odd-hour emergency, urgent, first payment to a place found that night.
    key: "night_vet_emergency",
    kind: "genuine",
    payee: "CarePaws 24x7 Animal Hospital",
    handle: "carepaws24x7@okdemo",
    amount: 38_000,
    on_call: false,
    story:
      "It is 1:30 in the morning. Your dog swallowed a rubber toy and keeps vomiting, so you rushed him to a 24-hour animal hospital you found on the map; you have never been there before. The vet showed you the X-ray and needs a 38,000 rupee advance before starting emergency surgery. You are standing at the reception and paying with the QR code on the counter.",
  },
  {
    // Known relative, new account, details checked in person.
    key: "nephew_new_account_met",
    kind: "genuine",
    payee: "Tushar Bhatnagar",
    handle: "XXXXXXXX5186",
    amount: 60_000,
    on_call: false,
    story:
      "Your nephew Tushar, your sister's son, is opening a small mobile-repair shop. He came to your home yesterday with the passbook of his new bank account, and you agreed to lend him 60,000 rupees. You have paid him before on his old account, but this is the new one at a different bank, and you copied the details from his passbook yourself.",
  },
  {
    // An elderly customer walked through a large payment by a voice on the phone
    // is the exact shape of an impersonation scam. The caller is her son's saved
    // number and she is physically at the hospital desk, so release is right, but
    // a short delay so the son can confirm is a defensible bank practice. Same
    // labelling as the dev set's family_helping_on_call.
    key: "son_guides_mother_hospital",
    kind: "genuine",
    payee: "Lifeline Ortho and Trauma Hospital",
    handle: "XXXXXXXX3092",
    amount: 1_12_000,
    on_call: true,
    caller_known: true,
    expect: ["release", "delay"],
    story:
      "You are 69. Your husband had a hip operation at a hospital in your city and you are at the billing desk paying the balance before his discharge. You rarely use the banking app, so your son, who lives in Singapore, is on a WhatsApp call from his usual number, telling you step by step where to tap. The cashier wrote the hospital's account details on the printed bill.",
  },
  {
    // Large, new individual payee, rural, no paper trail beyond a market slip.
    key: "cattle_fair_buffalo",
    kind: "genuine",
    payee: "Baldev Singh",
    handle: "XXXXXXXX2468",
    amount: 1_60_000,
    on_call: false,
    story:
      "You keep dairy cattle in your village. At the weekly cattle market you chose two buffaloes from a farmer from the next district; your own vet checked them and you milked one yourself. You are paying him 1,60,000 rupees to the account in his passbook; he and his son are standing beside you, and the sale is written on the market committee's receipt.",
  },
];

export function buildHoldout3(): EvalScenario[] {
  const out: EvalScenario[] = [];
  let i = 140;
  for (const st of STORIES_3) {
    for (const style of st.styles ?? (st.kind === "scam" ? (["en", "hinglish"] as Style[]) : (["en", "hi"] as Style[]))) {
      i++;
      const name = ["Mahendra", "Pallavi", "Irfan", "Hema", "Dinesh", "Savita", "Bhavna", "Sunil"][i % 8];
      const attitude =
        st.kind === "scam"
          ? i % 2
            ? "You are worried; if the assistant asks what is happening, you explain honestly."
            : `You have been coached${st.coached ? `: "${st.coached}"` : ""}. Stick to that at first and deny anyone is instructing you; admit the truth only if asked directly and kindly.`
          : "Nobody pressured you. You answer honestly and want it done quickly.";
      out.push({
        id: `holdout3-${st.kind}-${st.key}-${style}`,
        kind: st.kind,
        pattern: st.kind === "scam" ? st.key : undefined,
        style,
        coaching: st.kind === "scam" ? (i % 2 ? "light" : "heavy") : undefined,
        persona: `You are ${name}. ${st.story} ${attitude} ${rules(style)}`,
        payment: {
          amount_inr: st.amount,
          rail: st.rail ?? (st.handle.startsWith("XXXX") ? "IMPS" : "UPI"),
          payee: { name: st.payee, handle: st.handle, is_new: true, prior_payments: 0, in_contacts: false },
          initiated_via: "manual",
          timezone: "Asia/Kolkata",
        },
        customer: {
          customer_ref: `holdout3-${i}`,
          name,
          language: style === "en" ? "en" : "hi",
          phone_e164: phone(i),
          digital_tenure_days: 700,
          avg_amount_90d: 7_000,
          max_amount_90d: 24_000,
          trusted_contact: i % 3 ? { name: "Neelam", relation: "sister", phone_e164: phone(i + 100), consent_on_file: true } : undefined,
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
