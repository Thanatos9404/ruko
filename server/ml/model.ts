/**
 * Inference over Ruko's exported text model (JSON, produced by ml/train.py).
 *
 * Two heads share one TF-IDF feature space:
 *  - binary: calibrated logistic regression, P(scam | text)
 *  - patterns: softmax regression over scam patterns, P(pattern | text, scam),
 *    with temperature scaling
 * Weights are stored as integers (value * weight_scale). Pattern weights are
 * sparse triples [feature, class, weight] for compactness.
 *
 * Explanations attribute each feature's contribution back to the token(s) it
 * came from, so the console can highlight words in the original text.
 */
import { featuresFromTokens, tokenize, FEATURIZER_VERSION, type Token } from "./featurize.js";

export interface ModelArtifact {
  format: "ruko-text-model";
  format_version: 1;
  model_version: string;
  featurizer_version: number;
  created: string;
  training_data_sha256?: string;
  weight_scale: number;
  vocab: string[];
  idf: number[];
  binary: {
    w: number[];
    b: number;
    calibration: { a: number; b: number };
    thresholds: { likely_scam: number; possible_scam: number };
  };
  patterns: { classes: string[]; b: number[]; w: number[]; temperature: number };
  metrics_summary?: Record<string, unknown>;
}

export type Band = "likely_scam" | "possible_scam" | "unlikely_scam";

export interface Evidence {
  /** UTF-16 span in the original text. */
  start: number;
  end: number;
  /** Normalised token text (placeholders like "xphone" for redacted PII; never the raw value). */
  token: string;
  /** Contribution to the logit (positive = towards scam / towards the pattern). */
  weight: number;
}

export interface ModelPrediction {
  p_scam: number;
  logit: number;
  band: Band;
  patterns: { id: string; p_given_scam: number }[];
  evidence: Evidence[];
  counter_evidence: Evidence[];
  pattern_evidence: Evidence[];
  top_features: { feature: string; contribution: number }[];
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

export class TextModel {
  readonly version: string;
  private index = new Map<string, number>();
  private idf: Float64Array;
  private bw: Float64Array;
  private classes: string[];
  private pb: Float64Array;
  // CSR layout of the sparse pattern weights: rows = features
  private rowStart: Int32Array;
  private colCls: Int32Array;
  private colW: Float64Array;

  constructor(private art: ModelArtifact) {
    if (art.format !== "ruko-text-model" || art.format_version !== 1) throw new Error("unsupported model format");
    if (art.featurizer_version !== FEATURIZER_VERSION)
      throw new Error(`model needs featurizer v${art.featurizer_version}, runtime is v${FEATURIZER_VERSION}`);
    const V = art.vocab.length;
    if (art.idf.length !== V || art.binary.w.length !== V) throw new Error("model arrays have inconsistent lengths");
    this.version = art.model_version;
    art.vocab.forEach((f, i) => this.index.set(f, i));
    const s = art.weight_scale;
    this.idf = Float64Array.from(art.idf);
    this.bw = Float64Array.from(art.binary.w, (w) => w / s);
    this.classes = art.patterns.classes;
    this.pb = Float64Array.from(art.patterns.b);
    const flat = art.patterns.w;
    const n = flat.length / 3;
    const counts = new Int32Array(V + 1);
    for (let k = 0; k < n; k++) counts[flat[3 * k] + 1]++;
    for (let j = 0; j < V; j++) counts[j + 1] += counts[j];
    this.rowStart = counts.slice();
    this.colCls = new Int32Array(n);
    this.colW = new Float64Array(n);
    const fill = counts.slice();
    for (let k = 0; k < n; k++) {
      const j = flat[3 * k];
      const pos = fill[j]++;
      this.colCls[pos] = flat[3 * k + 1];
      this.colW[pos] = flat[3 * k + 2] / s;
    }
  }

  get thresholds() {
    return this.art.binary.thresholds;
  }

  get patternClasses(): readonly string[] {
    return this.classes;
  }

  predict(text: string, opts: { topK?: number; explain?: boolean; tokens?: Token[] } = {}): ModelPrediction {
    const topK = opts.topK ?? 3;
    const toks = opts.tokens ?? tokenize(text);
    const hits = featuresFromTokens(toks.map((t) => t.text));

    // term counts over known features, remembering where each came from
    const counts = new Map<number, number>();
    const featHits: { j: number; tok: number; tok2?: number }[] = [];
    for (const h of hits) {
      const j = this.index.get(h.f);
      if (j === undefined) continue;
      counts.set(j, (counts.get(j) ?? 0) + 1);
      featHits.push({ j, tok: h.tok, tok2: h.tok2 });
    }
    const x = new Map<number, number>();
    let norm = 0;
    for (const [j, c] of counts) {
      const v = (1 + Math.log(c)) * this.idf[j];
      x.set(j, v);
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [j, v] of x) x.set(j, v / norm);

    // binary head
    let z = this.art.binary.b;
    for (const [j, v] of x) z += v * this.bw[j];
    const cal = this.art.binary.calibration;
    const p = sigmoid(cal.a * z + cal.b);
    const th = this.art.binary.thresholds;
    const band: Band = p >= th.likely_scam ? "likely_scam" : p >= th.possible_scam ? "possible_scam" : "unlikely_scam";

    // pattern head
    const logits = Float64Array.from(this.pb);
    for (const [j, v] of x) {
      for (let k = this.rowStart[j]; k < this.rowStart[j + 1]; k++) logits[this.colCls[k]] += v * this.colW[k];
    }
    const T = this.art.patterns.temperature;
    let m = -Infinity;
    for (const l of logits) m = Math.max(m, l);
    let sum = 0;
    const ex = Array.from(logits, (l) => {
      const e = Math.exp((l - m) / T);
      sum += e;
      return e;
    });
    const ranked = ex
      .map((e, i) => ({ id: this.classes[i], p_given_scam: e / sum, i }))
      .sort((a, b) => b.p_given_scam - a.p_given_scam);
    const patterns = ranked.slice(0, topK).map(({ id, p_given_scam }) => ({ id, p_given_scam }));

    if (opts.explain === false) {
      return { p_scam: p, logit: z, band, patterns, evidence: [], counter_evidence: [], pattern_evidence: [], top_features: [] };
    }

    // attribution: feature contribution split over its occurrences, then onto tokens
    const topCls = ranked[0]?.i ?? -1;
    const tokB = new Float64Array(toks.length);
    const tokP = new Float64Array(toks.length);
    const featContrib: { j: number; c: number }[] = [];
    const pw = (j: number) => {
      for (let k = this.rowStart[j]; k < this.rowStart[j + 1]; k++) if (this.colCls[k] === topCls) return this.colW[k];
      return 0;
    };
    for (const [j, v] of x) featContrib.push({ j, c: v * this.bw[j] });
    for (const fh of featHits) {
      const c = counts.get(fh.j)!;
      const v = x.get(fh.j)!;
      const cb = (v * this.bw[fh.j]) / c;
      const cp = (v * pw(fh.j)) / c;
      if (fh.tok2 !== undefined) {
        tokB[fh.tok] += cb / 2;
        tokB[fh.tok2] += cb / 2;
        tokP[fh.tok] += cp / 2;
        tokP[fh.tok2] += cp / 2;
      } else {
        tokB[fh.tok] += cb;
        tokP[fh.tok] += cp;
      }
    }
    const ev = (arr: Float64Array, sign: 1 | -1, n: number): Evidence[] =>
      Array.from(arr, (w, i) => ({ start: toks[i].start, end: toks[i].end, token: toks[i].text, weight: round(w) }))
        .filter((e) => sign * e.weight > 0.005)
        .sort((a, b) => sign * (b.weight - a.weight))
        .slice(0, n);
    const top_features = featContrib
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
      .slice(0, 12)
      .map(({ j, c }) => ({ feature: this.art.vocab[j], contribution: round(c) }));
    return {
      p_scam: p,
      logit: z,
      band,
      patterns,
      evidence: ev(tokB, 1, 10),
      counter_evidence: ev(tokB, -1, 6),
      pattern_evidence: ev(tokP, 1, 8),
      top_features,
    };
  }
}

const round = (v: number) => Math.round(v * 10000) / 10000;
