"""
Build Ruko's unified, PII-scrubbed training / evaluation table.

Reads
  ml/data/synthetic/ruko_synth_v1.jsonl        ours, LLM-generated (Nebius), labelled synthetic
  ml/data/realworld/realworld_eval.jsonl       ours, paraphrased from cited real-world sources (eval only)
  ml/data/raw/<id>/...                         third-party public datasets (see ml/fetch_data.py)
  data/patterns/library.json                   pattern ids + aliases
Writes
  ml/work/dataset.jsonl   one record per text with label, pattern, split and provenance

Record fields
  id, text, label ("scam"|"genuine"), pattern (library id or null), source, synthetic (bool),
  lang, format, coaching, kind ("scam"|"genuine"|"hard_negative"), group, split, weight
Splits
  train / val / test     synthetic generator A (by request group), Mendeley SMS, BothBosu
  test_genB              synthetic generator B (cross-generator, never trained on)
  ood_*                  third-party / real-world sets (never trained on)
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
from pii import scrub  # noqa: E402
from ruko_text import normalize  # noqa: E402

RAW = ROOT / "ml" / "data" / "raw"
SYN = ROOT / "ml" / "data" / "synthetic" / "ruko_synth_v1.jsonl"
REAL = ROOT / "ml" / "data" / "realworld" / "realworld_eval.jsonl"
LIB = ROOT / "data" / "patterns" / "library.json"
OUT = ROOT / "ml" / "work" / "dataset.jsonl"

csv.field_size_limit(10**8)


def h(s: str) -> int:
    return int(hashlib.sha1(s.encode("utf-8")).hexdigest()[:8], 16)


def split_of(group: str, val=0.1, test=0.2) -> str:
    r = (h("split:" + group) % 10000) / 10000
    return "test" if r < test else "val" if r < test + val else "train"


def alias_map() -> dict[str, str]:
    lib = json.loads(LIB.read_text(encoding="utf-8"))
    m = {}
    for p in lib["patterns"]:
        m[p["id"]] = p["id"]
        for a in p.get("aliases", []):
            m.setdefault(a, p["id"])
    return m


def rec(**kw) -> dict:
    kw["text"] = scrub(kw["text"]).strip()
    kw.setdefault("coaching", None)
    kw.setdefault("kind", kw["label"])
    kw.setdefault("weight", 1.0)
    kw.setdefault("pattern", None)
    kw["id"] = kw.get("id") or f"{kw['source']}-{hashlib.sha1(kw['text'].encode()).hexdigest()[:12]}"
    return kw


def load_synthetic(aliases: dict[str, str]) -> list[dict]:
    out = []
    if not SYN.exists():
        print("  (no synthetic file yet)")
        return out
    for line in SYN.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        role = r["generator_role"]
        split = "test_genB" if role == "B" else split_of(r["group"])
        pat = aliases.get(r["pattern"]) if r.get("pattern") else None
        if r["label"] == "scam" and not pat:
            continue  # pattern no longer in the library
        base = dict(
            label=r["label"], pattern=pat, source="synthetic", synthetic=True, lang=r["lang"], format=r["format"],
            coaching=r.get("coaching"), kind=r.get("kind", r["label"]), group=r["group"], split=split,
            generator=r["generator"],
        )
        out.append(rec(id=r["id"], text=r["text"], **base))
        # early-window augmentation for call transcripts (train only): what the model sees mid-call
        if r["format"] == "call_check" and split == "train":
            cust = [t["text"] for t in r["turns"] if t["speaker"] == "customer"]
            for k in sorted({2, (len(cust) + 1) // 2}):
                if 2 <= k < len(cust):
                    out.append(rec(id=f"{r['id']}-w{k}", text="\n".join(cust[:k]), weight=0.5, **{**base, "format": "call_window"}))
    return out


SPEAKER = re.compile(r"\b(?:caller|receiver|suspect|innocent)\s*:\s*", re.I)


def load_bothbosu() -> list[dict]:
    out = []
    files = {
        "bothbosu_scam_dialogue": "scam-dialogue_all.csv",
        "bothbosu_multi_agent": "agent_conversation_all.csv",
        "bothbosu_single_agent": "single-agent-scam-dialogue_all.csv",
    }
    for ds, fn in files.items():
        p = RAW / ds / fn
        if not p.exists():
            print(f"  (missing {ds})")
            continue
        with p.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                lab = row.get("label", row.get("labels", "")).strip()
                text = SPEAKER.sub("", row["dialogue"])  # speaker tags are dataset artefacts
                g = hashlib.sha1(text.encode()).hexdigest()[:12]
                out.append(rec(
                    text=text, label="scam" if lab == "1" else "genuine", source=ds, synthetic=True, lang="en",
                    format="scam_call_dialogue", group=g, split=split_of(g, val=0.1, test=0.2), weight=0.5,
                    subtype=row.get("type"),
                ))
    return out


def load_mendeley() -> list[dict]:
    p = RAW / "mendeley_smishing_f45bkkt8pr" / "Dataset_5971.zip"
    if not p.exists():
        print("  (missing mendeley)")
        return []
    z = zipfile.ZipFile(p)
    txt = z.read("Dataset_5971.csv").decode("utf-8", "replace")
    out, seen = [], set()
    for row in csv.DictReader(io.StringIO(txt)):
        lab = row["LABEL"].strip().lower()
        text = row["TEXT"].strip()
        key = normalize(text)
        if not key or key in seen:
            continue
        seen.add(key)
        g = hashlib.sha1(key.encode()).hexdigest()[:12]
        if lab == "spam":
            out.append(rec(text=text, label="genuine", kind="marketing_spam", source="mendeley_sms", synthetic=False, lang="en",
                           format="sms", group=g, split="ood_spam"))
            continue
        out.append(rec(text=text, label="scam" if lab == "smishing" else "genuine", source="mendeley_sms", synthetic=False,
                       lang="en", format="sms", group=g, split=split_of(g, val=0.1, test=0.3)))
    return out


RIDHAM_LANG = {"hinglish": "hinglish", "en": "en", "hi": "hi", "bn_en": "bn", "mr_en": "mr", "te_en": "te", "ta_en": "ta"}


def load_ridham() -> list[dict]:
    p = RAW / "ridham115_indian_scam_sms_audited" / "synthetic_audited.csv"
    if not p.exists():
        return []
    out = []
    with p.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            out.append(rec(
                text=row["text"], label="scam" if row["label"] == "scam" else "genuine", source="ridham115_sms", synthetic=True,
                lang=RIDHAM_LANG.get(row["language"], row["language"]), format="sms", group=row["row_id"], split="ood_ridham",
                subtype=row["topic"],
            ))
    return out


def load_flowxai() -> list[dict]:
    d = RAW / "flowxai_scamguardbench_v0_2"
    out, seen = [], set()
    for fn in ("standard.jsonl", "legit_confusable.jsonl", "hard.jsonl"):
        p = d / fn
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            if r["language"] != "en" or r["item_id"] in seen:
                continue
            seen.add(r["item_id"])
            out.append(rec(
                text=r["text"], label="scam" if r["verdict"] == "scam_likely" else "genuine",
                kind="hard_negative" if r.get("confusable_class") not in (None, "None") and r["verdict"] != "scam_likely" else None,
                source="flowxai_scamguardbench", synthetic=r.get("kind") == "synthetic", lang="en", format=r.get("channel") or "message",
                group=r["item_id"], split="ood_flowxai", subtype=r.get("confusable_class"),
            ))
    for r in out:
        if r["kind"] is None:
            r["kind"] = r["label"]
    return out


def load_realworld(aliases: dict[str, str]) -> list[dict]:
    if not REAL.exists():
        print("  (no real-world eval file yet)")
        return []
    out = []
    for line in REAL.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        pat = aliases.get(r.get("pattern") or "", None) if r["label"] == "scam" else None
        out.append(rec(
            id=r["id"], text=r["text"], label=r["label"], pattern=pat, source="realworld_curated", synthetic=False,
            lang=r.get("lang", "en"), format=r.get("format", "message"), group=r["id"], split="ood_realworld",
            source_url=r.get("source_url"),
        ))
    return out


def main() -> None:
    aliases = alias_map()
    print("loading …")
    parts = {
        "synthetic": load_synthetic(aliases),
        "bothbosu": load_bothbosu(),
        "mendeley": load_mendeley(),
        "ridham": load_ridham(),
        "flowxai": load_flowxai(),
        "realworld": load_realworld(aliases),
    }
    rows = [r for p in parts.values() for r in p if len(r["text"]) >= 8]

    # leakage guard: drop any eval row whose normalised text also appears in training
    train_keys = {normalize(r["text"]) for r in rows if r["split"] == "train"}
    before = len(rows)
    rows = [r for r in rows if r["split"] == "train" or normalize(r["text"]) not in train_keys]
    print(f"dropped {before - len(rows)} eval rows that duplicate training text")

    rows.sort(key=lambda r: r["id"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    c = Counter((r["source"], r["split"], r["label"]) for r in rows)
    for k in sorted(c):
        print(f"  {k[0]:28s} {k[1]:14s} {k[2]:8s} {c[k]:6d}")
    print(f"wrote {len(rows)} rows -> {OUT.relative_to(ROOT)}  sha256={hashlib.sha256(OUT.read_bytes()).hexdigest()[:16]}")


if __name__ == "__main__":
    main()
