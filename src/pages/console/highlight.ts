/**
 * Finds where in a transcript each signal's evidence was said.
 *
 * The agent writes evidence as a short quote or a paraphrase, so an exact search
 * misses most of them. Instead: tokenise both sides (Latin and Devanagari),
 * drop function words, treat words with a long common prefix as the same word
 * ("arrested" ~ "arrest"), then pick the window of each turn that best covers
 * the evidence (F-score that favours recall). Customer turns win ties, because
 * evidence is about what the customer said.
 */

export interface EvidenceSignal {
  id: string;
  severity: string;
  evidence: string;
}

export interface TurnLike {
  role: string;
  text?: string;
}

export interface Range {
  start: number;
  end: number;
  ids: string[];
}

export interface Located {
  turn: number;
  start: number;
  end: number;
  score: number;
}

const WORD_RE = /[\p{L}\p{M}\p{N}']+/gu;

const STOP = new Set(
  (
    "a an the to of and or but is am are was were be been being i me my mine we our you your he him his she her it its they them their this that these those " +
    "on in at for with from by as so just not no yes do did does done have has had will would can could should there here what who when where why how " +
    "um uh oh okay ok like then than also very really about into out up down over now said say says told tell " +
    "है हैं था थी थे हूँ हूं हो का की के को में से पर और भी तो ही ने कि यह वह ये वो मैं मेरा मेरी मेरे हम आप तुम कोई कुछ एक बस अभी जी हाँ हां नहीं ना न रहा रही रहे " +
    "hai hain tha thi the hoon hun ho ka ki ke ko mein me se par aur bhi to hi ne ye wo main mera meri mere hum aap koi kuch ek bas abhi ji haan nahi na raha rahi"
  ).split(/\s+/),
);

interface Tok {
  norm: string;
  start: number;
  end: number;
  content: boolean;
}

function normalize(w: string): string {
  return w
    .normalize("NFC")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/़/g, "") // nukta: ज़ → ज
    .replace(/ँ/g, "ं"); // chandrabindu → anusvara
}

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const norm = normalize(m[0]);
    if (!norm) continue;
    const start = m.index ?? 0;
    out.push({ norm, start, end: start + m[0].length, content: !STOP.has(norm) && [...norm].length > 1 });
  }
  return out;
}

function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const la = [...a];
  const lb = [...b];
  const min = Math.min(la.length, lb.length);
  if (min < 4) return false;
  let p = 0;
  while (p < min && la[p] === lb[p]) p++;
  return p >= Math.max(4, min - 2);
}

/** Best location of one evidence string in the transcript, or null when nothing fits well enough. */
export function locate(evidence: string, turns: TurnLike[]): Located | null {
  const ev = [...new Set(tokenize(evidence).filter((t) => t.content).map((t) => t.norm))];
  if (!ev.length) return null;
  let best: Located | null = null;
  turns.forEach((turn, ti) => {
    if (!turn.text || (turn.role !== "customer" && turn.role !== "agent")) return;
    const toks = tokenize(turn.text);
    // Which evidence words each transcript token matches.
    const hits = toks.map((t) => (t.content ? ev.map((e, ei) => (similar(t.norm, e) ? ei : -1)).filter((x) => x >= 0) : []));
    const roleWeight = turn.role === "customer" ? 1 : 0.82;
    for (let i = 0; i < toks.length; i++) {
      if (!hits[i].length) continue;
      const covered = new Set<number>();
      let contentCount = 0;
      let matched = 0;
      for (let j = i; j < toks.length && j - i < ev.length * 3 + 6; j++) {
        if (toks[j].content) contentCount++;
        if (hits[j].length) {
          matched++;
          hits[j].forEach((h) => covered.add(h));
          const recall = covered.size / ev.length;
          const precision = matched / Math.max(1, contentCount);
          const b2 = 2.25; // beta 1.5: recall matters more than a tight window
          const f = ((1 + b2) * precision * recall) / (b2 * precision + recall);
          const enough = covered.size >= Math.min(2, ev.length) && recall >= 0.3;
          const score = f * roleWeight;
          if (enough && (!best || score > best.score + 1e-9)) best = { turn: ti, start: toks[i].start, end: toks[j].end, score };
        }
      }
    }
  });
  return best;
}

/** Locates every signal, then flattens overlapping hits into non-overlapping ranges per turn. */
export function highlightTranscript(signals: EvidenceSignal[], turns: TurnLike[]) {
  const found = new Map<string, Located>();
  for (const s of signals) {
    const hit = locate(s.evidence, turns);
    if (hit) found.set(s.id, hit);
  }
  const byTurn = new Map<number, Range[]>();
  const perTurn = new Map<number, { start: number; end: number; id: string }[]>();
  for (const [id, h] of found) {
    const list = perTurn.get(h.turn) ?? [];
    list.push({ start: h.start, end: h.end, id });
    perTurn.set(h.turn, list);
  }
  for (const [ti, list] of perTurn) {
    const cuts = [...new Set(list.flatMap((r) => [r.start, r.end]))].sort((a, b) => a - b);
    const ranges: Range[] = [];
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k];
      const b = cuts[k + 1];
      const ids = list.filter((r) => r.start <= a && r.end >= b).map((r) => r.id);
      if (!ids.length) continue;
      const prev = ranges[ranges.length - 1];
      if (prev && prev.end === a && prev.ids.join() === ids.join()) prev.end = b;
      else ranges.push({ start: a, end: b, ids });
    }
    byTurn.set(ti, ranges);
  }
  return { found, byTurn };
}
