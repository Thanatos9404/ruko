/**
 * Ruko text featurizer (TypeScript runtime). Mirrors ml/ruko_text.py exactly;
 * server/ml/__tests__/parity.test.ts checks both sides agree on golden inputs.
 *
 * 1. PII is redacted on the original text with ASCII-only regexes: APK file
 *    names, URLs, UPI IDs / e-mails, phone numbers, card and account numbers.
 *    Each match becomes one placeholder token (xapk, xurl, xhandle, xphone, xnum),
 *    so raw numbers and handles never reach features, logs or explanations.
 * 2. Other characters are normalised one at a time: NFKC, lower-case, nukta
 *    dropped and chandrabindu -> anusvara (Devanagari, Bengali), any decimal
 *    digit -> "0", format characters (ZWJ/ZWNJ) dropped, letters, marks and
 *    numbers kept, everything else breaks a token. "₹" becomes "rs".
 * 3. Features: word unigrams (w:), word bigrams (b:), char 2..5-grams inside
 *    each space-padded token (c:). Since v2 the link, handle, phone and account
 *    placeholders produce no features (NO_FEATURE).
 */

export const FEATURIZER_VERSION = 2;
const CHAR_N_MIN = 2;
const CHAR_N_MAX = 5;

const TLDS =
  "com|in|net|org|info|xyz|top|online|site|link|ly|co|me|app|io|cc|biz|live|" +
  "shop|club|vip|pro|icu|tk|ml|ga|cf|gq|gov|ac|edu|page|store|cloud|today";

/** Same order and patterns as REDACTIONS in ml/ruko_text.py. Earlier rules win. */
const REDACTIONS: [tag: string, source: string][] = [
  ["xapk", String.raw`[A-Za-z0-9_\-.]*[A-Za-z0-9_\-]\.[Aa][Pp][Kk](?![A-Za-z0-9])`],
  ["xurl", String.raw`(?:[Hh][Tt][Tt][Pp][Ss]?://|[Ww][Ww][Ww]\.)[^ \t\r\n]+`],
  ["xhandle", String.raw`[A-Za-z0-9][A-Za-z0-9._\-]*@[A-Za-z][A-Za-z0-9.\-]*[A-Za-z0-9]`],
  [
    "xurl",
    String.raw`(?<![A-Za-z0-9@.\-])[A-Za-z0-9][A-Za-z0-9\-]*(?:\.[A-Za-z0-9\-]+)*\.(?:` +
      TLDS +
      String.raw`)(?![A-Za-z0-9\-])(?:/[^ \t\r\n]*)?`,
  ],
  ["xnum", String.raw`(?<![0-9])[0-9]{4}(?:[ \-][0-9]{4}){3}(?![0-9])`],
  ["xphone", String.raw`(?<![0-9])(?:\+?91[ \-]?|0)?[6-9][0-9]{4}[ \-]?[0-9]{5}(?![0-9])`],
  ["xphone", String.raw`\+[0-9][0-9 \-]{7,}[0-9]`],
  ["xnum", String.raw`(?<![0-9])[0-9]{9,}(?![0-9])`],
  ["xnum", String.raw`(?<![0-9])[0-9]{4} [0-9]{4} [0-9]{4}(?![0-9])`],
];

export const PLACEHOLDERS = new Set(["xapk", "xurl", "xhandle", "xphone", "xnum"]);

export interface Token {
  text: string;
  /** Offsets into the original string, in UTF-16 code units (usable with String.slice). */
  start: number;
  end: number;
}

function redactionSpans(text: string): [number, number, string][] {
  const taken: [number, number, string][] = [];
  for (const [tag, src] of REDACTIONS) {
    const rx = new RegExp(src, "g");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (e <= s) {
        rx.lastIndex = s + 1;
        continue;
      }
      if (taken.some(([ts, te]) => s < te && ts < e)) continue;
      taken.push([s, e, tag]);
    }
  }
  taken.sort((a, b) => a[0] - b[0]);
  return taken;
}

const RX_ND = /^\p{Nd}$/u;
const RX_LMN = /^[\p{L}\p{M}\p{N}]$/u;
const RX_CF = /^\p{Cf}$/u;

/** Nukta (Devanagari, Bengali) is often omitted when typing; chandrabindu is often typed as anusvara. */
const DROP = new Set(["़", "়"]);
const MAP: Record<string, string> = { "ँ": "ं", "ঁ": "ং" };

function normChar(ch: string): string {
  let out = "";
  for (const raw of ch.normalize("NFKC").toLowerCase()) {
    if (DROP.has(raw)) continue;
    const c = MAP[raw] ?? raw;
    if (c === "₹") out += " rs ";
    else if (RX_ND.test(c)) out += "0";
    else if (RX_LMN.test(c)) out += c;
    else if (RX_CF.test(c)) continue;
    else out += " ";
  }
  return out;
}

export function tokenize(text: string): Token[] {
  const spans = redactionSpans(text);
  const tokens: Token[] = [];
  let cur = "";
  let curStart = -1;
  let lastEnd = -1;
  const flush = () => {
    if (cur) tokens.push({ text: cur, start: curStart, end: lastEnd });
    cur = "";
    curStart = -1;
  };
  let i = 0;
  let si = 0;
  const n = text.length;
  while (i < n) {
    if (si < spans.length && spans[si][0] === i) {
      flush();
      const [s, e, tag] = spans[si];
      tokens.push({ text: tag, start: s, end: e });
      i = e;
      si++;
      continue;
    }
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const piece = normChar(ch);
    for (const c of piece) {
      if (c === " ") flush();
      else {
        if (curStart < 0) curStart = i;
        cur += c;
        lastEnd = i + ch.length;
      }
    }
    if (piece === "" && cur) lastEnd = i + ch.length;
    i += ch.length;
  }
  flush();
  return tokens;
}

export function normalize(text: string): string {
  return tokenize(text)
    .map((t) => t.text)
    .join(" ");
}

/** A feature string plus the index of the token(s) it came from (for explanations). */
export interface FeatureHit {
  f: string;
  tok: number;
  /** Second token for bigrams. */
  tok2?: number;
}

/**
 * v2: redacted links, handles, phone and account numbers produce no features. Genuine bank alerts,
 * OTPs and bills carry them too, and in synthetic data their frequency mostly reflects how the
 * generator was prompted. APK file names (xapk) still count.
 */
export const NO_FEATURE = new Set(["xurl", "xhandle", "xphone", "xnum"]);

export function featuresFromTokens(toks: string[]): FeatureHit[] {
  const out: FeatureHit[] = [];
  for (let i = 0; i < toks.length; i++) if (!NO_FEATURE.has(toks[i])) out.push({ f: "w:" + toks[i], tok: i });
  for (let i = 0; i + 1 < toks.length; i++)
    if (!NO_FEATURE.has(toks[i]) && !NO_FEATURE.has(toks[i + 1])) out.push({ f: "b:" + toks[i] + "_" + toks[i + 1], tok: i, tok2: i + 1 });
  for (let t = 0; t < toks.length; t++) {
    if (NO_FEATURE.has(toks[t])) continue;
    const chars = [" ", ...Array.from(toks[t]), " "];
    const L = chars.length;
    for (let n = CHAR_N_MIN; n <= CHAR_N_MAX; n++) {
      for (let i = 0; i + n <= L; i++) out.push({ f: "c:" + chars.slice(i, i + n).join(""), tok: t });
    }
  }
  return out;
}

/** Feature strings only, in the same order as the Python analyzer. */
export function analyze(text: string): string[] {
  return featuresFromTokens(tokenize(text).map((t) => t.text)).map((h) => h.f);
}
