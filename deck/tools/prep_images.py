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
    for name in ["phone-pay", "phone-hold", "phone-greeting", "phone-truth", "phone-outcome"]:
        save(first(name), name, 680)
    # The trusted-contact moment; fall back to the last call frame before the outcome screen.
    runs = sorted(SHOTS.glob("phone-run-[0-9]*.png"))
    contact = SHOTS / "phone-contact.png"
    save(Image.open(contact if contact.exists() else runs[-2]), "phone-contact", 680)

    # Console: an eval-replay check (Hindi, digital arrest), its transcript card with evidence highlighted.
    cc = first("console-eval-check-full")  # 2880 x ~5966 at 2x
    save(crop_frac(cc, 0.193, 0.400, 0.648, 0.668), "console-transcript", 1300)


if __name__ == "__main__":
    main()
