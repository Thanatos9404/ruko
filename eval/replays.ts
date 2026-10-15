/**
 * Records the "recorded demo" conversations for the sandbox app: each held demo
 * scenario, in English and Hindi, run through the same text-mode harness as the
 * eval (same prompt, tools and engine). The web app replays the recorded tool
 * calls against a fresh demo check, so the decision on screen is still computed
 * live by the real engine.
 *
 *   npx tsx eval/replays.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { DEMO_SCENARIOS } from "../shared/scenarios.js";
import type { Lang } from "../shared/types.js";
import { Nebius } from "./nebius.js";
import { runConversation } from "./conversation.js";
import type { EvalScenario } from "./scenarios.js";

const PERSONAS: Record<string, Record<Lang, string>> = {
  "digital-arrest": {
    en: "You are Kamla, 68, a retired school teacher. For 47 minutes a man in a police uniform has kept you on a WhatsApp video call on your other phone. He says he is a CBI officer, that a parcel with drugs was booked with your Aadhaar, that you are under 'digital arrest', and that you must move your savings to an RBI 'safe custody' account for verification. He told you not to tell your son. You are frightened. You first say the money is 'for some verification'. When the bank's assistant asks whether anyone is on another call, you admit that the CBI officer is on video call right now. If the assistant explains it is a fraud, you feel relieved and want to stop the payment, and you agree if they offer to call your son Ravi.",
    hi: "आप कमला हैं, 68 साल की रिटायर्ड टीचर। 47 मिनट से पुलिस की वर्दी में एक आदमी आपको दूसरे फ़ोन पर व्हाट्सऐप वीडियो कॉल पर रोके हुए है। वह कहता है कि वह सीबीआई अफ़सर है, आपके आधार से ड्रग्स वाला पार्सल बुक हुआ है, आप 'डिजिटल अरेस्ट' में हैं, और आपको अपनी बचत आरबीआई के 'सेफ़ कस्टडी' खाते में वेरिफ़िकेशन के लिए भेजनी है। उसने कहा है कि बेटे को न बताएँ। आप डरी हुई हैं। पहले आप कहती हैं कि पैसा 'कुछ वेरिफ़िकेशन के लिए' है। जब बैंक की सहायक पूछे कि क्या कोई और कॉल पर है, तो आप मान लेती हैं कि सीबीआई अफ़सर अभी वीडियो कॉल पर है। सहायक धोखे के बारे में बताए तो आपको राहत मिलती है, आप भुगतान रोकना चाहती हैं, और बेटे रवि को कॉल करने के लिए हाँ कह देती हैं। सरल हिंदी में बोलें, देवनागरी में।",
  },
  "investment-group": {
    en: "You are Rohan, 34. Three weeks ago you joined a WhatsApp 'stock tips' group; their trading app shows ₹3.4 lakh profit on your ₹50,000. To withdraw, they say you must first pay a 15% 'profit tax' to their desk account. Nobody is on a call with you. You think it's legitimate but answer honestly. If the assistant explains why it is a fraud, you are shocked and agree to hold the payment, and you agree if they offer to call your sister Meera.",
    hi: "आप रोहन हैं, 34 साल। तीन हफ़्ते पहले आप एक व्हाट्सऐप 'स्टॉक टिप्स' ग्रुप में जुड़े; उनका ट्रेडिंग ऐप आपके ₹50,000 पर ₹3.4 लाख मुनाफ़ा दिखाता है। पैसे निकालने के लिए वे कहते हैं कि पहले 15% 'प्रॉफ़िट टैक्स' उनके खाते में भरना होगा। कोई कॉल पर नहीं है। आपको लगता है यह सही है, पर आप सच बताते हैं। सहायक धोखा समझाए तो आप चौंक जाते हैं, भुगतान रोकने को राज़ी हो जाते हैं, और बहन मीरा को कॉल करने के लिए हाँ कह देते हैं। सरल हिंदी में बोलें, देवनागरी में।",
  },
  "flat-deposit": {
    en: "You are Priya, 41. You're paying a ₹1.5 lakh booking amount for flat B-1204 to Shree Ganesh Builders. You visited their site office twice and have the allotment letter with these account details. Your husband Anil is on the phone with you, reading out the account number from the letter. Nobody pressured you. You are cooperative but in a hurry.",
    hi: "आप प्रिया हैं, 41 साल। आप फ़्लैट B-1204 के लिए श्री गणेश बिल्डर्स को ₹1.5 लाख की बुकिंग राशि दे रही हैं। आप उनके साइट ऑफ़िस दो बार गई हैं और आपके पास अलॉटमेंट लेटर है जिसमें यही खाता लिखा है। आपके पति अनिल फ़ोन पर हैं और लेटर से खाता नंबर पढ़ रहे हैं। किसी ने दबाव नहीं डाला। आप सहयोग करती हैं पर जल्दी में हैं। सरल हिंदी में बोलें, देवनागरी में।",
  },
  "task-job": {
    en: "You are Neha, 23. A Telegram contact gave you part-time work liking YouTube videos; you earned ₹450. Now a 'prepaid task' needs ₹12,000 to unlock your ₹38,000 commission within 30 minutes. Nobody is on a call. You answer honestly. If the assistant explains it's a fraud, you agree to stop.",
    hi: "आप नेहा हैं, 23 साल। टेलीग्राम पर किसी ने यूट्यूब वीडियो लाइक करने का पार्ट-टाइम काम दिया; आपने ₹450 कमाए। अब एक 'प्रीपेड टास्क' में ₹38,000 कमीशन खुलवाने के लिए 30 मिनट में ₹12,000 भरने हैं। कोई कॉल पर नहीं है। आप सच बताती हैं। सहायक धोखा समझाए तो आप रुकने को राज़ी हो जाती हैं। सरल हिंदी में बोलें, देवनागरी में।",
  },
  "hospital-bill": {
    en: "You are Mohan, 45. Your father was admitted to City Care Hospital for surgery. You're at the billing counter paying the ₹85,000 deposit by scanning their QR code, and your brother is on the phone from the ward telling you which counter to go to. Nobody else asked you to pay. You're stressed and want it done.",
    hi: "आप मोहन हैं, 45 साल। आपके पिता सिटी केयर अस्पताल में सर्जरी के लिए भर्ती हैं। आप बिलिंग काउंटर पर उनका क्यूआर कोड स्कैन करके ₹85,000 जमा कर रहे हैं, और आपका भाई वार्ड से फ़ोन पर बता रहा है कि किस काउंटर पर जाना है। किसी और ने पैसे भेजने को नहीं कहा। आप तनाव में हैं और जल्दी करना चाहते हैं। सरल हिंदी में बोलें, देवनागरी में।",
  },
};

const RULES: Record<Lang, string> = {
  en: " Speak natural Indian English. Say only what you would say out loud, one or two short sentences. Never mention being an AI. If the assistant says goodbye, reply exactly [END].",
  hi: " केवल वही बोलें जो आप फ़ोन पर बोलेंगे, एक-दो छोटे वाक्य। कभी न कहें कि आप AI हैं। सहायक विदा ले तो ठीक [END] लिखें।",
};

const llm = new Nebius();
await mkdir("public/replays", { recursive: true });
const index: { id: string; lang: Lang; decision: string | null; turns: number }[] = [];
for (const sc of DEMO_SCENARIOS.filter((s) => s.id !== "rent")) {
  for (const lang of ["en", "hi"] as Lang[]) {
    const scenario: EvalScenario = {
      id: `demo-${sc.id}-${lang}`,
      kind: sc.truth === "scam" ? "scam" : "genuine",
      style: lang,
      persona: PERSONAS[sc.id][lang] + RULES[lang],
      payment: sc.payment,
      customer: { ...sc.customer, language: lang },
      device: sc.device,
      expect: sc.truth === "scam" ? ["delay", "block"] : ["release"],
    };
    const r = await runConversation(llm, scenario, {
      agentModel: "Qwen/Qwen3-30B-A3B-Instruct-2507",
      customerModel: "deepseek-ai/DeepSeek-V4-Flash-0731",
      maxCustomerTurns: 8,
      seed: 11,
    });
    const greeting = r.turns[0]?.text ?? "";
    const code = greeting.match(/(?:code word is|कोड शब्द है)\s+([^\s.।?]+\s\d{2})/)?.[1] ?? null;
    const out = {
      scenario: sc.id,
      lang,
      recorded_code_word: code,
      recorded_decision: r.decision,
      note: "Recorded text-mode conversation (Nebius-hosted stand-in LLM, same prompt and tools as the Bolna agent). Replayed tool calls run through the live engine.",
      turns: r.turns.map((t) => (t.role === "tool" ? { role: "tool", tool: t.tool, args: t.args } : { role: t.role, text: t.text })),
    };
    await writeFile(`public/replays/${sc.id}-${lang}.json`, JSON.stringify(out, null, 1));
    index.push({ id: sc.id, lang, decision: r.decision, turns: r.customer_turns });
    console.log(`${sc.id}-${lang}: ${r.decision} in ${r.customer_turns} turns (code ${code})`);
  }
}
await writeFile("public/replays/index.json", JSON.stringify(index, null, 1));
