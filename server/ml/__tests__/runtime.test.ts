import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeText, configureLibrary, configureModel, getLibrary, getSources, loadModelFile, mlStatus, MODEL_FILE, resetLibrary, resetMl } from "../index.js";

const MODEL = join(__dirname, "..", "model", MODEL_FILE);
const GOLDEN = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "ml", "golden_inputs.json"), "utf8")) as {
  cases: { id: string; text: string; lang: string; expect?: "scam" | "genuine"; expect_pattern?: string[]; adversarial?: string }[];
};

/**
 * Cases the shipped model gets wrong today. They stay in the suite as
 * expected failures (it.fails), so a model that fixes them makes the test
 * suite flag it, and nobody can quietly drop them. Reasons are in ml/MODEL_CARD.md.
 */
const KNOWN_FAILURES: Record<string, string> = {
  // ruko-text-1.0.0 scores this classic KYC smishing at about 0.30. The genuine look-alike training messages
  // (real bank KYC reminders, SBI alerts) pull "sbi" and "kyc" towards genuine. The cue lexicon still flags it
  // (kyc_block, lexicon_band likely_scam), and so does the voice agent's own questioning.
  en_kyc_sms: "model-only band misses a classic KYC smishing message",
};

afterEach(() => {
  configureModel(undefined);
  resetLibrary();
  delete process.env.RUKO_ML_MODEL_PATH;
  resetMl();
});

describe("pattern library", () => {
  const lib = getLibrary()!;
  it("loads with 60+ patterns, each with English and Hindi truth and at least one resolvable source", () => {
    expect(lib).toBeTruthy();
    expect(lib.patterns.length).toBeGreaterThanOrEqual(60);
    const sources = getSources();
    for (const p of lib.patterns) {
      expect(p.truth.en.length, p.id).toBeGreaterThan(10);
      expect(p.truth.hi.length, p.id).toBeGreaterThan(5);
      expect(p.sources.length, p.id).toBeGreaterThan(0);
      for (const s of p.sources) expect(sources.has(s), `${p.id} -> ${s}`).toBe(true);
    }
  });

  it("keeps the 12 v0 pattern ids used by shared/patterns.ts", () => {
    const ids = new Set(lib.patterns.map((p) => p.id));
    for (const id of ["digital_arrest", "courier_parcel", "kyc_block", "investment_trading", "task_job", "fake_support_refund", "remote_access", "electricity_disconnection", "relative_emergency", "prize_lottery", "sim_disconnection", "video_call_blackmail"])
      expect(ids.has(id), id).toBe(true);
  });
});

describe("analyzeText with the shipped model", () => {
  it("runs in model+lexicon mode", () => {
    expect(mlStatus().mode).toBe("model+lexicon");
  });

  for (const c of GOLDEN.cases.filter((x) => x.expect)) {
    const run = KNOWN_FAILURES[c.id] ? it.fails : it;
    run(`${c.id} (${c.lang}${c.adversarial ? `, ${c.adversarial}` : ""}) -> ${c.expect}`, () => {
      const a = analyzeText(c.text);
      if (c.expect === "scam") expect(a.band).not.toBe("unlikely_scam");
      else expect(a.band).toBe("unlikely_scam");
      if (c.expect_pattern) expect(a.patterns.map((p) => p.id).some((id) => c.expect_pattern!.includes(id))).toBe(true);
    });
  }

  it("explains with spans that point into the original text", () => {
    const text = GOLDEN.cases.find((c) => c.id === "en_digital_arrest")!.text;
    const a = analyzeText(text);
    expect(a.evidence.length).toBeGreaterThan(0);
    for (const e of [...a.evidence, ...a.counter_evidence, ...a.pattern_evidence]) {
      expect(e.start).toBeGreaterThanOrEqual(0);
      expect(e.end).toBeLessThanOrEqual(text.length);
      expect(text.slice(e.start, e.end).length).toBeGreaterThan(0);
    }
    const cues = a.patterns.flatMap((p) => p.cues);
    expect(cues.some((h) => /digital arrest/i.test(text.slice(h.start, h.end)))).toBe(true);
  });

  it("never echoes phone numbers, UPI IDs, account numbers or URLs", () => {
    const text = GOLDEN.cases.find((c) => c.id === "pii_redaction")!.text;
    const out = JSON.stringify(analyzeText(text));
    for (const raw of ["testuser", "okicici", "123456789012", "90000 12345", "example-pay"]) expect(out).not.toContain(raw);
  });

  it("handles empty, tiny and very long input", () => {
    expect(analyzeText("").band).toBeDefined();
    expect(analyzeText("ok").patterns.length).toBeLessThanOrEqual(3);
    const long = analyzeText("kyc update karo ".repeat(2000));
    expect(long.truncated).toBe(true);
  });

  it("stays under 5 ms per call on average for typical inputs", () => {
    const texts = GOLDEN.cases.map((c) => c.text);
    for (const t of texts) analyzeText(t);
    const t0 = performance.now();
    const N = 20;
    for (let i = 0; i < N; i++) for (const t of texts) analyzeText(t);
    expect((performance.now() - t0) / (N * texts.length)).toBeLessThan(5);
  });
});

describe("fallbacks", () => {
  it("answers from the cue lexicon when the model is unavailable", () => {
    configureModel(null);
    const a = analyzeText("A CBI officer kept me on a video call, said I am under digital arrest and must not tell anyone.");
    expect(a.engine.mode).toBe("lexicon_only");
    expect(a.scam_probability).toBeNull();
    expect(a.patterns[0]?.id).toBe("digital_arrest");
    expect(a.band).not.toBe("unlikely_scam");
    expect(a.signals.map((s) => s.type)).toEqual(expect.arrayContaining(["authority_threat", "secrecy_demand"]));
  });

  it("marks negated cues and does not count them", () => {
    configureModel(null);
    const a = analyzeText("Nobody asked for my OTP and nobody told me to keep it secret, this is my rent.");
    for (const s of a.signals) if (s.type === "secrecy_demand") expect(s.hits.every((h) => h.negated)).toBe(true);
  });

  it("falls back to the lexicon when the model file fails its checksum", () => {
    const dir = mkdtempSync(join(tmpdir(), "ruko-ml-"));
    const p = join(dir, MODEL_FILE);
    copyFileSync(MODEL, p);
    writeFileSync(p + ".sha256", "0".repeat(64) + "  " + MODEL_FILE + "\n");
    expect(() => loadModelFile(p)).toThrow(/checksum/);
    process.env.RUKO_ML_MODEL_PATH = p;
    resetMl();
    const st = mlStatus();
    expect(st.mode).toBe("lexicon_only");
    expect(st.model_error).toMatch(/checksum/);
  });

  it("returns an empty result instead of throwing when nothing is available", () => {
    configureModel(null);
    configureLibrary({ library: null, signalCues: null });
    resetMl();
    const a = analyzeText("anything at all");
    expect(a.engine.mode).toBe("none");
    expect(a.band).toBe("unknown");
    expect(a.patterns).toEqual([]);
  });
});
