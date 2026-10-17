import type { EvalScenario, Style } from "./scenarios.js";
import { phone, rules, type Story } from "./holdout.js";

/**
 * Second held-out set, written after the v2 runs (16 Oct 2026) and never used to
 * tune anything. It reports the version that was tuned on v2's misses.
 */
type Story2 = Story & { remote?: boolean };

const STORIES_2: Story2[] = [
  {
    key: "ed_money_laundering_video",
    kind: "scam",
    payee: "ED Verification Escrow",
    handle: "XXXXXXXX9031",
    amount: 4_50_000,
    on_call: true,
    story:
      "A woman on a Skype video call, showing an Enforcement Directorate ID card, says your bank account was used to launder 6 crore rupees. She says you will be jailed unless you transfer your fixed deposit to an 'escrow account' for 24 hours while they verify it. You have been on the call for an hour.",
    coached: "Tell the bank you are buying a flat and the builder needs it today.",
  },
  {
    key: "cousin_whatsapp_new_number",
    kind: "scam",
    payee: "Neeraj Malhotra",
    handle: "neeraj.m2026@okdemo",
    amount: 35_000,
    on_call: false,
    story:
      "Your cousin Rakesh messaged from a new number saying his phone broke and he is stuck at Dubai airport without money; he asked you to pay his 'friend Neeraj' for a ticket. He refused a voice call, saying the network is bad. You have not spoken to him.",
  },
  {
    key: "fake_rbi_refund_officer",
    kind: "scam",
    payee: "RBI Refund Compliance",
    handle: "rbi.refund.compliance@okdemo",
    amount: 12_000,
    on_call: true,
    story:
      "A man says he is an RBI officer: you are due a 2.4 lakh rupee refund from an old bank charge, and to release it you must first pay a 12,000 rupee 'compliance fee'. He is still on the line and says he will stay until it is done.",
    coached: "Say it is a payment for your daughter's coaching classes.",
  },
  {
    key: "gst_raid_threat_shopkeeper",
    kind: "scam",
    payee: "GST Settlement Cell",
    handle: "gst.settlement@okdemo",
    amount: 1_25_000,
    on_call: true,
    story:
      "You run a grocery shop. A caller claiming to be a GST officer says a raid is planned on your shop tomorrow for tax evasion, but it can be 'settled' today if you pay a penalty to this account. He told you not to tell your accountant.",
    coached: "Say it is an advance to a supplier.",
  },
  {
    key: "olx_buyer_advance",
    kind: "scam",
    payee: "Sahil Transport Services",
    handle: "sahil.transport@okdemo",
    amount: 8_500,
    on_call: false,
    story:
      "You are selling a washing machine online. The buyer says he has paid 25,000 rupees already, but his bank needs you to pay 8,500 rupees of 'transport charges' first to release it to you. Your app shows no money received.",
  },
  {
    key: "matrimony_investment",
    kind: "scam",
    payee: "CoinPeak Global Trading",
    handle: "coinpeak.global@okdemo",
    amount: 2_00_000,
    on_call: false,
    story:
      "A man you met on a matrimony site two months ago, who says he is an engineer in Singapore, taught you to trade on a crypto platform. Your balance shows 9 lakh rupees. He says deposit 2 lakh more to unlock a VIP withdrawal. You plan to marry him.",
  },
  {
    key: "power_cut_apk",
    kind: "scam",
    payee: "Bijli Bill Update Desk",
    handle: "bijlibill.update@okdemo",
    amount: 6_400,
    on_call: true,
    remote: true,
    story:
      "An SMS said your power would be cut tonight. You called the number; the 'lineman' asked you to install an app to update your bill, and now asks you to pay 6,400 rupees of 'pending dues'. The app is still open.",
    coached: "It is just my electricity bill.",
  },
  {
    key: "police_daughter_arrested_voice",
    kind: "scam",
    payee: "Inspector Sharma Bail Account",
    handle: "bail.sharma@okdemo",
    amount: 80_000,
    on_call: true,
    story:
      "A man says he is a police inspector and that your daughter was arrested in a drugs case at college. You heard a girl crying 'Mumma, please' on the phone. He says pay 80,000 rupees now to keep her name out of the FIR and not to call anyone. Your daughter's phone is switched off.",
    coached: "Say it is a fee for her college.",
  },
  {
    key: "society_maintenance",
    kind: "genuine",
    payee: "Green Park CHS Maintenance",
    handle: "greenparkchs@okdemo",
    amount: 36_000,
    on_call: false,
    story:
      "You are paying your housing society's annual maintenance using the UPI ID from the society notice board and the secretary's email. You do this every year, but this is a new account the society opened.",
  },
  {
    key: "daughter_hostel",
    kind: "genuine",
    payee: "Kavya Iyer",
    handle: "kavya.iyer@okdemo",
    amount: 25_000,
    on_call: true,
    caller_known: true,
    story:
      "Your daughter Kavya is on a voice call with you from her hostel; she needs money for semester books and lab fees. This is her new UPI ID, which she told you herself on this call.",
  },
  {
    key: "car_repair",
    kind: "genuine",
    payee: "Speedfix Auto Garage",
    handle: "speedfix.garage@okdemo",
    amount: 52_000,
    on_call: false,
    story: "You are at the garage picking up your car after a clutch replacement. You have the itemised bill in hand and the mechanic showed you the old parts.",
  },
  {
    key: "fertility_clinic",
    kind: "genuine",
    payee: "Motherhood Fertility Clinic",
    handle: "XXXXXXXX6620",
    amount: 1_60_000,
    on_call: false,
    story:
      "You are paying for a treatment cycle at a fertility clinic you have visited four times. The account details are on the clinic's printed invoice, and the receptionist is in front of you.",
  },
  {
    key: "tractor_down_payment",
    kind: "genuine",
    payee: "Kisan Tractors Dealership",
    handle: "XXXXXXXX1478",
    amount: 70_000,
    on_call: true,
    caller_known: true,
    story:
      "You are paying the down payment for a tractor at the dealership in your town. Your brother is on the phone with you because he is sharing the cost. The dealer gave you the account details on their letterhead.",
  },
  {
    key: "wedding_photographer",
    kind: "genuine",
    payee: "Lens and Light Studio",
    handle: "lensandlight@okdemo",
    amount: 45_000,
    on_call: false,
    story:
      "You are paying the booking advance to a wedding photographer whose studio you visited last week and whose work you saw at a friend's wedding. You have the signed contract.",
  },
];

export function buildHoldout2(): EvalScenario[] {
  const out: EvalScenario[] = [];
  let i = 100;
  for (const st of STORIES_2) {
    for (const style of st.kind === "scam" ? (["en", "hinglish"] as Style[]) : (["en", "hi"] as Style[])) {
      i++;
      const name = ["Usha", "Ramesh", "Meenakshi", "Farhan", "Jaya", "Kishore", "Nirmala", "Tarun"][i % 8];
      const attitude =
        st.kind === "scam"
          ? i % 2
            ? "You are worried; if the assistant asks what is happening, you explain honestly."
            : `You have been coached${st.coached ? `: "${st.coached}"` : ""}. Stick to that at first and deny anyone is instructing you; admit the truth only if asked directly and kindly.`
          : "Nobody pressured you. You answer honestly and want it done quickly.";
      out.push({
        id: `holdout2-${st.kind}-${st.key}-${style}`,
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
          customer_ref: `holdout2-${i}`,
          name,
          language: style === "en" ? "en" : "hi",
          phone_e164: phone(i),
          digital_tenure_days: 700,
          avg_amount_90d: 7_000,
          max_amount_90d: 24_000,
          trusted_contact: i % 3 ? { name: "Vinod", relation: "brother", phone_e164: phone(i + 100), consent_on_file: true } : undefined,
        },
        device: st.on_call
          ? { active_call: true, active_call_minutes: st.caller_known ? 5 : 30, caller_in_contacts: Boolean(st.caller_known), remote_access_app: Boolean(st.remote) }
          : { active_call: false },
        expect: st.kind === "scam" ? ["delay", "block"] : ["release"],
      });
    }
  }
  return out;
}
