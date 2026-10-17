"""
Download the public third-party datasets Ruko trains or evaluates on.

Nothing here is committed: files land in ml/data/raw/<id>/ (git-ignored) and
are verified against the SHA-256 pinned below, so a training run always sees
exactly the bytes the model card describes. All URLs are public and need no
login; datasets that need a login are listed in research/datasets/NEEDS_LOGIN.md.

Usage:  ml/.venv/Scripts/python -I -X utf8 ml/fetch_data.py [--pin]
  --pin  print the SHA-256 of what was downloaded (use when adding a dataset)
"""
from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "ml" / "data" / "raw"

HF = "https://huggingface.co/datasets"

# id -> files as (url, filename, unused); digests are pinned in ml/data_pins.json
DATASETS: dict[str, dict] = {
    "mendeley_smishing_f45bkkt8pr": {
        "licence": "CC BY 4.0",
        "files": [
            (
                "https://data.mendeley.com/public-files/datasets/f45bkkt8pr/files/edb361de-918d-469f-9106-e84823830665/file_downloaded",
                "Dataset_5971.zip",
                None,
            )
        ],
    },
    "bothbosu_scam_dialogue": {
        "licence": "Apache-2.0",
        "files": [(f"{HF}/BothBosu/scam-dialogue/resolve/main/scam-dialogue_all.csv", "scam-dialogue_all.csv", None)],
    },
    "bothbosu_multi_agent": {
        "licence": "Apache-2.0",
        "files": [(f"{HF}/BothBosu/multi-agent-scam-conversation/resolve/main/agent_conversation_all.csv", "agent_conversation_all.csv", None)],
    },
    "bothbosu_single_agent": {
        "licence": "Apache-2.0",
        "files": [(f"{HF}/BothBosu/single-agent-scam-conversations/resolve/main/single-agent-scam-dialogue_all.csv", "single-agent-scam-dialogue_all.csv", None)],
    },
    "ridham115_indian_scam_sms_audited": {
        "licence": "CC BY 4.0",
        "files": [(f"{HF}/Ridham115/indian-scam-sms-synthetic-audited/resolve/main/data/synthetic_audited.csv", "synthetic_audited.csv", None)],
    },
    "flowxai_scamguardbench_v0_2": {
        "licence": "Apache-2.0",
        "files": [
            (f"{HF}/flowxai/scamguardbench/resolve/main/v0.2/standard.jsonl", "standard.jsonl", None),
            (f"{HF}/flowxai/scamguardbench/resolve/main/v0.2/legit_confusable.jsonl", "legit_confusable.jsonl", None),
            (f"{HF}/flowxai/scamguardbench/resolve/main/v0.2/hard.jsonl", "hard.jsonl", None),
        ],
    },
}

PINS_FILE = ROOT / "ml" / "data_pins.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    import json

    pin_mode = "--pin" in sys.argv
    pins = json.loads(PINS_FILE.read_text(encoding="utf-8")) if PINS_FILE.exists() else {}
    for ds, spec in DATASETS.items():
        d = RAW / ds
        d.mkdir(parents=True, exist_ok=True)
        for url, name, _ in spec["files"]:
            path = d / name
            if not path.exists():
                print(f"downloading {ds}/{name}")
                req = urllib.request.Request(url, headers={"User-Agent": "ruko-ml-fetch/1.0"})
                with urllib.request.urlopen(req, timeout=300) as r, path.open("wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
            digest = sha256(path)
            key = f"{ds}/{name}"
            if key in pins and pins[key] != digest and not pin_mode:
                raise SystemExit(f"SHA-256 mismatch for {key}: expected {pins[key]}, got {digest}")
            pins[key] = digest
            print(f"  ok {key} {path.stat().st_size:,} bytes sha256={digest[:16]}…")
    if pin_mode or not PINS_FILE.exists():
        PINS_FILE.write_text(json.dumps(pins, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"pinned {len(pins)} files in {PINS_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
