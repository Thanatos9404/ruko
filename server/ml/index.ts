/**
 * Ruko text intelligence: one call that tells the engine, the voice agent and
 * the console what a piece of text looks like.
 *
 *   analyzeText("मुझे CBI वाले ने वीडियो कॉल पर रखा, कहा किसी को मत बताना")
 *
 * returns a calibrated scam probability (when the model is available), the
 * most likely scam patterns, cue phrases and call signals with character spans
 * for highlighting, and per-token evidence from the model.
 *
 * Fallback: if the model file is missing, corrupt or fails its checksum, the
 * function still answers from the cue lexicon alone (mode "lexicon_only",
 * scam_probability null). If the library is missing too, it returns an empty
 * "none" result rather than throwing. It never logs the input text.
 *
 * This is advisory evidence for Ruko's deterministic decision policy. It must
 * never release or block a payment on its own.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./featurize.js";
import { Lexicon, type CueHit } from "./lexicon.js";
import { getLibrary, getSignalCues, libraryPattern, type PatternLibrary } from "./library.js";
import { TextModel, type Band, type Evidence, type ModelArtifact } from "./model.js";

export type { CueHit } from "./lexicon.js";
export type { Evidence, Band } from "./model.js";
export { configureLibrary, getLibrary, getSignalCues, getSources, libraryPattern, pick, resetLibrary } from "./library.js";

export const MODEL_FILE = "ruko-text-v1.json";
/** Inputs longer than this are cut (first N UTF-16 units) to bound latency. */
export const MAX_CHARS = 5000;

export interface PatternCandidate {
  id: string;
  name: string;
  category: string | null;
  /** P(pattern | scam) from the model; null in lexicon-only mode or for patterns the model has no class for. */
  p_given_scam: number | null;
  lexicon_score: number;
  cues: CueHit[];
}

export interface TextAnalysis {
  engine: {
    mode: "model+lexicon" | "lexicon_only" | "none";
    model_version: string | null;
    library_version: string | null;
    model_error?: string;
  };
  /** Calibrated P(scam); null when the model is unavailable. */
  scam_probability: number | null;
  band: Band | "unknown";
  patterns: PatternCandidate[];
  /** Call signals (shared/signals.ts types) suggested by cue phrases. Suggestions only. */
  signals: { type: string; hits: CueHit[] }[];
  evidence: Evidence[];
  counter_evidence: Evidence[];
  pattern_evidence: Evidence[];
  top_features: { feature: string; contribution: number }[];
  truncated: boolean;
  latency_ms: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));

interface State {
  model: TextModel | null;
  modelError?: string;
  lexicon: Lexicon | null;
  library: PatternLibrary | null;
}

let state: State | null = null;
let injectedModel: ModelArtifact | null | undefined;

/** Override the model (tests, or callers that bundle the JSON themselves). Pass null to force lexicon-only mode. */
export function configureModel(model: ModelArtifact | null | undefined): void {
  injectedModel = model;
  state = null;
}

/** Drops cached state so the next call reloads files (tests). */
export function resetMl(): void {
  state = null;
}

function locateModel(): string | null {
  const env = process.env.RUKO_ML_MODEL_PATH;
  const cands = [env, join(HERE, "model", MODEL_FILE), join(process.cwd(), "server", "ml", "model", MODEL_FILE), resolve(HERE, "../../server/ml/model", MODEL_FILE)];
  for (const c of cands) if (c && existsSync(c)) return c;
  return null;
}

/** Loads the model file and checks it against its .sha256 sidecar when present. */
export function loadModelFile(path: string): ModelArtifact {
  const buf = readFileSync(path);
  const sidecar = path + ".sha256";
  if (existsSync(sidecar)) {
    const want = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0].toLowerCase();
    const got = createHash("sha256").update(buf).digest("hex");
    if (want !== got) throw new Error("model checksum mismatch");
  }
  return JSON.parse(buf.toString("utf8")) as ModelArtifact;
}

function init(): State {
  if (state) return state;
  const library = getLibrary();
  const lexicon = library ? new Lexicon(library.patterns, getSignalCues()) : null;
  let model: TextModel | null = null;
  let modelError: string | undefined;
  try {
    if (injectedModel === null) modelError = "disabled";
    else if (injectedModel) model = new TextModel(injectedModel);
    else {
      const p = locateModel();
      if (!p) modelError = "model file not found";
      else model = new TextModel(loadModelFile(p));
    }
  } catch (e) {
    model = null;
    modelError = e instanceof Error ? e.message : "model failed to load";
  }
  state = { model, modelError, lexicon, library };
  return state;
}

export function mlStatus() {
  const s = init();
  return {
    mode: s.model ? "model+lexicon" : s.lexicon ? "lexicon_only" : "none",
    model_version: s.model?.version ?? null,
    model_error: s.modelError,
    library_version: s.library?.version ?? null,
    patterns: s.library?.patterns.length ?? 0,
  };
}

const CRITICAL = new Set(["coached_on_call", "authority_threat", "secrecy_demand", "remote_access"]);
const MITIGATING = new Set(["knows_payee", "verified_independently", "own_initiative"]);

/**
 * Lexicon-only banding used when the model is unavailable: points from the
 * best pattern's cue score plus live (non-negated) signal cues.
 */
function lexiconBand(topScore: number, signals: { type: string; hits: CueHit[] }[]): Band {
  let pts = topScore;
  for (const s of signals) {
    const live = s.hits.some((h) => !h.negated);
    if (!live) continue;
    if (CRITICAL.has(s.type)) pts += 1.5;
    else if (MITIGATING.has(s.type)) pts -= 1;
    else pts += 0.75;
  }
  return pts >= 4 ? "likely_scam" : pts >= 2 ? "possible_scam" : "unlikely_scam";
}

export function analyzeText(input: string, opts: { topK?: number; explain?: boolean } = {}): TextAnalysis {
  const t0 = performance.now();
  const s = init();
  const truncated = input.length > MAX_CHARS;
  const text = truncated ? input.slice(0, MAX_CHARS) : input;
  const topK = opts.topK ?? 3;
  const toks = tokenize(text);

  const lexPatterns = s.lexicon ? s.lexicon.scorePatterns(text, toks) : [];
  const signals = s.lexicon ? s.lexicon.scoreSignals(text, toks).map((r) => ({ type: r.id, hits: r.hits })) : [];
  const lexById = new Map(lexPatterns.map((r) => [r.id, r]));

  const describe = (id: string, p: number | null): PatternCandidate => {
    const lp = libraryPattern(id);
    const lx = lexById.get(lp?.id ?? id);
    return {
      id: lp?.id ?? id,
      name: lp?.name.en ?? id,
      category: lp?.category ?? null,
      p_given_scam: p,
      lexicon_score: lx?.score ?? 0,
      cues: lx?.hits ?? [],
    };
  };

  const base = {
    engine: {
      mode: (s.model ? "model+lexicon" : s.lexicon ? "lexicon_only" : "none") as TextAnalysis["engine"]["mode"],
      model_version: s.model?.version ?? null,
      library_version: s.library?.version ?? null,
      ...(s.modelError ? { model_error: s.modelError } : {}),
    },
    signals,
    truncated,
  };

  if (s.model) {
    const pred = s.model.predict(text, { topK: Math.max(topK, 5), explain: opts.explain, tokens: toks });
    // Light fusion: strong cue matches can reorder near-ties, never outweigh the model.
    const fused = pred.patterns
      .map((c) => ({ c, score: c.p_given_scam + 0.05 * Math.min(4, lexById.get(c.id)?.score ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ c }) => describe(c.id, c.p_given_scam));
    return {
      ...base,
      scam_probability: pred.p_scam,
      band: pred.band,
      patterns: fused,
      evidence: pred.evidence,
      counter_evidence: pred.counter_evidence,
      pattern_evidence: pred.pattern_evidence,
      top_features: pred.top_features,
      latency_ms: performance.now() - t0,
    };
  }

  return {
    ...base,
    scam_probability: null,
    band: s.lexicon ? lexiconBand(lexPatterns[0]?.score ?? 0, signals) : "unknown",
    patterns: lexPatterns.slice(0, topK).map((r) => describe(r.id, null)),
    evidence: [],
    counter_evidence: [],
    pattern_evidence: [],
    top_features: [],
    latency_ms: performance.now() - t0,
  };
}
