import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I: easy to read aloud

export function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export const newCheckId = () => `chk_${randomCode(10)}`;
export const newSignalId = () => `sig_${randomCode(8)}`;
export const newReportId = () => `rpt_${randomCode(10)}`;
export const newSecret = () => `cs_${randomBytes(18).toString("base64url")}`;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Code words are short, common words that read the same to Hindi and English
 * speakers, plus two digits. The app shows it; the agent says it first, so a
 * caller who cannot see the app cannot pretend to be this check.
 */
export const CODE_WORDS: readonly string[] = [
  "NEEM", "TULSI", "GULAB", "KAMAL", "MOTI", "BADAL", "SURAJ", "TARA", "SAGAR", "NADI",
  "PARVAT", "PEEPAL", "ASHOK", "MOR", "HIRAN", "TOTA", "AAM", "ANAR", "KELA", "JAMUN",
  "CHANDA", "DHOOP", "BARISH", "HAVA", "DIYA", "PATANG", "KESAR", "ELAICHI", "MOGRA", "CHAMPA",
];
const WORDS_HI: Record<string, string> = {
  NEEM: "नीम", TULSI: "तुलसी", GULAB: "गुलाब", KAMAL: "कमल", MOTI: "मोती", BADAL: "बादल", SURAJ: "सूरज",
  TARA: "तारा", SAGAR: "सागर", NADI: "नदी", PARVAT: "पर्वत", PEEPAL: "पीपल", ASHOK: "अशोक", MOR: "मोर",
  HIRAN: "हिरन", TOTA: "तोता", AAM: "आम", ANAR: "अनार", KELA: "केला", JAMUN: "जामुन", CHANDA: "चंदा",
  DHOOP: "धूप", BARISH: "बारिश", HAVA: "हवा", DIYA: "दीया", PATANG: "पतंग", KESAR: "केसर", ELAICHI: "इलायची",
  MOGRA: "मोगरा", CHAMPA: "चंपा",
};

export function newCodeWord(): string {
  const b = randomBytes(2);
  const word = CODE_WORDS[b[0] % CODE_WORDS.length];
  const num = 10 + (b[1] % 90);
  return `${word} ${num}`;
}

export function codeWordHi(code: string): string {
  const [w, n] = code.split(" ");
  return `${WORDS_HI[w] ?? w} ${n ?? ""}`.trim();
}
