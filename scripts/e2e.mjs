#!/usr/bin/env node
// End-to-end check of the free sandbox in real browsers (local Chrome, no downloads):
// every scenario, in a fresh browser context, must reach the hold or the "paid" screen
// on the first click, and one recorded run must reach a decision.
//
//   node scripts/e2e.mjs http://localhost:5410
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base = (process.argv[2] ?? "http://localhost:5410").replace(/\/$/, "");
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenarios = await (await fetch(`${base}/api/demo/scenarios`)).json();
let failures = 0;

async function phoneText(page) {
  return page.evaluate(() => document.querySelector('[aria-label="Sandbox bank app"]')?.textContent ?? "");
}
async function clickText(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll("button,[role=radio]")].find((e) => e.textContent?.trim().includes(t));
    el?.click();
    return Boolean(el);
  }, text);
}

for (const sc of scenarios.data) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/demo`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[role=radio]");
  await sleep(500);
  if (!(await clickText(page, sc.title))) console.error(`no chip for ${sc.title}`);
  await sleep(400);
  const amount = new Intl.NumberFormat("en-IN").format(sc.payment.amount_inr);
  if (!(await clickText(page, `Pay ₹${amount}`))) console.error(`no pay button for ${sc.id}`);
  await sleep(2500);
  const text = await phoneText(page);
  const ok = /Payment paused|Payment sent/.test(text) && !/Too many|slow down/.test(text);
  console.log(`${ok ? "PASS" : "FAIL"} ${sc.id.padEnd(18)} → ${/Payment paused/.test(text) ? "held" : /Payment sent/.test(text) ? "allowed" : text.slice(0, 80)}${errors.length ? ` (page errors: ${errors.join("; ")})` : ""}`);
  if (!ok || errors.length) failures++;
  await ctx.close();
}

// One full recorded run to a decision.
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/demo`, { waitUntil: "networkidle0" });
  await sleep(800);
  await clickText(page, "Pay ₹1,90,000");
  await sleep(2500);
  await clickText(page, "Watch the recorded run");
  let decided = "";
  for (let i = 0; i < 40 && !decided; i++) {
    await sleep(2000);
    const t = await phoneText(page);
    decided = /Payment stopped/.test(t) ? "block" : /Payment on hold/.test(t) ? "delay" : /Payment sent/.test(t) ? "release" : "";
  }
  console.log(`${decided ? "PASS" : "FAIL"} recorded run       → ${decided || "no decision in 80 s"}`);
  if (!decided) failures++;
  await ctx.close();
}

await browser.close();
if (failures) {
  console.error(`${failures} e2e failure(s)`);
  process.exit(1);
}
console.log("e2e: all passed");
