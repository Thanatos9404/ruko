"""
Print the Markdown tables used in ml/MODEL_CARD.md from ml/results/*.json, so the
card quotes the result files exactly.

  ml/.venv/Scripts/python -I -X utf8 ml/report_tables.py
"""
from __future__ import annotations

import json
from pathlib import Path

R = Path(__file__).resolve().parent / "results"

SETS = [
    ("test_synthetic_A", "Synthetic, held-out requests (in-distribution)"),
    ("test_genB_cross_generator", "Synthetic, other generator (Gemma-27B)"),
    ("test_mendeley_real_sms", "Real SMS, Mendeley held-out"),
    ("test_bothbosu", "BothBosu dialogues, held-out"),
    ("ood_realworld_curated", "Real-world curated (165, cited)"),
    ("ood_ridham115_indian_sms", "Indian SMS, other team (Ridham115)"),
    ("ood_flowxai_en", "Legit look-alikes (ScamGuardBench en)"),
    ("ood_skyaara_genuine_payment_sms", "Genuine Indian payment SMS (skyaara)"),
    ("ood_imc25_real_smishing_india", "Real smishing, India (IMC25)"),
    ("ood_imc25_real_smishing_global", "Real smishing, global (IMC25)"),
    ("ood_icfd31k_calls", "Indian fraud calls (ICFD-31k)"),
    ("ood_marketing_spam_flag_rate", "Marketing spam (not scam)"),
]


def f(v, pct=False):
    if v is None:
        return "–"
    return f"{v*100:.1f}%" if pct else f"{v:.3f}"


def load(name):
    p = R / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8"))["results"] if p.exists() else {}


def binary_table(name):
    res = load(name)
    print(f"\n#### {name}\n")
    print("| Set | n (scam/genuine) | AUROC [95% CI] | Recall @0.5 | False-alarm rate @0.5 | Recall @0.85 | False-alarm rate @0.85 | ECE |")
    print("|---|---|---|---|---|---|---|---|")
    for k, label in SETS:
        if k not in res:
            continue
        b = res[k]["binary"]
        ci = b.get("auroc_95ci")
        auc = f"{f(b.get('auroc'))} [{f(ci[0])}–{f(ci[1])}]" if ci else f(b.get("auroc"))
        print(f"| {label} | {b['n']} ({b['n_scam']}/{b['n_genuine']}) | {auc} | {f(b['at_possible']['recall'], True)} | "
              f"{f(b['at_possible']['fpr'], True)} | {f(b['at_likely']['recall'], True)} | {f(b['at_likely']['fpr'], True)} | {f(b.get('ece'))} |")


def pattern_table(name):
    res = load(name)
    print(f"\n#### Pattern head: {name}\n")
    print("| Set | scam rows scored | Top-1 | Top-3 | Top-1, global/India twins merged | Top-1, same category | Macro-F1 |")
    print("|---|---|---|---|---|---|---|")
    for k, label in SETS:
        p = res.get(k, {}).get("patterns")
        if not p or "top1" not in p:
            continue
        print(f"| {label} | {p['n_scored']} | {f(p['top1'], True)} | {f(p['top3'], True)} | {f(p.get('top1_twins_merged'), True)} | "
              f"{f(p.get('top1_same_category'), True)} | {f(p.get('macro_f1'))} |")


def compare(names):
    print("\n#### Before / after (same held-out sets)\n")
    head = "| Set | metric | " + " | ".join(names) + " |"
    print(head)
    print("|---|---|" + "---|" * len(names))
    rs = {n: load(n) for n in names}
    for k, label in SETS:
        if not all(k in rs[n] for n in names):
            continue
        for metric, path, pct in (("AUROC", ("auroc",), False), ("recall @0.5", ("at_possible", "recall"), True),
                                  ("false alarms @0.5", ("at_possible", "fpr"), True)):
            vals = []
            for n in names:
                v = rs[n][k]["binary"]
                for p in path:
                    v = v.get(p) if isinstance(v, dict) else None
                vals.append(f(v, pct))
            if all(v == "–" for v in vals):
                continue
            print(f"| {label} | {metric} | " + " | ".join(vals) + " |")


if __name__ == "__main__":
    binary_table("main")
    pattern_table("main")
    compare(["before_round1_reevaluated", "variant_imc02_hn2", "main"])
    for n in ("synthetic_only", "real_sms_only", "bothbosu_only", "lang_holdout_ta_bn_mr"):
        binary_table(n)
