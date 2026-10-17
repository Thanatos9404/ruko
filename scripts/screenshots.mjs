#!/usr/bin/env node
// Full-page screenshots of every screen at 1440 and 375 px for docs/screenshots/.
// Scrolls through each page first so scroll-triggered reveals have played.
// Uses the locally installed Chrome (no downloads). Run against a production build:
//   npx vite build && npx tsx scripts/serve-prod.ts 5430   (in another terminal)
//   node scripts/screenshots.mjs http://localhost:5430 [outDir] [only]
import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base = (process.argv[2] ?? "http://localhost:5430").replace(/\/$/, "");
const outDir = process.argv[3] ?? "docs/screenshots";
const only = process.argv[4];
mkdirSync(outDir, { recursive: true });
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y < h; y += Math.floor(vh * 0.6)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
}

async function click(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll("button,a,[role=radio]")].find((e) => e.textContent?.trim().includes(t));
    el?.click();
    return Boolean(el);
  }, text);
}

const shots = [
  { name: "landing", path: "/", full: true },
  { name: "demo-pay", path: "/demo", full: false },
  { name: "demo-hold", path: "/demo", full: false, steps: [["Pay ₹1,90,000", 3000]] },
  { name: "demo-blocked", path: "/demo", full: false, steps: [["Pay ₹1,90,000", 3000], ["Watch the recorded run", 55000]] },
  { name: "check", path: "/check", full: true },
  { name: "check-answer", path: "/check", full: false, steps: [["Someone from 'CBI'", 12000]], wide: true },
  { name: "console-overview", path: "/console", full: true },
  { name: "console-check", path: "/console", full: true, steps: [["__first_check__", 4000]] },
  { name: "console-library", path: "/console/library", full: true },
  { name: "console-eval", path: "/console/eval", full: true },
  { name: "console-integration", path: "/console/integration", full: true },
];

for (const s of shots) {
  if (only && !s.name.startsWith(only)) continue;
  for (const width of [1440, 375]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width, height: width > 500 ? 900 : 812, isMobile: width < 500, hasTouch: width < 500 });
    await page.goto(`${base}${s.path}`, { waitUntil: "networkidle0", timeout: 60000 });
    await sleep(2600);
    for (const [text, wait] of s.steps ?? []) {
      if (text === "__first_check__") {
        await page.evaluate(() => (document.querySelector('a[href^="/console/checks/"]'))?.click());
      } else await click(page, text);
      await sleep(wait);
    }
    if (s.full) await scrollThrough(page);
    const file = `${outDir}/${s.name}-${width}.png`;
    await page.screenshot({ path: file, fullPage: Boolean(s.full) });
    console.log(`wrote ${file}`);
    await ctx.close();
  }
}
await browser.close();
