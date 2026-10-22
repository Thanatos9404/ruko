import type { Lang } from "./types.js";

/** ₹ with Indian digit grouping: 190000 → "₹1,90,000". */
export function formatINR(amount: number): string {
  const neg = amount < 0;
  const s = Math.round(Math.abs(amount)).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${neg ? "-" : ""}₹${grouped}`;
}

/**
 * Amount phrased for speech in the Indian numbering system, using digits for the
 * counts so any TTS voice reads it naturally: 190000 → "1 lakh 90 thousand rupees".
 */
export function amountForSpeech(amount: number, lang: Lang): string {
  const n = Math.round(amount);
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const rest = n % 1000;
  const units =
    lang === "hi"
      ? { crore: "करोड़", lakh: "लाख", thousand: "हज़ार", rupees: "रुपये" }
      : { crore: "crore", lakh: "lakh", thousand: "thousand", rupees: "rupees" };
  const parts: string[] = [];
  if (crore) parts.push(`${crore} ${units.crore}`);
  if (lakh) parts.push(`${lakh} ${units.lakh}`);
  if (thousand) parts.push(`${thousand} ${units.thousand}`);
  if (rest || parts.length === 0) parts.push(String(rest));
  return `${parts.join(" ")} ${units.rupees}`;
}

/** +919876543210 → "+91 •••• ••3210". */
export function maskPhone(e164?: string): string {
  if (!e164) return "";
  const digits = e164.replace(/[^\d+]/g, "");
  if (digits.length < 6) return "••••";
  return `${digits.slice(0, 3)} •••• ••${digits.slice(-4)}`;
}

export function minutesLabel(min?: number): string {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h === 1 ? "1 hour" : `${h} hours`;
}

const RELATION_HI: Record<string, string> = {
  son: "बेटा",
  daughter: "बेटी",
  brother: "भाई",
  sister: "बहन",
  husband: "पति",
  wife: "पत्नी",
  father: "पिता",
  mother: "माँ",
  friend: "दोस्त",
  nephew: "भतीजा",
  niece: "भतीजी",
  cousin: "कज़िन",
  uncle: "चाचा",
  aunt: "चाची",
  grandson: "पोता",
  granddaughter: "पोती",
  "son-in-law": "दामाद",
  "daughter-in-law": "बहू",
  neighbour: "पड़ोसी",
  neighbor: "पड़ोसी",
};

/** A trusted contact's relation in the call language ("son" → "बेटा"); unknown ones pass through. */
export function relationFor(relation: string, lang: Lang): string {
  if (lang !== "hi") return relation;
  return RELATION_HI[relation.trim().toLowerCase()] ?? relation;
}

const YOUR_RELATION_HI: Record<string, string> = {
  son: "आपके बेटे",
  daughter: "आपकी बेटी",
  brother: "आपके भाई",
  sister: "आपकी बहन",
  husband: "आपके पति",
  wife: "आपकी पत्नी",
  father: "आपके पिता",
  mother: "आपकी माँ",
  friend: "आपके दोस्त",
  nephew: "आपके भतीजे",
  niece: "आपकी भतीजी",
  cousin: "आपके कज़िन",
  uncle: "आपके चाचा",
  aunt: "आपकी चाची",
  grandson: "आपके पोते",
  granddaughter: "आपकी पोती",
  "son-in-law": "आपके दामाद",
  "daughter-in-law": "आपकी बहू",
  neighbour: "आपके पड़ोसी",
  neighbor: "आपके पड़ोसी",
};

/** "your son" in Hindi, in the oblique form a sentence like "… को कॉल करूँ" needs ("आपके बेटे"). */
export function yourRelationHi(relation: string): string {
  return YOUR_RELATION_HI[relation.trim().toLowerCase()] ?? `आपके ${relation}`;
}
