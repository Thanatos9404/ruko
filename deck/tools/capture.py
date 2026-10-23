"""Capture fresh product screenshots for the pitch deck.

Drives the installed Google Chrome through Playwright (channel="chrome"); no
browser download. Read-only: it presses Pay and "Watch the recorded run" in the
sandbox demo (no Bolna call, no credit used) and opens console pages.

    <toolkit venv python> -I deck/tools/capture.py [base_url] [out_dir] [only]

Defaults: https://ruko-symphony.vercel.app and %TEMP%/ruko-deck-shots (raw PNG
at 2x; kept outside the repo).
`only` is a comma list of: landing, demo, demo_hi, check, console, console_live, console_eval_check.
Then run deck/tools/prep_images.py to crop and compress for the deck.
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://ruko-symphony.vercel.app").rstrip("/")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(os.environ.get("TEMP", tempfile.gettempdir())) / "ruko-deck-shots")
ONLY = sys.argv[3].split(",") if len(sys.argv) > 3 else None
OUT.mkdir(parents=True, exist_ok=True)
W, H, DSF = 1440, 900, 2

HIDE_NAV = "header.fixed { visibility: hidden !important; }"
PHONE = '[role=region][aria-label="Sandbox bank app"]'
ENGINE = 'section[aria-label="Ruko engine"]'
LIVE_HI = "chk_KEFA2WGBYA"  # live call #5, 23 Oct: first live Hindi call, blocked (scripted TTS customer)
LIVE_EN = "chk_B3RQU9A6M6"  # live call #2, 23 Oct: English, blocked (scripted TTS customer)
CHECK_ID = "chk_YEEMZU2H8H"  # production demo tenant (v5 seed): eval replay, Hindi, digital arrest, "Safe Custody Account RBI", blocked


def want(name: str) -> bool:
    return not ONLY or name in ONLY


def shot(page: Page, name: str, full: bool = False) -> None:
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=full)
    print("wrote", path)


def el_shot(page: Page, selector: str, name: str) -> None:
    path = OUT / f"{name}.png"
    page.locator(selector).first.screenshot(path=str(path))
    print("wrote", path)


def settle(page: Page, s: float = 1.5) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass  # the app polls; a quiet network is not guaranteed
    time.sleep(s)


def scroll_through(page: Page) -> None:
    h = page.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < h:
        page.evaluate(f"window.scrollTo(0, {y})")
        time.sleep(0.25)
        y += 500
    page.evaluate("window.scrollTo(0, 0)")
    time.sleep(0.6)


def click_text(page: Page, text: str) -> bool:
    return page.evaluate(
        """(t) => {
            const el = [...document.querySelectorAll('button,a,[role=radio]')].find(e => e.textContent && e.textContent.trim().includes(t));
            if (el) el.click();
            return Boolean(el);
        }""",
        text,
    )


def phone_text(page: Page) -> str:
    return page.locator(PHONE).first.inner_text()


def demo(page: Page, lang: str | None, tag: str) -> None:
    page.goto(f"{BASE}/demo")
    settle(page, 2.5)
    page.add_style_tag(content=HIDE_NAV)
    click_text(page, "CBI officer")
    if lang:
        click_text(page, lang)
    time.sleep(0.8)
    page.locator(PHONE).first.scroll_into_view_if_needed()
    time.sleep(0.5)
    el_shot(page, PHONE, f"phone-pay{tag}")
    page.locator(f"{PHONE} button", has_text="₹1,90,000").first.click()
    time.sleep(3.5)
    el_shot(page, PHONE, f"phone-hold{tag}")
    el_shot(page, ENGINE, f"engine-hold{tag}")
    shot(page, f"demo-hold{tag}")
    if not (click_text(page, "Watch the recorded run") or click_text(page, "रिकॉर्डेड रन देखें") or click_text(page, "रिकॉर्ड किया रन देखें")):
        print("no recorded-run button")
        return
    # Named frames, taken the first time their line is on the phone (English run).
    moments = {"greeting": "code word is", "probe": "app shows you were on a call", "truth": "no 'digital arrest' in Indian", "ravi": "my son Ravi"}
    taken: set[str] = set()
    t0 = time.time()
    i = 0
    while time.time() - t0 < 100:
        time.sleep(2.0)
        i += 1
        el_shot(page, PHONE, f"phone-run{tag}-{i:02d}")
        text = phone_text(page)
        for name, needle in moments.items():
            if name not in taken and needle in text:
                time.sleep(1.6)  # let the bubble finish animating in
                el_shot(page, PHONE, f"phone-{name}{tag}")
                el_shot(page, ENGINE, f"engine-{name}{tag}")
                taken.add(name)
        done = page.evaluate("Boolean([...document.querySelectorAll('span')].find(s => /^(Blocked|Delayed|Released)$/.test(s.textContent.trim())))")
        if done:
            time.sleep(4)
            el_shot(page, PHONE, f"phone-outcome{tag}")
            el_shot(page, ENGINE, f"engine-outcome{tag}")
            shot(page, f"demo-outcome{tag}")
            break


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=DSF, color_scheme="dark")
        page = ctx.new_page()

        if want("landing"):
            page.goto(f"{BASE}/")
            settle(page, 3)
            shot(page, "landing-hero")

        if want("demo"):
            demo(page, None, "")
        if want("demo_hi"):
            demo(page, "हिंदी", "-hi")

        if want("check"):
            page.goto(f"{BASE}/check")
            settle(page, 2)
            page.add_style_tag(content=HIDE_NAV)
            shot(page, "check")
            if click_text(page, "CBI"):
                time.sleep(6)
                shot(page, "check-answer")

        if want("console"):
            for name, path in [("console-overview", "/console"), ("console-library", "/console/library"), ("console-eval", "/console/eval"), ("console-integration", "/console/integration")]:
                page.goto(f"{BASE}{path}")
                settle(page, 2.5)
                shot(page, name)
            page.goto(f"{BASE}/console")
            settle(page, 2.5)
            page.evaluate("document.querySelector('a[href^=\"/console/checks/\"]')?.click()")
            time.sleep(3)
            shot(page, "console-check")
            scroll_through(page)
            shot(page, "console-check-full", full=True)

        if want("console_live"):
            # The live Bolna calls of 23 Oct, in the sandbox tenant: Hindi (#5) and English (#2).
            for name, cid in [("console-live-hi", LIVE_HI), ("console-live-en", LIVE_EN)]:
                page.goto(f"{BASE}/console/checks/{cid}?tenant=sandbox")
                settle(page, 3)
                scroll_through(page)
                shot(page, f"{name}-full", full=True)

        if want("console_eval_check"):
            # An eval-replay check with a transcript: Hindi, digital arrest, blocked.
            page.goto(f"{BASE}/console/checks/{CHECK_ID}")
            settle(page, 3)
            scroll_through(page)
            shot(page, "console-eval-check-full", full=True)

        browser.close()


if __name__ == "__main__":
    main()
