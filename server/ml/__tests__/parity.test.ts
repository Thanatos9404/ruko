/**
 * Python <-> TypeScript parity. ml/train.py runs the Python reference
 * (ml/ruko_text.py) on ml/golden_inputs.json and writes the fixture; the TS
 * runtime must reproduce the same tokens, the same feature stream and the same
 * probabilities from the shipped model file.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, tokenize } from "../featurize.js";
import { loadModelFile, MODEL_FILE } from "../index.js";
import { TextModel } from "../model.js";

const FIXTURE = join(__dirname, "fixtures", "golden.json");
const MODEL = join(__dirname, "..", "model", MODEL_FILE);

interface Golden {
  model_version: string;
  cases: { id: string; text: string; tokens: string[]; features_sha256: string; p_scam: number; top_patterns: [string, number][] }[];
}

const golden: Golden | null = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, "utf8")) : null;

describe.runIf(golden && existsSync(MODEL))("parity with the Python reference", () => {
  const model = new TextModel(loadModelFile(MODEL));

  it("fixture was produced by the shipped model", () => {
    expect(model.version).toBe(golden!.model_version);
  });

  for (const c of golden?.cases ?? []) {
    it(`${c.id}: tokens, features and probabilities match`, () => {
      expect(tokenize(c.text).map((t) => t.text)).toEqual(c.tokens);
      const sha = createHash("sha256").update(analyze(c.text).join("\n"), "utf8").digest("hex");
      expect(sha).toBe(c.features_sha256);
      const pred = model.predict(c.text, { topK: 3, explain: false });
      expect(pred.p_scam).toBeCloseTo(c.p_scam, 9);
      expect(pred.patterns.map((p) => p.id)).toEqual(c.top_patterns.map(([id]) => id));
      pred.patterns.forEach((p, i) => expect(p.p_given_scam).toBeCloseTo(c.top_patterns[i][1], 9));
    });
  }
});
