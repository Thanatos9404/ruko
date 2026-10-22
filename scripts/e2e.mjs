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
  await page.goto(`${base}/demo`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("[role=radio]");
  await sleep(500);
  if (!(await clickText(page, sc.title))) console.error(`no chip for ${sc.title}`);
  await sleep(400);
  const amount = new Intl.NumberFormat("en-IN").format(sc.payment.amount_inr);
  if (!(await clickText(page, `Pay ₹${amount}`))) console.error(`no pay button for ${sc.id}`);
  // Up to 10 s: a serverless cold start can add a few seconds to the first payment.
  let text = "";
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    text = await phoneText(page);
    if (/Payment paused|Payment sent|Too many|slow down/.test(text)) break;
  }
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
  await page.goto(`${base}/demo`, { waitUntil: "load", timeout: 60000 });
  await sleep(800);
  await clickText(page, "Pay ₹1,90,000");
  await sleep(2500);
  await clickText(page, "Watch the recorded run");
  // The engine panel must show the risk decision while the phone is on hold.
  const panelAtHold = await page.evaluate(() => document.querySelector('[aria-label="Ruko engine"]')?.textContent ?? "");
  const riskShown = /Pre-payment risk/.test(panelAtHold) && /always holds|First payment|On a call while paying/.test(panelAtHold) && /HOLD/.test(panelAtHold);
  console.log(`${riskShown ? "PASS" : "FAIL"} risk card at hold  → ${riskShown ? "score, rules and HOLD shown" : panelAtHold.slice(0, 120)}`);
  if (!riskShown) failures++;
  await clickText(page, "Watch the recorded run");
  let decided = "";
  let resets = 0;
  for (let i = 0; i < 45 && !decided; i++) {
    await sleep(2000);
    const t = await phoneText(page);
    if (/Pay ₹1,90,000/.test(t)) resets++;
    decided = /Payment stopped/.test(t) ? "block" : /Payment on hold/.test(t) ? "delay" : /Payment sent/.test(t) ? "release" : "";
  }
  const phone = await phoneText(page);
  const panel = await page.evaluate(() => document.querySelector('[aria-label="Ruko engine"]')?.textContent ?? "");
  const blocked = decided === "block" && /Why|WHY/.test(phone) && /warning sign/i.test(phone) && /Policy: BLOCK/.test(panel) && /Digital arrest/.test(phone);
  console.log(`${blocked ? "PASS" : "FAIL"} recorded run       → ${decided || "no decision in 90 s"}${blocked ? " (Blocked screen with reasons, pattern and policy row)" : ""}${resets ? ` [page reset ${resets}x]` : ""}`);
  if (!blocked) failures++;
  await ctx.close();
}

// The landing page's embedded demo: chips and a ready Pay screen, with no waiting on the API.
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => document.getElementById("demo")?.scrollIntoView());
  await sleep(1200);
  const embed = await page.evaluate(() => {
    const root = document.getElementById("demo");
    const chips = root?.querySelectorAll('[role=radiogroup][aria-label=Scenario] [role=radio]').length ?? 0;
    const phone = root?.querySelector('[aria-label="Sandbox bank app"]')?.textContent ?? "";
    return { chips, ready: /Pay ₹1,90,000/.test(phone) };
  });
  const ok = embed.chips >= 3 && embed.ready;
  console.log(`${ok ? "PASS" : "FAIL"} landing embed      → ${embed.chips} chips, ${embed.ready ? "CBI scenario ready to pay" : "phone not ready"}`);
  if (!ok) failures++;
  if (ok) {
    await clickText(page, "Pay ₹1,90,000");
    await sleep(2500);
    const held = /Payment paused/.test(await phoneText(page));
    console.log(`${held ? "PASS" : "FAIL"} landing embed pay  → ${held ? "held" : "no hold screen"}`);
    if (!held) failures++;
  }
  await ctx.close();
}

async function phoneWidth(route) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await page.goto(`${base}${route}`, { waitUntil: "load" });
  await sleep(1500);
  if (route === "/") {
    await sleep(700);
    const hero = await page.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        let o = 1;
        for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return r.width > 0 && r.top < innerHeight && r.bottom > 0 && o > 0.6;
      };
      const h1 = document.querySelector("h1");
      const cta = document.querySelector('#top a[href="#demo"]');
      return { h1: vis(h1), cta: vis(cta) };
    });
    const ok = hero.h1 && hero.cta;
    console.log(`${ok ? "PASS" : "FAIL"} hero at 375        → headline ${hero.h1 ? "visible" : "hidden"}, CTA ${hero.cta ? "visible" : "hidden"} after 0.7 s`);
    if (!ok) failures++;
  }
  // Scroll through so in-view content mounts, then measure.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(120);
  }
  await sleep(500);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    // Report the innermost overflowing elements, ignoring fixed layers and anything inside a scroller.
    const over = (e) => {
      const r = e.getBoundingClientRect();
      return r.right > vw + 1 && r.width > 0;
    };
    const wide = [...document.querySelectorAll("body *")]
      .filter((e) => over(e) && ![...e.children].some(over))
      .filter((e) => {
        for (let n = e; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.position === "fixed") return false;
          if (n !== e && ["auto", "scroll", "hidden", "clip"].includes(cs.overflowX)) return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`);
    return { vw, sw, wide };
  });
  const ok = m.sw <= m.vw;
  console.log(`${ok ? "PASS" : "FAIL"} 375 ${route.padEnd(16)} → scrollWidth ${m.sw} / ${m.vw}${ok ? "" : ` (${m.wide.join(", ")})`}`);
  if (!ok) failures++;
  await ctx.close();
}

// Phone width: no horizontal scroll on any route, and the hero's headline and CTAs show at once.
// One retry: on a dev server, a hot reload can destroy the page mid-check.
for (const route of ["/", "/demo", "/check", "/console", "/console/reports", "/console/eval", "/console/library", "/console/integration", "/contact/demo"]) {
  try {
    await phoneWidth(route);
  } catch (e) {
    if (!/context was destroyed|detached|Target closed/i.test(String(e))) throw e;
    await phoneWidth(route);
  }
}

await browser.close();
if (failures) {
  console.error(`${failures} e2e failure(s)`);
  process.exit(1);
}
console.log("e2e: all passed");
