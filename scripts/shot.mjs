#!/usr/bin/env node
// Quick visual check: node scripts/shot.mjs <url> <width> <height> <out.png> [full] [clickText...]
// Uses the locally installed Chrome; no downloads.
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url, w = "1440", h = "900", out = "shot.png", full = "", ...clicks] = process.argv.slice(2);
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--use-fake-ui-for-media-stream"] });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1, isMobile: Number(w) < 500, hasTouch: Number(w) < 500 });
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 300)));
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
for (const c of clicks) {
  const [text, wait = "1500"] = c.split("@");
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a, [role=radio]")].find((e) => e.textContent?.trim().includes(t));
    if (el) (el).click();
    return Boolean(el);
  }, text);
  if (!ok) console.error(`no element with text "${text}"`);
  await new Promise((r) => setTimeout(r, Number(wait)));
}
await page.screenshot({ path: out, fullPage: full === "full" });
await browser.close();
console.log(`wrote ${out}`);
