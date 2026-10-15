import type { Lang, LibraryLang, Signal } from "./types.js";
import { SOURCES, type SourceId } from "./sources.js";

/**
 * Ruko's scam pattern library. Each pattern is built from official Indian public
 * advisories (see `sources`, and docs/RESEARCH.md for what each source says).
 *
 * - `signals` maps call signals to weights; the engine uses it to name the most
 *   likely pattern from what the agent heard.
 * - `truth` is the one sentence the agent says out loud to break the script. It
 *   is served to the agent by the engine (tool responses), so the agent never
 *   improvises official advice.
 * - English and Hindi are written for production. Tamil, Bengali and Marathi are
 *   draft translations awaiting native-speaker review, and are labelled as such.
 */

export interface ScamPattern {
  id: string;
  name: Record<Lang, string>;
  summary: string;
  indicators: string[];
  /** How the script usually sounds, paraphrased from advisories. Never used as an agent instruction. */
  typical_claims: string[];
  signals: Record<string, number>;
  keywords: string[];
  truth: Partial<Record<LibraryLang, string>>;
  advice: Record<Lang, string[]>;
  ask_next: Record<Lang, string>;
  sources: SourceId[];
}

export const DRAFT_LANGS: LibraryLang[] = ["ta", "bn", "mr"];

export const OFFICIAL_CHANNELS = {
  helpline: "1930",
  ncrp: "cybercrime.gov.in",
  chakshu: "sancharsaathi.gov.in (Chakshu)",
};

export const PATTERNS: ScamPattern[] = [
  {
    id: "digital_arrest",
    name: { en: "Digital arrest", hi: "डिजिटल अरेस्ट" },
    summary:
      "Callers pose as police, CBI, ED, narcotics, customs or court officials, claim the victim is linked to a crime, keep them on a video call for hours and demand money to 'clear their name' or for 'verification'.",
    indicators: [
      "A video or phone call from someone in uniform or claiming to be an officer",
      "Told they are under 'digital arrest' and must stay on camera",
      "Threat of arrest, a case, or frozen accounts",
      "Told to keep it secret from family",
      "Asked to move money to a 'safe' or 'verification' account",
    ],
    typical_claims: [
      "Your Aadhaar or phone number has been used in money laundering or drug trafficking.",
      "You are under digital arrest and cannot leave the call.",
      "Transfer your savings to an RBI or court account for verification; it will be returned.",
    ],
    signals: { authority_threat: 3, coached_on_call: 2, secrecy_demand: 2, urgency_pressure: 1, distress: 1 },
    keywords: [
      "digital arrest", "cbi", "ed ", "enforcement directorate", "narcotics", "ncb", "police", "officer", "video call",
      "money laundering", "arrest", "warrant", "court", "judge", "verification account", "safe account", "aadhaar misuse",
      "गिरफ्तार", "डिजिटल अरेस्ट", "पुलिस", "सीबीआई", "वीडियो कॉल", "giraftar", "arrest kar",
    ],
    truth: {
      en: "There's no 'digital arrest' in Indian law; it's a fraud. Police, CBI or courts never arrest or question anyone on a video call.",
      hi: "कानून में 'डिजिटल अरेस्ट' जैसी कोई व्यवस्था नहीं है, यह सिर्फ़ धोखा है। पुलिस, सीबीआई या अदालत वीडियो कॉल पर न गिरफ़्तार करती है, न पूछताछ।",
      ta: "இந்திய சட்டத்தில் 'டிஜிட்டல் கைது' என்று எதுவும் இல்லை; இது மோசடி மட்டுமே. காவல்துறை, சிபிஐ அல்லது நீதிமன்றம் தொலைபேசி அல்லது வீடியோ அழைப்பில் யாரையும் கைது செய்வதில்லை, பணமும் கேட்பதில்லை.",
      bn: "ভারতীয় আইনে 'ডিজিটাল অ্যারেস্ট' বলে কিছু নেই; এটা শুধুই প্রতারণা। পুলিশ, সিবিআই বা আদালত কখনও ফোন বা ভিডিও কলে কাউকে গ্রেপ্তার করে না, টাকাও চায় না।",
      mr: "भारतीय कायद्यात 'डिजिटल अरेस्ट' असे काहीही नाही; ही फक्त फसवणूक आहे. पोलीस, सीबीआय किंवा न्यायालय कधीही फोन किंवा व्हिडिओ कॉलवर अटक करत नाहीत आणि पैसे मागत नाहीत.",
    },
    advice: {
      en: [
        "End the call. Do not pay or move money anywhere.",
        "Call 1930 or report at cybercrime.gov.in.",
        "Report the caller's number on Sanchar Saathi (Chakshu).",
        "Tell a family member what happened.",
      ],
      hi: [
        "कॉल काट दें। कहीं भी पैसे न भेजें।",
        "1930 पर कॉल करें या cybercrime.gov.in पर शिकायत करें।",
        "कॉल करने वाले का नंबर संचार साथी (चक्षु) पर रिपोर्ट करें।",
        "परिवार के किसी सदस्य को बताएँ।",
      ],
    },
    ask_next: {
      en: "Did the person say they were from the police, CBI, customs or a court, or ask you to stay on a video call?",
      hi: "क्या उस व्यक्ति ने कहा कि वह पुलिस, सीबीआई, कस्टम या अदालत से है, या आपसे वीडियो कॉल पर बने रहने को कहा?",
    },
    sources: ["i4c_digital_arrest_adv", "mann_ki_baat_115", "rbi_kehta_hai_digital_arrest", "mha_alert_2024", "ncrp"],
  },
  {
    id: "courier_parcel",
    name: { en: "Courier or parcel case", hi: "कूरियर / पार्सल केस" },
    summary:
      "A caller claiming to be from a courier company or customs says a parcel in the victim's name holds drugs, passports or contraband, then 'transfers' the call to fake police who demand money to settle the case. Often turns into a digital arrest.",
    indicators: [
      "A parcel the victim never sent",
      "Call 'transferred' to police or narcotics",
      "Demand for a fee, fine or verification deposit",
    ],
    typical_claims: [
      "A parcel booked with your Aadhaar contains drugs and fake passports.",
      "Press 1 to speak to the courier officer; we are connecting you to the police.",
    ],
    signals: { authority_threat: 2, pay_to_receive: 1, coached_on_call: 1, urgency_pressure: 1, secrecy_demand: 1 },
    keywords: ["parcel", "courier", "fedex", "dhl", "blue dart", "customs", "package", "drugs", "passport", "पार्सल", "कूरियर", "कस्टम"],
    truth: {
      en: "Real police never pressure you to send money immediately, and no courier company settles a police case over the phone.",
      hi: "असली पुलिस कभी तुरंत पैसे भेजने का दबाव नहीं डालती, और कोई कूरियर कंपनी फ़ोन पर पुलिस केस नहीं निपटाती।",
    },
    advice: {
      en: [
        "Hang up. Look up the courier's official number yourself if you want to check.",
        "Do not pay any fine or deposit.",
        "Report at cybercrime.gov.in or call 1930.",
      ],
      hi: [
        "फ़ोन काट दें। जाँच करनी हो तो कूरियर कंपनी का आधिकारिक नंबर खुद ढूँढें।",
        "कोई जुर्माना या जमा राशि न भेजें।",
        "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।",
      ],
    },
    ask_next: {
      en: "Did someone call you about a parcel or courier in your name?",
      hi: "क्या किसी ने आपके नाम के किसी पार्सल या कूरियर के बारे में फ़ोन किया था?",
    },
    sources: ["mha_alert_2024", "cert_in_scams", "dot_international_call", "ncrp"],
  },
  {
    id: "kyc_block",
    name: { en: "Fake KYC update / account block", hi: "नकली केवाईसी / खाता बंद होने की धमकी" },
    summary:
      "Messages or calls say the bank account, card, PAN or KYC will be blocked today unless the customer updates details through a link, an app or a payment, or shares an OTP.",
    indicators: [
      "'Your account will be blocked today' by SMS, WhatsApp or call",
      "A link or app to 'update KYC'",
      "Request for OTP, PIN or a small payment",
    ],
    typical_claims: ["Your KYC has expired; your account will be blocked in 24 hours.", "Update your PAN now through this link."],
    signals: { account_block_threat: 3, remote_access: 1, urgency_pressure: 1 },
    keywords: ["kyc", "pan", "aadhaar link", "account block", "blocked", "update", "expire", "केवाईसी", "खाता बंद", "block ho"],
    truth: {
      en: "Your bank never blocks accounts over a phone call, and never asks for your OTP or PIN. Update KYC only at your branch or official app.",
      hi: "आपका बैंक फ़ोन पर खाता बंद नहीं करता, और ओटीपी या पिन कभी नहीं माँगता। केवाईसी सिर्फ़ शाखा या आधिकारिक ऐप से करें।",
      ta: "உங்கள் வங்கியோ RBI-யோ உங்கள் OTP, PIN அல்லது CVV-ஐ ஒருபோதும் கேட்காது. KYC-ஐ உங்கள் கிளையிலோ வங்கியின் அதிகாரப்பூர்வ செயலியிலோ மட்டும் புதுப்பிக்கவும்.",
      bn: "আপনার ব্যাংক বা RBI কখনও আপনার OTP, পিন বা CVV চায় না। KYC শুধু আপনার শাখায় বা ব্যাংকের অফিসিয়াল অ্যাপে আপডেট করুন।",
      mr: "तुमची बँक किंवा आरबीआय कधीही तुमचा ओटीपी, पिन किंवा सीव्हीव्ही मागत नाही. केवायसी फक्त तुमच्या शाखेत किंवा बँकेच्या अधिकृत अॅपवर अपडेट करा.",
    },
    advice: {
      en: [
        "Do not click links or install apps sent by message.",
        "Update KYC only at your branch or in the bank's official app.",
        "Report the message on Sanchar Saathi (Chakshu).",
      ],
      hi: [
        "मैसेज में आए लिंक पर क्लिक न करें, न कोई ऐप डाउनलोड करें।",
        "केवाईसी सिर्फ़ अपनी शाखा या बैंक के आधिकारिक ऐप में अपडेट करें।",
        "मैसेज को संचार साथी (चक्षु) पर रिपोर्ट करें।",
      ],
    },
    ask_next: {
      en: "Did anyone tell you your account, card or KYC would be blocked?",
      hi: "क्या किसी ने कहा कि आपका खाता, कार्ड या केवाईसी बंद हो जाएगा?",
    },
    sources: ["rbi_kyc_caution", "rbi_kehta_hai_cautions", "rbi_otp_2022", "rbi_beaware"],
  },
  {
    id: "investment_trading",
    name: { en: "Investment or trading app", hi: "निवेश / ट्रेडिंग ऐप" },
    summary:
      "Victims are added to WhatsApp or Telegram 'stock tips' or IPO groups, shown fake profits on an app, and asked to keep depositing, then to pay 'tax' or 'fees' before they can withdraw.",
    indicators: [
      "Guaranteed or very high returns",
      "Tips group on WhatsApp or Telegram",
      "Must pay to withdraw profits",
      "Payee is an individual, not a registered broker",
    ],
    typical_claims: ["Our members made 300% this month.", "Pay the 20% tax to release your profit."],
    signals: { promised_returns: 3, payee_unknown: 1, urgency_pressure: 1 },
    keywords: ["invest", "trading", "stock", "ipo", "returns", "profit", "crypto", "tips", "telegram", "whatsapp group", "निवेश", "मुनाफ़ा", "share market"],
    truth: {
      en: "Guaranteed returns in the share market are a scam. A real platform never charges a fee to release your own money.",
      hi: "शेयर बाज़ार में पक्के मुनाफ़े की गारंटी धोखा है। असली प्लेटफ़ॉर्म आपका अपना पैसा निकालने के लिए फ़ीस नहीं माँगता।",
    },
    advice: {
      en: [
        "Invest only through SEBI-registered brokers and check registration on sebi.gov.in.",
        "Do not send more money to 'unlock' profits.",
        "Report at cybercrime.gov.in or call 1930.",
      ],
      hi: [
        "सिर्फ़ सेबी में पंजीकृत ब्रोकर के ज़रिए निवेश करें; sebi.gov.in पर जाँचें।",
        "मुनाफ़ा 'खुलवाने' के लिए और पैसे न भेजें।",
        "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।",
      ],
    },
    ask_next: {
      en: "Is this payment for an investment or trading app, or a tips group you joined?",
      hi: "क्या यह भुगतान किसी निवेश या ट्रेडिंग ऐप, या किसी टिप्स ग्रुप के लिए है?",
    },
    sources: ["sebi_fake_trading", "rbi_beaware", "ncrp"],
  },
  {
    id: "task_job",
    name: { en: "Part-time job or task", hi: "पार्ट-टाइम जॉब / टास्क" },
    summary:
      "Offers of easy work (liking videos, rating hotels, reviews) pay small amounts at first, then require 'prepaid tasks' or deposits to unlock larger earnings that are never paid.",
    indicators: ["Paid to like, review or rate", "Small payouts first", "Must deposit to unlock earnings"],
    typical_claims: ["Complete 3 prepaid tasks to withdraw your commission.", "Your account is frozen until you pay the reset fee."],
    signals: { pay_to_earn: 3, urgency_pressure: 1, payee_unknown: 1 },
    keywords: ["task", "part time", "part-time", "job", "like videos", "youtube", "review", "rating", "commission", "prepaid", "work from home", "टास्क", "नौकरी"],
    truth: {
      en: "A genuine company offering a job will never ask you for money.",
      hi: "नौकरी देने वाली कोई भी असली कंपनी आपसे पैसे नहीं माँगती।",
    },
    advice: {
      en: ["Stop paying; deposits are not returned.", "Report at cybercrime.gov.in or call 1930."],
      hi: ["आगे पैसे न भेजें; जमा पैसा वापस नहीं मिलता।", "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Do you need to make this payment to get paid for work or tasks?",
      hi: "क्या काम या टास्क की कमाई पाने के लिए यह भुगतान करना ज़रूरी बताया गया है?",
    },
    sources: ["rbi_beaware", "cert_in_scams", "mha_task_fraud"],
  },
  {
    id: "fake_support_refund",
    name: { en: "Fake customer care or refund", hi: "नकली कस्टमर केयर / रिफ़ंड" },
    summary:
      "A 'customer care' number found online, or a caller offering a refund, asks the victim to approve a UPI request, enter their PIN or install a screen-sharing app so the 'refund' can be processed.",
    indicators: [
      "Helpline number found through a search result or social media",
      "Asked to enter UPI PIN or approve a request to 'receive' money",
      "Asked to install AnyDesk, TeamViewer or a support app",
    ],
    typical_claims: ["Enter your PIN to receive the refund.", "Install this app so I can help you."],
    signals: { pay_to_receive: 2, remote_access: 2, payee_unknown: 1 },
    keywords: ["refund", "customer care", "helpline", "cashback", "approve request", "collect request", "receive money", "anydesk", "teamviewer", "रिफ़ंड", "कस्टमर केयर"],
    truth: {
      en: "You never need a UPI PIN or a QR scan to receive money. The PIN is only for sending money.",
      hi: "पैसे पाने के लिए कभी यूपीआई पिन या क्यूआर स्कैन की ज़रूरत नहीं होती। पिन सिर्फ़ पैसे भेजने के लिए है।",
      ta: "பணம் பெற UPI PIN உள்ளிடவோ QR குறியீட்டை ஸ்கேன் செய்யவோ தேவையில்லை. PIN பணம் அனுப்ப மட்டுமே.",
      bn: "টাকা পেতে কখনও UPI পিন দিতে বা QR কোড স্ক্যান করতে হয় না। পিন শুধু টাকা পাঠানোর জন্য।",
      mr: "पैसे मिळवण्यासाठी कधीही यूपीआय पिन टाकावा किंवा क्यूआर कोड स्कॅन करावा लागत नाही. पिन फक्त पैसे पाठवण्यासाठी असतो.",
    },
    advice: {
      en: [
        "Use only the customer care number on the company's official website or app.",
        "Never approve a collect request from someone you don't know.",
        "Uninstall any screen-sharing app you installed on a caller's request.",
      ],
      hi: [
        "कस्टमर केयर का नंबर सिर्फ़ कंपनी की आधिकारिक वेबसाइट या ऐप से लें।",
        "अनजान व्यक्ति की कलेक्ट रिक्वेस्ट कभी मंज़ूर न करें।",
        "कॉल करने वाले के कहने पर डाला गया स्क्रीन-शेयरिंग ऐप हटा दें।",
      ],
    },
    ask_next: {
      en: "Are you making this payment to receive a refund or cashback?",
      hi: "क्या आप यह भुगतान कोई रिफ़ंड या कैशबैक पाने के लिए कर रहे हैं?",
    },
    sources: ["npci_safety", "rbi_beaware", "dot_upi_alert", "i4c_fake_customer_care", "cert_in_scams"],
  },
  {
    id: "remote_access",
    name: { en: "Screen-sharing takeover", hi: "स्क्रीन-शेयरिंग से धोखा" },
    summary:
      "The caller gets the victim to install a remote-access app or an unknown APK, then watches or controls the phone while the victim 'verifies' a payment.",
    indicators: ["Asked to install an app or APK", "Asked to share screen", "Someone guiding taps during the payment"],
    typical_claims: ["Install this app so our technician can fix it.", "Share your screen while you complete verification."],
    signals: { remote_access: 3, coached_on_call: 1 },
    keywords: ["anydesk", "teamviewer", "quicksupport", "screen share", "screen sharing", "apk", "install app", "remote", "स्क्रीन शेयर"],
    truth: {
      en: "Never install a screen-sharing app for someone who calls you. Please uninstall it now.",
      hi: "फ़ोन करने वाले के कहने पर कभी स्क्रीन-शेयरिंग ऐप न डालें। उसे अभी हटा दें।",
    },
    advice: {
      en: ["Uninstall the app now.", "Change your banking passwords from a safe device.", "Call 1930 if money has moved."],
      hi: ["ऐप अभी हटा दें।", "किसी सुरक्षित फ़ोन से बैंकिंग पासवर्ड बदलें।", "पैसे गए हों तो 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Has anyone asked you to install an app or share your screen today?",
      hi: "क्या आज किसी ने आपसे कोई ऐप डालने या स्क्रीन शेयर करने को कहा?",
    },
    sources: ["cert_in_scams", "rbi_beaware"],
  },
  {
    id: "electricity_disconnection",
    name: { en: "Electricity disconnection threat", hi: "बिजली कटने की धमकी" },
    summary:
      "An SMS or call says power will be cut tonight because a bill is unpaid, and gives a personal number to call; the 'officer' then asks for a payment or an app install.",
    indicators: ["SMS from a personal mobile number", "Disconnection 'tonight'", "Pay to an individual or through a link"],
    typical_claims: ["Your electricity will be disconnected at 9:30 pm. Call the officer immediately."],
    signals: { account_block_threat: 2, urgency_pressure: 2, remote_access: 1 },
    keywords: ["electricity", "bijli", "power cut", "disconnect", "bill", "light", "बिजली", "connection kat"],
    truth: {
      en: "Don't call the number in that message. Pay your bill only on your electricity company's official app or website.",
      hi: "उस मैसेज वाले नंबर पर कॉल न करें। बिल सिर्फ़ बिजली कंपनी के आधिकारिक ऐप या वेबसाइट पर भरें।",
    },
    advice: {
      en: ["Check your bill on the official website or app.", "Report the SMS on Sanchar Saathi (Chakshu)."],
      hi: ["बिल आधिकारिक वेबसाइट या ऐप पर जाँचें।", "मैसेज को संचार साथी (चक्षु) पर रिपोर्ट करें।"],
    },
    ask_next: {
      en: "Is this payment because someone said your electricity or a service would be cut off?",
      hi: "क्या यह भुगतान इसलिए है कि किसी ने कहा आपकी बिजली या कोई सेवा कट जाएगी?",
    },
    sources: ["i4c_electricity", "cert_in_scams", "chakshu"],
  },
  {
    id: "relative_emergency",
    name: { en: "Relative in trouble", hi: "रिश्तेदार मुसीबत में" },
    summary:
      "A caller (sometimes with a cloned or crying voice) says a son, daughter or relative has been arrested or hurt and needs money immediately, and asks the victim not to tell anyone.",
    indicators: ["Urgent call about a relative", "Victim has not spoken to the relative", "Payment to a stranger's account", "Told to keep it quiet"],
    typical_claims: ["Your son has been caught; pay now and we will let him go.", "Don't call anyone, it will make it worse."],
    signals: { relative_emergency: 3, urgency_pressure: 1, secrecy_demand: 1, distress: 1 },
    keywords: ["son", "daughter", "nephew", "accident", "hospital", "arrested", "beta", "beti", "relative", "बेटा", "बेटी", "एक्सीडेंट"],
    truth: {
      en: "Please hang up and call your relative yourself on their usual number. Voices can be faked with AI.",
      hi: "कृपया फ़ोन काटकर अपने रिश्तेदार को उनके पुराने नंबर पर ख़ुद कॉल करें। आवाज़ AI से नकली बनाई जा सकती है।",
    },
    advice: {
      en: ["Call the relative directly on their known number.", "Agree a family code word for emergencies.", "Report at cybercrime.gov.in or call 1930."],
      hi: ["रिश्तेदार को उनके जाने-पहचाने नंबर पर सीधे कॉल करें।", "इमरजेंसी के लिए परिवार में एक कोड शब्द तय करें।", "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Have you spoken directly to your relative on their usual number since this started?",
      hi: "क्या इसके बाद आपने अपने रिश्तेदार से उनके असली नंबर पर सीधे बात की है?",
    },
    sources: ["cert_in_deepfake_2026", "mha_alert_2024", "ncrp_brochure"],
  },
  {
    id: "prize_lottery",
    name: { en: "Prize, lottery or gift fee", hi: "इनाम / लॉटरी / गिफ़्ट शुल्क" },
    summary:
      "The victim is told they have won a lottery, a quiz prize or a gift from abroad, and must pay processing fees, taxes or customs duty before it can be released.",
    indicators: ["A prize from a contest never entered", "Fee or tax before payout", "Gift stuck at customs"],
    typical_claims: ["You won 25 lakh in the KBC lucky draw; pay the GST first.", "Your foreign gift is held at customs."],
    signals: { pay_to_receive: 3, urgency_pressure: 1 },
    keywords: ["lottery", "prize", "won", "kbc", "lucky draw", "gift", "customs duty", "processing fee", "इनाम", "लॉटरी"],
    truth: {
      en: "You can't win a lottery you never entered, and a real prize never asks for a fee first.",
      hi: "जिस लॉटरी में आपने हिस्सा नहीं लिया, वह आप जीत नहीं सकते, और असली इनाम पहले फ़ीस नहीं माँगता।",
    },
    advice: {
      en: ["Do not pay any fee.", "Report at cybercrime.gov.in or call 1930."],
      hi: ["कोई फ़ीस न भरें।", "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Is this a fee to receive a prize, a gift or a loan?",
      hi: "क्या यह कोई इनाम, गिफ़्ट या लोन पाने के लिए फ़ीस है?",
    },
    sources: ["rbi_lottery", "i4c_kbc_lottery", "rbi_kehta_hai_cautions", "rbi_beaware"],
  },
  {
    id: "sim_disconnection",
    name: { en: "SIM or number disconnection", hi: "सिम / नंबर बंद होने की धमकी" },
    summary:
      "A recorded or live call claiming to be from TRAI or the telecom department says the victim's number will be disconnected for illegal activity, then hands them to fake police.",
    indicators: ["Call 'from TRAI' or 'DoT'", "Number to be cut off within hours", "Transferred to police"],
    typical_claims: ["Your number will be blocked in two hours. Press 9 to speak to an officer."],
    signals: { account_block_threat: 2, authority_threat: 2, urgency_pressure: 1 },
    keywords: ["trai", "dot", "telecom", "sim", "mobile number", "disconnect", "सिम", "नंबर बंद"],
    truth: {
      en: "The telecom department never calls to threaten disconnection, and no regulator collects payments over a phone or video call.",
      hi: "दूरसंचार विभाग कनेक्शन काटने की धमकी देने वाली कॉल नहीं करता, और कोई नियामक फ़ोन या वीडियो कॉल पर पैसे नहीं लेता।",
    },
    advice: {
      en: ["Hang up.", "Report the call on Sanchar Saathi (Chakshu).", "Call 1930 if you were asked for money."],
      hi: ["फ़ोन काट दें।", "कॉल को संचार साथी (चक्षु) पर रिपोर्ट करें।", "पैसे माँगे गए हों तो 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Did a call say your SIM or phone number would be disconnected?",
      hi: "क्या किसी कॉल में कहा गया कि आपका सिम या नंबर बंद हो जाएगा?",
    },
    sources: ["dot_sim_disconnection", "trai_no_payments", "chakshu"],
  },
  {
    id: "video_call_blackmail",
    name: { en: "Video-call blackmail", hi: "वीडियो कॉल ब्लैकमेल" },
    summary:
      "After a video call with a stranger, the victim is threatened with an edited or recorded video and told to pay or it will be sent to family; fake 'police' may follow up.",
    indicators: ["Threat to share a video or photos", "Repeated demands after each payment"],
    typical_claims: ["Pay now or the video goes to all your contacts."],
    signals: { secrecy_demand: 2, urgency_pressure: 2, distress: 1, authority_threat: 1 },
    keywords: ["video", "blackmail", "photos", "morphed", "viral", "contacts", "sextortion", "ब्लैकमेल"],
    truth: {
      en: "Paying never ends blackmail. Stop replying, keep the evidence and report it on 1930.",
      hi: "पैसे देने से ब्लैकमेल ख़त्म नहीं होता। जवाब देना बंद करें, सबूत रखें और 1930 पर शिकायत करें।",
    },
    advice: {
      en: ["Do not pay.", "Keep screenshots and the numbers used.", "Report at cybercrime.gov.in or call 1930."],
      hi: ["पैसे न दें।", "स्क्रीनशॉट और नंबर संभालकर रखें।", "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।"],
    },
    ask_next: {
      en: "Is someone threatening to share something about you unless you pay?",
      hi: "क्या कोई धमकी दे रहा है कि पैसे न देने पर आपके बारे में कुछ फैला देगा?",
    },
    sources: ["cert_in_mahila", "ncrp"],
  },
];

export const patternById = (id: string): ScamPattern | undefined => PATTERNS.find((p) => p.id === id);

export function patternSources(p: ScamPattern) {
  return p.sources.map((s) => SOURCES[s]);
}

/**
 * Names the most likely pattern from the signals the agent recorded (plus the
 * agent's own hint and keywords in its evidence quotes). Returns null when the
 * evidence is too thin to name anything.
 */
export function inferPattern(signals: Pick<Signal, "type" | "confidence" | "evidence" | "pattern_hint">[]): { id: string; name: string } | null {
  const counted = signals.filter((s) => s.confidence !== "low");
  if (!counted.length) return null;
  const evidence = counted.map((s) => s.evidence.toLowerCase()).join(" \n ");
  let best: { p: ScamPattern; score: number } | null = null;
  for (const p of PATTERNS) {
    let score = 0;
    for (const s of counted) score += p.signals[s.type] ?? 0;
    for (const s of counted) if (s.pattern_hint === p.id) score += 2;
    const kw = p.keywords.filter((k) => evidence.includes(k.toLowerCase())).length;
    score += Math.min(kw, 3) * 0.75;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best || best.score < 3) return null;
  return { id: best.p.id, name: best.p.name.en };
}

/** Rule-based match of free text (public text check). Returns up to 3 candidates with a score. */
export function matchText(text: string): { pattern: ScamPattern; score: number; matched: string[] }[] {
  const t = ` ${text.toLowerCase()} `;
  return PATTERNS.map((p) => {
    const matched = p.keywords.filter((k) => t.includes(k.toLowerCase()));
    return { pattern: p, score: matched.length, matched };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function truthFor(p: ScamPattern, lang: Lang): string {
  return p.truth[lang] ?? p.truth.en ?? "";
}
