"""Crop and compress the raw captures from capture.py into deck/assets/img/*.jpg.

    python deck/tools/prep_images.py [shots_dir]

Needs Pillow. Crops are fractions of the source image, so they survive small
layout changes; check the deck after a recapture.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from PIL import Image

SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else Path(os.environ.get("TEMP", tempfile.gettempdir())) / "ruko-deck-shots")
OUT = Path(__file__).resolve().parents[1] / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)
Q = 84


def save(im: Image.Image, name: str, max_w: int | None = None) -> None:
    im = im.convert("RGB")
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    path = OUT / f"{name}.jpg"
    im.save(path, "JPEG", quality=Q, optimize=True, progressive=True)
    print(f"{path.name:28s} {im.width}x{im.height} {path.stat().st_size // 1024} KB")


def crop_frac(im: Image.Image, x0: float, y0: float, x1: float, y1: float) -> Image.Image:
    w, h = im.size
    return im.crop((round(w * x0), round(h * y0), round(w * x1), round(h * y1)))


def first(*names: str) -> Image.Image:
    for n in names:
        p = SHOTS / f"{n}.png"
        if p.exists():
            return Image.open(p)
    raise FileNotFoundError(names)


def main() -> None:
    # Only what deck/index.html uses.
    # Phone screens, whole device (element captures at 2x: about 680 px wide).
    for name in ["phone-pay", "phone-hold", "phone-greeting", "phone-probe", "phone-truth", "phone-outcome"]:
        save(first(name), name, 680)

    # Console: an eval-replay check (Hindi, digital arrest), its transcript card with evidence highlighted.
    # Fractions fit chk_YEEMZU2H8H at 1440 px wide (page about 6,800 px tall at 2x); recheck after a recapture.
    cc = first("console-eval-check-full")
    save(crop_frac(cc, 0.193, 0.352, 0.648, 0.588), "console-transcript", 1300)


if __name__ == "__main__":
    main()
