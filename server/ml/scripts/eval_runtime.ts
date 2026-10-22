/**
 * Measures the TypeScript runtime on the held-out sets in ml/work/dataset.jsonl:
 *  - latency per analyzeText() call (full pipeline: tokenise, model, lexicon, explanations)
 *  - cold-start load time and model size
 *  - lexicon-only fallback quality (the mode used when the model file is missing)
 *  - fused pattern ranking (model + light cue boost) vs model-only
 *
 *   npx tsx server/ml/scripts/eval_runtime.ts
 * Writes ml/results/runtime_ts.json. Never prints input text.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { analyzeText, configureModel, loadModelFile, mlStatus, resetMl, MODEL_FILE } from "../index.js";
import { getLibrary } from "../library.js";

interface Row {
  id: string;
  text: string;
  label: "scam" | "genuine";
  pattern: string | null;
  split: string;
  source: string;
  lang: string;
  kind: string;
}

const ROOT = process.cwd();
const rows: Row[] = readFileSync(join(ROOT, "ml/work/dataset.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const SETS: Record<string, (r: Row) => boolean> = {
  test_synthetic_A: (r) => r.split === "test" && r.source === "synthetic",
  test_genB_cross_generator: (r) => r.split === "test_genB",
  ood_realworld_curated: (r) => r.split === "ood_realworld",
  ood_ridham115_indian_sms: (r) => r.split === "ood_ridham",
  test_mendeley_real_sms: (r) => r.split === "test" && r.source === "mendeley_sms",
  ood_imc25_real_smishing_india: (r) => r.split === "ood_imc25_india",
  ood_flowxai_en: (r) => r.split === "ood_flowxai",
  ood_skyaara_genuine_payment_sms: (r) => r.split === "ood_skyaara",
};

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const r4 = (v: number) => Math.round(v * 10000) / 10000;

// ---- cold start ----
const modelPath = join(ROOT, "server/ml/model", MODEL_FILE);
const t0 = performance.now();
resetMl();
const status = mlStatus();
const coldMs = performance.now() - t0;

// ---- latency ----
const latSet = rows.filter(SETS.test_synthetic_A).slice(0, 1000);
for (const r of latSet.slice(0, 50)) analyzeText(r.text); // warm-up
const lat: number[] = [];
for (const r of latSet) {
  const a = performance.now();
  analyzeText(r.text);
  lat.push(performance.now() - a);
}
const short = rows.filter((r) => r.text.length <= 300).slice(0, 1000);
const latShort: number[] = [];
for (const r of short) {
  const a = performance.now();
  analyzeText(r.text);
  latShort.push(performance.now() - a);
}

// ---- quality: model+lexicon fused ranking and lexicon-only fallback ----
/**
 * "fused": the model's band, raised from unlikely to possible when the cue lexicon alone says likely_scam
 * (strong pattern cues plus live call-signal cues). Evaluated here before any decision to ship it.
 */
function quality(mode: "model" | "lexicon" | "fused") {
  configureModel(mode === "lexicon" ? null : loadModelFile(modelPath));
  const out: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(SETS)) {
    const set = rows.filter(f);
    if (!set.length) continue;
    let tpPoss = 0, fpPoss = 0, tpLik = 0, fpLik = 0, nS = 0, nG = 0, top1 = 0, top3 = 0, nP = 0, noPattern = 0;
    for (const r of set) {
      const a = analyzeText(r.text, { explain: false, topK: 3 });
      const band = mode === "fused" && a.band === "unlikely_scam" && a.lexicon_band === "likely_scam" ? "possible_scam" : a.band;
      const poss = band === "possible_scam" || band === "likely_scam";
      const lik = band === "likely_scam";
      if (r.label === "scam") {
        nS++;
        if (poss) tpPoss++;
        if (lik) tpLik++;
        if (r.pattern) {
          nP++;
          const ids = a.patterns.map((p) => p.id);
          if (!ids.length) noPattern++;
          if (ids[0] === r.pattern) top1++;
          if (ids.slice(0, 3).includes(r.pattern)) top3++;
        }
      } else {
        nG++;
        if (poss) fpPoss++;
        if (lik) fpLik++;
      }
    }
    out[name] = {
      n: set.length,
      recall_possible: nS ? r4(tpPoss / nS) : null,
      fpr_possible: nG ? r4(fpPoss / nG) : null,
      recall_likely: nS ? r4(tpLik / nS) : null,
      fpr_likely: nG ? r4(fpLik / nG) : null,
      pattern_top1: nP ? r4(top1 / nP) : null,
      pattern_top3: nP ? r4(top3 / nP) : null,
      pattern_none_returned: nP ? r4(noPattern / nP) : null,
    };
  }
  configureModel(undefined);
  return out;
}

const result = {
  generated: new Date().toISOString().slice(0, 10),
  node: process.version,
  status,
  library_patterns: getLibrary()?.patterns.length ?? 0,
  model_bytes: statSync(modelPath).size,
  cold_start_ms: r4(coldMs),
  latency_ms: {
    note: "analyzeText() end to end, explanations on, single thread, after warm-up",
    transcripts_and_messages: { n: lat.length, mean_chars: Math.round(latSet.reduce((s, r) => s + r.text.length, 0) / latSet.length), p50: r4(pct(lat, 50)), p95: r4(pct(lat, 95)), p99: r4(pct(lat, 99)), max: r4(Math.max(...lat)) },
    short_texts_le_300_chars: { n: latShort.length, p50: r4(pct(latShort, 50)), p95: r4(pct(latShort, 95)), p99: r4(pct(latShort, 99)) },
  },
  model_plus_lexicon: quality("model"),
  fused_band_experiment: quality("fused"),
  lexicon_only_fallback: quality("lexicon"),
};
writeFileSync(join(ROOT, "ml/results/runtime_ts.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify({ cold_start_ms: result.cold_start_ms, latency_ms: result.latency_ms, model_bytes: result.model_bytes }, null, 1));
for (const k of ["model_plus_lexicon", "fused_band_experiment", "lexicon_only_fallback"] as const) {
  console.log(k);
  for (const [n, v] of Object.entries(result[k])) console.log("  ", n.padEnd(28), JSON.stringify(v));
}
