#!/usr/bin/env node
// ONE real Bolna web call from the deployed demo, recorded (screen + both voices).
// This spends Bolna credit (about $0.06/min): run it deliberately, once, and log it
// in docs/BOLNA_SPEND.md.
//
// The customer is a scripted text-to-speech voice (Windows SAPI, generated into
// .data/tts/), injected as the microphone. Ruko is the live Bolna agent. A clip
// plays each time the agent finishes speaking (1.3 s of silence), and the script
// follows the real engine: after a decision with a contact offer it says yes.
//
//   node scripts/live-call.mjs https://ruko-symphony.vercel.app
//   node scripts/live-call.mjs http://localhost:5410 --dry   # recorded run instead: tests recording, spends nothing
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const dry = process.argv.includes("--dry");
if (!/^https?:\/\//.test(base) || (!dry && !base.startsWith("https://"))) throw new Error("usage: node scripts/live-call.mjs https://<deployment> [--dry]");
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const code = env.RUKO_ACCESS_CODE_USER ?? (env.RUKO_ACCESS_CODES ?? "").split(",")[0]?.split(":")[0];
if (!code) throw new Error("RUKO_ACCESS_CODES missing in .env");

const clip = (name) => readFileSync(`.data/tts/${name}.wav`).toString("base64");
const CLIPS = {
  match: clip("c1_match"),
  story: clip("c2_story"),
  still: clip("c3_still"),
  more: clip("c4_more"),
  consent: clip("c5_consent"),
  thanks: clip("c6_thanks"),
};

const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  defaultViewport: { width: 1440, height: 900 },
  args: ["--window-size=1460,1000", "--use-fake-ui-for-media-stream", "--auto-accept-this-tab-capture", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[ruko-call]")) console.log(t);
});

await page.evaluateOnNewDocument(
  (clips, accessCode) => {
    try {
      sessionStorage.setItem("ruko.access", accessCode);
    } catch {
      /* ignore */
    }
    const log = (...a) => console.log("[ruko-call]", ...a);
    const ctx = new AudioContext();
    const customerBus = ctx.createGain();
    customerBus.connect(ctx.destination); // so the tab recording hears the customer too
    const recordBus = ctx.createMediaStreamDestination(); // both voices, for a clean audio file
    customerBus.connect(recordBus);
    const buffers = {};
    const ready = Promise.all(
      Object.entries(clips).map(async ([k, b64]) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        buffers[k] = await ctx.decodeAudioData(bytes.buffer);
      }),
    );

    // The microphone is the scripted customer: every getUserMedia gets a fresh track fed by the same bus.
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      if (c && c.audio && !c.video) {
        await ctx.resume();
        const d = ctx.createMediaStreamDestination();
        customerBus.connect(d);
        return d.stream;
      }
      return realGUM(c);
    };

    // Tap the agent's audio (the SDK attaches it to an <audio> element) for turn-taking and recording.
    let agentLevel = 0;
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject");
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      get() {
        return desc.get.call(this);
      },
      set(v) {
        desc.set.call(this, v);
        if (v && v.getAudioTracks && v.getAudioTracks().length) {
          const src = ctx.createMediaStreamSource(v);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          src.connect(an);
          src.connect(recordBus);
          const buf = new Uint8Array(an.fftSize);
          setInterval(() => {
            an.getByteTimeDomainData(buf);
            let s = 0;
            for (const b of buf) s += ((b - 128) / 128) ** 2;
            agentLevel = Math.sqrt(s / buf.length);
          }, 50);
          log("agent audio attached");
        }
      },
    });

    // Follow the real engine's status, as the page polls it.
    let status = null;
    const realFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const r = await realFetch(...args);
      try {
        const url = String(args[0] instanceof Request ? args[0].url : args[0]);
        if (/\/api\/demo\/checks\/[^/]+$/.test(url.split("?")[0]) && r.ok) r.clone().json().then((j) => (status = j)).catch(() => {});
      } catch {
        /* ignore */
      }
      return r;
    };

    const play = async (k) => {
      await ready;
      const s = ctx.createBufferSource();
      s.buffer = buffers[k];
      s.connect(customerBus);
      s.start();
      log(`customer says: ${k}`);
      await new Promise((r) => (s.onended = r));
    };

    // Turn-taking: answer after the agent has spoken and then been quiet for 1.3 s.
    const queue = ["match", "story", "still", "more"];
    let saidConsent = false;
    let done = false;
    window.__rukoCall = { get status() { return status; }, get done() { return done; } };
    (async () => {
      await ready;
      let spoke = false;
      let quietSince = 0;
      let busy = false;
      for (;;) {
        await new Promise((r) => setTimeout(r, 100));
        if (busy || done) continue;
        const loud = agentLevel > 0.02;
        if (loud) {
          spoke = true;
          quietSince = 0;
          continue;
        }
        if (!spoke) continue;
        if (!quietSince) quietSince = Date.now();
        if (Date.now() - quietSince < 1300) continue;
        spoke = false;
        quietSince = 0;
        busy = true;
        const decided = Boolean(status && status.decision);
        let next = null;
        if (decided && !saidConsent && status.contact?.status !== "consent_declined") {
          next = "consent";
          saidConsent = true;
        } else if (decided && saidConsent) {
          next = "thanks";
          done = true;
        } else next = queue.shift() ?? null;
        if (next) await play(next);
        busy = false;
      }
    })();

    // Recording: the whole tab (video + tab audio) and, separately, both voices.
    window.__rukoRec = { chunks: [], audio: [] };
    document.addEventListener("DOMContentLoaded", () => {
      const b = document.createElement("button");
      b.id = "__ruko_rec";
      b.textContent = "rec";
      b.style.cssText = "position:fixed;left:0;bottom:0;width:6px;height:6px;opacity:0.01;z-index:2147483647;border:0;padding:0";
      b.onclick = async () => {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: "include" });
        const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus", videoBitsPerSecond: 2_500_000 });
        rec.ondataavailable = (e) => e.data.size && window.__rukoRec.chunks.push(e.data);
        rec.start(1000);
        const arec = new MediaRecorder(recordBus.stream, { mimeType: "audio/webm;codecs=opus" });
        arec.ondataavailable = (e) => e.data.size && window.__rukoRec.audio.push(e.data);
        arec.start(1000);
        window.__rukoRec.stop = () =>
          Promise.all([
            new Promise((r) => ((rec.onstop = r), rec.stop())),
            new Promise((r) => ((arec.onstop = r), arec.stop())),
          ]).then(() => stream.getTracks().forEach((t) => t.stop()));
        log("recording");
      };
      document.body.appendChild(b);
    });
  },
  CLIPS,
  code,
);

const clickText = (t) =>
  page.evaluate((text) => {
    const el = [...document.querySelectorAll("button")].find((e) => e.textContent?.trim().includes(text));
    el?.click();
    return Boolean(el);
  }, t);

await page.goto(`${base}/demo`, { waitUntil: "load", timeout: 60000 });
await sleep(2500);
await page.click("#__ruko_rec"); // a trusted click, so tab capture is allowed
await sleep(1500);
await clickText("Pay ₹1,90,000");
const button = dry ? "Watch the recorded run" : "Answer the call";
for (let i = 0; i < 20 && !(await clickText(button)); i++) await sleep(500);
console.log(dry ? "[ruko-call] dry run: recorded run playing (no Bolna call)" : "[ruko-call] answered; live call starting");
const t0 = Date.now();
let final = null;
while (Date.now() - t0 < 150_000) {
  await sleep(2000);
  const st = await page.evaluate(() => ({ status: window.__rukoCall?.status ?? null, done: window.__rukoCall?.done ?? false }));
  final = st.status;
  const phone = await page.evaluate(() => document.querySelector('[aria-label="Sandbox bank app"]')?.textContent ?? "");
  if ((st.done || dry) && /Payment stopped|Payment on hold|Payment sent/.test(phone)) {
    await sleep(6000);
    break;
  }
}
await clickText("End call").catch(() => false);
await page.evaluate(() => document.querySelector('[aria-label="End call"]')?.click());
await sleep(3000);
await page.evaluate(() => window.__rukoRec.stop?.());
await sleep(1500);
const files = await page.evaluate(async () => {
  const toB64 = async (parts, type) => {
    const buf = new Uint8Array(await new Blob(parts, { type }).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  return { video: await toB64(window.__rukoRec.chunks, "video/webm"), audio: await toB64(window.__rukoRec.audio, "audio/webm") };
});
mkdirSync(".data/live", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`.data/live/call-${stamp}.webm`, Buffer.from(files.video, "base64"));
writeFileSync(`.data/live/call-${stamp}-audio.webm`, Buffer.from(files.audio, "base64"));
writeFileSync(
  `.data/live/call-${stamp}.json`,
  JSON.stringify({ check_id: final?.id ?? null, run_id: final?.call?.execution_id ?? null, decision: final?.decision ?? null, contact: final?.contact ?? null }, null, 2),
);
console.log(`[ruko-call] saved .data/live/call-${stamp}.webm (+ -audio.webm, .json); decision=${final?.decision?.outcome ?? "none"}`);
await browser.close();
