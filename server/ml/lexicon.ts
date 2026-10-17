/**
 * Explainable cue-lexicon scorer.
 *
 * Matches the pattern library's cue phrases (English, Hindi, Hinglish, plus
 * coaching phrases) and the cross-pattern signal cues on normalised tokens, so
 * spelling, case, punctuation, digits and PII never matter. Every hit carries
 * the character span in the ORIGINAL text, so the console can highlight it.
 *
 * Negation: a hit is marked `negated` (and scores nothing) when a negator
 * ("not", "never", "nahi", "mat", "नहीं" ...) appears within 3 tokens before
 * or after the phrase and is not part of the phrase itself. This handles
 * "they did NOT ask for my OTP" and "OTP नहीं माँगा", at the cost of some
 * misses ("nahi to arrest ho jaoge" reads as negated).
 *
 * Inflection: the last token of a phrase also matches longer words that start
 * with it when it is at least 4 characters ("arrest" ~ "arrested",
 * "giraftar" ~ "giraftari").
 */
import { tokenize, type Token } from "./featurize.js";
import type { LibraryPattern, SignalCues } from "./library.js";

export interface CueHit {
  /** The cue phrase as written in the library. */
  phrase: string;
  lang: string;
  kind: "cue" | "coaching" | "signal";
  /** UTF-16 offsets into the original text. */
  start: number;
  end: number;
  negated: boolean;
}

export interface LexiconOwnerResult {
  id: string;
  score: number;
  hits: CueHit[];
}

interface Spec {
  owner: string;
  phrase: string;
  lang: string;
  kind: CueHit["kind"];
  toks: string[];
  weight: number;
}

const WINDOW = 3;
const PREFIX_MIN = 4;

function specWeight(kind: Spec["kind"], n: number): number {
  const base = kind === "coaching" ? 1.5 : 1;
  return base + Math.min(1, 0.25 * (n - 1));
}

export class Lexicon {
  private patternIndex = new Map<string, Spec[]>();
  private signalIndex = new Map<string, Spec[]>();
  private negators = new Set<string>();
  readonly patternIds: string[] = [];

  constructor(patterns: LibraryPattern[], signalCues: SignalCues | null) {
    for (const p of patterns) {
      this.patternIds.push(p.id);
      const seen = new Set<string>();
      const add = (phrase: string, lang: string, kind: Spec["kind"]) => {
        const toks = tokenize(phrase).map((t) => t.text);
        const key = toks.join(" ");
        if (!toks.length || seen.has(key)) return;
        // single very short tokens ("ed", "rs") are too ambiguous to be cues
        if (toks.length === 1 && toks[0].length < 3) return;
        seen.add(key);
        this.addSpec(this.patternIndex, { owner: p.id, phrase, lang, kind, toks, weight: specWeight(kind, toks.length) });
      };
      for (const [lang, list] of Object.entries(p.cues)) for (const c of list ?? []) add(c, lang, "cue");
      for (const [lang, list] of Object.entries(p.coaching_phrases)) for (const c of list ?? []) add(c, lang, "coaching");
    }
    if (signalCues) {
      for (const [type, langs] of Object.entries(signalCues.signals)) {
        for (const [lang, list] of Object.entries(langs)) {
          for (const c of list ?? []) {
            const toks = tokenize(c).map((t) => t.text);
            if (!toks.length) continue;
            this.addSpec(this.signalIndex, { owner: type, phrase: c, lang, kind: "signal", toks, weight: 1 });
          }
        }
      }
      for (const list of Object.values(signalCues.negators)) {
        for (const n of list ?? []) for (const t of tokenize(n)) this.negators.add(t.text);
      }
    }
  }

  private addSpec(index: Map<string, Spec[]>, s: Spec) {
    // Single-token cues may match by prefix, so index them under their first PREFIX_MIN chars too.
    const keys = [s.toks[0]];
    if (s.toks.length === 1 && [...s.toks[0]].length >= PREFIX_MIN) keys.push("~" + [...s.toks[0]].slice(0, PREFIX_MIN).join(""));
    for (const k of keys) {
      const arr = index.get(k);
      if (arr) arr.push(s);
      else index.set(k, [s]);
    }
  }

  private match(index: Map<string, Spec[]>, toks: Token[]): Map<string, CueHit[]> {
    const out = new Map<string, CueHit[]>();
    const texts = toks.map((t) => t.text);
    for (let i = 0; i < toks.length; i++) {
      const cands = new Set<Spec>(index.get(texts[i]) ?? []);
      const cps = [...texts[i]];
      if (cps.length >= PREFIX_MIN) for (const s of index.get("~" + cps.slice(0, PREFIX_MIN).join("")) ?? []) cands.add(s);
      for (const s of cands) {
        const n = s.toks.length;
        if (i + n > toks.length) continue;
        let ok = true;
        for (let k = 0; k < n && ok; k++) {
          const want = s.toks[k];
          const got = texts[i + k];
          if (got === want) continue;
          ok = k === n - 1 && [...want].length >= PREFIX_MIN && got.startsWith(want);
        }
        if (!ok) continue;
        const negated = this.isNegated(texts, i, i + n);
        const hit: CueHit = { phrase: s.phrase, lang: s.lang, kind: s.kind, start: toks[i].start, end: toks[i + n - 1].end, negated };
        const arr = out.get(s.owner);
        if (arr) arr.push(hit);
        else out.set(s.owner, [hit]);
      }
    }
    return out;
  }

  private isNegated(texts: string[], from: number, to: number): boolean {
    for (let j = Math.max(0, from - WINDOW); j < from; j++) if (this.negators.has(texts[j])) return true;
    for (let j = to; j < Math.min(texts.length, to + WINDOW); j++) if (this.negators.has(texts[j])) return true;
    return false;
  }

  private static score(hits: CueHit[]): number {
    // each distinct phrase counts once; negated hits count zero
    const seen = new Set<string>();
    let score = 0;
    for (const h of hits) {
      if (h.negated || seen.has(h.phrase)) continue;
      seen.add(h.phrase);
      const toks = tokenize(h.phrase).length;
      score += specWeight(h.kind === "coaching" ? "coaching" : "cue", toks);
    }
    return score;
  }

  /** Pattern candidates ranked by cue score (highest first); patterns with no live hit are omitted. */
  scorePatterns(text: string, toks: Token[] = tokenize(text)): LexiconOwnerResult[] {
    const m = this.match(this.patternIndex, toks);
    return [...m.entries()]
      .map(([id, hits]) => ({ id, hits: dedupe(hits), score: Lexicon.score(hits) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  /** Signal types (shared/signals.ts) suggested by cue phrases, with spans. */
  scoreSignals(text: string, toks: Token[] = tokenize(text)): LexiconOwnerResult[] {
    const m = this.match(this.signalIndex, toks);
    return [...m.entries()]
      .map(([id, hits]) => ({ id, hits: dedupe(hits), score: Lexicon.score(hits) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }
}

/** Keeps the longest hit when phrases overlap the same span start. */
function dedupe(hits: CueHit[]): CueHit[] {
  const byStart = new Map<number, CueHit>();
  for (const h of hits) {
    const cur = byStart.get(h.start);
    if (!cur || h.end - h.start > cur.end - cur.start) byStart.set(h.start, h);
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}
