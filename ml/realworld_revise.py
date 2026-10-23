"""
Pre-publication revision of the real-world evaluation set (ml/data/realworld/realworld_eval.jsonl).

For every row:
  - "scrub": replace people's names and scammer aliases with a role or [name], and drop
    street / sector / neighbourhood-level places (city and state stay); otherwise unchanged.
  - "rewrite" (rows whose text shares a run of 8+ words with the cited article, or whose
    article could not be fetched to check): the same, plus a fresh paraphrase with different
    sentence structure and wording, keeping the scam cues (agency or brand, threat, ask, payment).
Drafted with Nebius (Qwen3-235B), then checked again for overlap and reviewed.

  ml/.venv/Scripts/python -I -X utf8 ml/realworld_revise.py <overlap.json> [--drop rwe_0148]
Writes ml/data/realworld/realworld_eval.jsonl (in place) and ml/data/realworld/REVISION_LOG.json.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml" / "synth"))
sys.path.insert(0, str(ROOT / "ml"))
from generate import MODEL_A, chat, parse_json, read_key  # noqa: E402
from pii import scrub  # noqa: E402

DATA = ROOT / "ml" / "data" / "realworld" / "realworld_eval.jsonl"
LOG = ROOT / "ml" / "data" / "realworld" / "REVISION_LOG.json"

COMMON = """You are editing one item of a scam-detection evaluation set before it is published.
Rules for the output text:
- Same language and script as the input ({lang}); same kind of text ({fmt}); same meaning and label ({label}).
- Keep every scam cue: the agency, bank or brand claimed, the threat or promise, what is asked, and the payment method.
- Replace any person's name, including names or aliases used by scammers ("Officer Vikram", "Priya from FedEx"), with a role ("a man claiming to be a CBI officer") or with [name].
- Remove street, sector, colony, neighbourhood, building or village-level places. A city or state may stay.
- Keep placeholders such as [phone], [upi], [account], [link] exactly as they are. Do not add new numbers, names or places.
"""
REWRITE = COMMON + """- REWRITE it substantially: new sentence structure and different wording throughout, so that no run of 8 or more
  consecutive words matches the input. Keep it natural and about the same length.
Return strict JSON: {{"text": "..."}}
INPUT:
{text}"""
SCRUB = COMMON + """- Otherwise change NOTHING. If the input has no names and no sub-city places, return it exactly as it is.
Return strict JSON: {{"text": "...", "changed": true|false}}
INPUT:
{text}"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("overlap")
    ap.add_argument("--drop", nargs="*", default=[])
    ap.add_argument("--min-run", type=int, default=8)
    args = ap.parse_args()
    rows = [json.loads(l) for l in DATA.read_text(encoding="utf-8").splitlines() if l.strip()]
    ov = {o["id"]: o for o in json.loads(Path(args.overlap).read_text(encoding="utf-8"))}
    key = read_key()

    def job(r):
        o = ov.get(r["id"], {})
        mode = "rewrite" if (not o.get("checked") or (o.get("run") or 0) >= args.min_run) else "scrub"
        tmpl = REWRITE if mode == "rewrite" else SCRUB
        prompt = tmpl.format(lang=r["lang"], fmt=r["format"], label=r["label"], text=r["text"])
        out = parse_json(chat(MODEL_A, prompt, temperature=0.3, max_tokens=1200, seed=23, key=key))
        new = scrub(str(out.get("text", "")).strip()) or r["text"]
        return r["id"], mode, new

    log = {"dropped": args.drop, "rows": {}}
    kept = [r for r in rows if r["id"] not in set(args.drop)]
    with cf.ThreadPoolExecutor(8) as ex:
        results = {rid: (mode, new) for rid, mode, new in ex.map(job, kept)}
    for r in kept:
        mode, new = results[r["id"]]
        log["rows"][r["id"]] = {"mode": mode, "changed": new != r["text"], "run_before": ov.get(r["id"], {}).get("run")}
        r["text"] = new
        r["revised"] = "2026-10-23 pre-publication: " + ("re-paraphrased; names and sub-city places removed" if mode == "rewrite" else "names and sub-city places removed where present")
    DATA.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in kept), encoding="utf-8", newline="\n")
    LOG.write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    n_rw = sum(1 for v in log["rows"].values() if v["mode"] == "rewrite")
    n_ch = sum(1 for v in log["rows"].values() if v["changed"])
    print(f"kept {len(kept)} rows (dropped {len(args.drop)}); rewritten {n_rw}; changed {n_ch}")


if __name__ == "__main__":
    main()
