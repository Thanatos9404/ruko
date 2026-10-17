"""
Find "Hinglish" cue and coaching entries that are really plain English, and redraft
them as romanised Hindi (Hinglish) with Nebius. Output stays a MACHINE DRAFT.

  ml/.venv/Scripts/python -I -X utf8 data/patterns/build/fix_hinglish.py
Reads  data/patterns/library.json (built once without fixes) and the BothBosu corpus
       in ml/data/raw for an English vocabulary
Writes data/patterns/build/hinglish_fixes.json  {pattern_id: {original: replacement}}
build_library.py --stage final applies the fixes.
"""
from __future__ import annotations

import collections
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml" / "synth"))
sys.path.insert(0, str(ROOT / "ml"))
from generate import MODEL_A, chat, parse_json, read_key  # noqa: E402

LIB = ROOT / "data" / "patterns" / "library.json"
OUT = ROOT / "data" / "patterns" / "build" / "hinglish_fixes.json"
RAW = ROOT / "ml" / "data" / "raw"

# common romanised-Hindi function words: never counted as English
HINDI = set(
    "hai hain ho ka ki ke ko mein me se par pe kar karo karna kiya nahi nahin mat aap mera meri mere yeh ye woh wo kya "
    "abhi turant jaldi paise bhejo bolo diya dena lo wala wali wale gaya raha sab aur ya toh tak liye ji haan koi kuch "
    "hoga aaya aayi bhai beta".split()
)

PROMPT = """These phrases are in a scam-pattern cue list for India. They are meant to be HINGLISH (Hindi-English code-mix
written in Roman letters, the way Indian scammers and victims actually type or speak), but they were written in plain English.
Rewrite each one as natural Hinglish with the same meaning: Hindi grammar and words in Roman script, keeping the English
nouns people really use (OTP, UPI, KYC, app, link, bank, card, account, call, police, courier, gift card).
Example: "merge the incoming call with this one so we can all talk" -> "aane wali call ko is call ke saath merge kar do, sab saath mein baat karte hain".
Keep cues short (1-6 words) and lowercase. Return strict JSON: {"items": [{"en": "<original>", "hinglish": "<rewrite>"}]}
Pattern: %s
Phrases:
%s"""


def english_vocab(lib: dict) -> set[str]:
    words: collections.Counter = collections.Counter()

    def add(s: str) -> None:
        words.update(re.findall(r"[a-z]+", s.lower()))

    for p in lib["patterns"]:
        add(p["summary"])
        add(p["victim_profile"])
        for x in p["indicators"] + p["typical_claims"]:
            add(x)
        for k in ("red_flag_questions", "coaching_phrases", "cues", "advice"):
            for x in p[k].get("en", []):
                add(x)
        add(p["truth"]["en"])
        add(p["ask_next"]["en"])
    for ds, fn in (("bothbosu_scam_dialogue", "scam-dialogue_all.csv"), ("bothbosu_multi_agent", "agent_conversation_all.csv")):
        f = RAW / ds / fn
        if f.exists():
            with f.open(encoding="utf-8-sig", newline="") as fh:
                for row in csv.DictReader(fh):
                    add(row["dialogue"])
    return {w for w, c in words.items() if c >= 2} - HINDI


def english_only(s: str, vocab: set[str]) -> bool:
    toks = re.findall(r"[a-z]+", s.lower())
    return bool(toks) and sum(t in vocab for t in toks) / len(toks) >= 0.9


def main() -> None:
    lib = json.loads(LIB.read_text(encoding="utf-8"))
    vocab = english_vocab(lib)
    fixes: dict[str, dict[str, str]] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    key = read_key()
    flagged = 0
    for p in lib["patterns"]:
        items = [x for f in ("coaching_phrases", "cues") for x in p[f].get("hinglish", []) if english_only(x, vocab)]
        items = [x for x in items if x not in fixes.get(p["id"], {})]
        if not items:
            continue
        flagged += len(items)
        content = chat(MODEL_A, PROMPT % (p["name"]["en"], json.dumps(items, ensure_ascii=False, indent=1)),
                       temperature=0.2, max_tokens=1500, seed=11, key=key)
        for it in parse_json(content).get("items", []):
            src, dst = str(it.get("en", "")).strip(), str(it.get("hinglish", "")).strip()
            if src in items and dst and not english_only(dst, vocab) and not re.search(r"[ऀ-ॿ]", dst):
                fixes.setdefault(p["id"], {})[src] = dst
    OUT.write_text(json.dumps(dict(sorted(fixes.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = sum(len(v) for v in fixes.values())
    print(f"flagged {flagged} English-only Hinglish entries this run; {n} fixes stored in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
