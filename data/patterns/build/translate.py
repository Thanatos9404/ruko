"""
Draft the non-English text of the pattern library with Nebius (Qwen3-235B).

Everything this writes is a MACHINE DRAFT: build_library.py marks it
"machine_draft" in each pattern's translation_status until a native speaker
reviews it. English (from the cited sources) stays the reference text.

  ml/.venv/Scripts/python -I -X utf8 data/patterns/build/translate.py
Reads  research/raw/patterns_merged.json (written by build_library.py --stage merge)
Writes data/patterns/build/translations.json
Responses are cached in ml/.cache/nebius (git-ignored); re-runs are free.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml" / "synth"))
sys.path.insert(0, str(ROOT / "ml"))
from generate import MODEL_A, chat, parse_json, read_key  # noqa: E402

MERGED = ROOT / "research" / "raw" / "patterns_merged.json"
OUT = ROOT / "data" / "patterns" / "build" / "translations.json"

INSTR = """You translate text for Ruko, a bank's fraud-safety VOICE assistant in India that calls customers before a risky payment is released.
Translate the English fields below. Rules:
- Hindi: natural, simple spoken Hindi in Devanagari that a polite bank agent would SAY on a call; keep common English words people use (OTP, PIN, UPI, app, link, KYC, bank) in Devanagari or Latin as speakers really do. Never formal Sanskritised Hindi.
- Hinglish: Hindi-English code-mix written only in Roman letters, as Indians type on WhatsApp.
- Tamil, Bengali, Marathi: natural spoken register in native script.
- Keep meaning exact. Do not add advice or facts. Keep "1930", "cybercrime.gov.in", "Sanchar Saathi", brand and agency names.
- truth sentences must stay ONE short sentence that can be said aloud.
Return strict JSON with exactly these keys:
{"name_hi": str, "truth_hi": str, "ask_next_hi": str, "advice_hi": [str], "red_flag_questions_hi": [str],
 "coaching_phrases_hi": [str], "coaching_phrases_hinglish": [str],
 "name_ta": str, "truth_ta": str, "name_bn": str, "truth_bn": str, "name_mr": str, "truth_mr": str,
 "extra_cues_hi": [str], "extra_cues_hinglish": [str]}
extra_cues_*: 8-12 short phrases (1-4 words) a Hindi / Hinglish speaker would say or receive for this scam that are NOT already in the given cue lists. Lowercase Hinglish."""


def job(p: dict, key: str) -> tuple[str, dict]:
    src = {
        "name": p["name"]["en"],
        "summary_for_context_only": p["summary"],
        "truth": p["truth"]["en"],
        "ask_next": p["ask_next"]["en"],
        "advice": p["advice"]["en"],
        "red_flag_questions": p["red_flag_questions"]["en"],
        "coaching_phrases": p["coaching_phrases"]["en"],
        "existing_cues_hi": p["cues"].get("hi", []),
        "existing_cues_hinglish": p["cues"].get("hinglish", []),
    }
    user = INSTR + "\n\nENGLISH FIELDS:\n" + json.dumps(src, ensure_ascii=False, indent=1)
    content = chat(MODEL_A, user, temperature=0.2, max_tokens=5000, seed=7, key=key)
    return p["id"], parse_json(content)


def main() -> None:
    pats = json.loads(MERGED.read_text(encoding="utf-8"))["patterns"]
    key = read_key()
    out = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    todo = [p for p in pats if p["id"] not in out]
    print(f"{len(todo)} patterns to translate")
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for fut in cf.as_completed([ex.submit(job, p, key) for p in todo]):
            try:
                pid, tr = fut.result()
                out[pid] = tr
            except Exception as e:  # noqa: BLE001
                print("  failed:", str(e)[:200])
    OUT.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
