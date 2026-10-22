"""
Recall vs false-alarm trade-off of candidate models on the real / third-party SMS sets.

For each candidate in ml/work/models/ and each threshold on the calibrated
probability, report:
  - recall on real Indian and global smishing (IMC25 held-out reports)
  - false-alarm rate on genuine look-alike messages pooled from three third-party
    sets (Ridham115 safe rows, ScamGuardBench legit rows, skyaara genuine payment SMS)
  - recall / false alarms on the 166-item real-world curated set

  ml/.venv/Scripts/python -I -X utf8 ml/analyze_tradeoff.py main variant_no_imc
Writes ml/results/tradeoff.json.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
import train  # noqa: E402

THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]


def main() -> None:
    names = sys.argv[1:] or ["main", "variant_no_imc"]
    rows = train.load()
    corpus = train.Corpus(rows, hashlib.sha256(train.DATA.read_bytes()).hexdigest())
    by = lambda split: [r for r in rows if r["split"] == split]  # noqa: E731
    imc_in, imc_gl = by("ood_imc25_india"), by("ood_imc25_global")
    gen_look = [r for r in by("ood_ridham") + by("ood_flowxai") + by("ood_skyaara") if r["label"] == "genuine"]
    rw = by("ood_realworld")
    out = {"sets": {"imc25_india_scam": len(imc_in), "imc25_global_scam": len(imc_gl), "genuine_lookalikes_pooled": len(gen_look),
                    "realworld": len(rw)}, "models": {}}
    for nm in names:
        art = json.loads((ROOT / "ml" / "work" / "models" / f"{nm}.json").read_text(encoding="utf-8"))
        sc = train.Scorer(art, corpus)
        p_in, _ = sc.predict(imc_in)
        p_gl, _ = sc.predict(imc_gl)
        p_gen, _ = sc.predict(gen_look)
        p_rw, _ = sc.predict(rw)
        y_rw = np.array([r["label"] == "scam" for r in rw])
        curve = []
        for t in THRESHOLDS:
            curve.append({
                "threshold": t,
                "imc25_india_recall": round(float((p_in >= t).mean()), 4),
                "imc25_global_recall": round(float((p_gl >= t).mean()), 4),
                "genuine_lookalike_fpr": round(float((p_gen >= t).mean()), 4),
                "realworld_recall": round(float((p_rw[y_rw] >= t).mean()), 4),
                "realworld_fpr": round(float((p_rw[~y_rw] >= t).mean()), 4),
            })
        out["models"][nm] = curve
        print(nm)
        for c in curve:
            print("  ", c)
    (ROOT / "ml" / "results" / "tradeoff.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
