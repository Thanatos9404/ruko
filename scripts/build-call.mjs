#!/usr/bin/env node
// Builds public/calls/<name>.json for the "Hear the real call" player from a Bolna
// execution (scripts/bolna-execution.ts output) and its recording (an audio file
// the owner downloaded from the execution's recording_url into public/calls/).
// Captions are timed by finding the speech segments in the recording and laying
// the transcript's turns over them in order, sized by word count.
//
//   node scripts/build-call.mjs .data/live/execution-hero-en-<id>.json public/calls/hero.mp3 hero
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [execPath, audioPath, name = "hero"] = process.argv.slice(2);
if (!execPath || !audioPath || !existsSync(execPath) || !existsSync(audioPath)) {
  console.error("usage: node scripts/build-call.mjs <execution.json> <public/calls/audio> [name]");
  process.exit(2);
}
const ex = JSON.parse(readFileSync(execPath, "utf8"));
const turns = String(ex.transcript ?? "")
  .split(/\n/)
  .map((l) => l.match(/^(assistant|user):\s*(.*)$/))
  .filter(Boolean)
  .map((m) => ({ role: m[1] === "assistant" ? "agent" : "customer", text: m[2].trim() }))
  .filter((t) => t.text && !/^(Okay\.?)$/i.test(t.text))
  // Merge consecutive lines from the same speaker into one caption.
  .reduce((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.role === t.role) last.text = `${last.text} ${t.text}`;
    else acc.push({ ...t });
    return acc;
  }, []);

const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.goto("about:blank");
const { duration, segments } = await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buf = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bytes.buffer);
  const d = buf.getChannelData(0);
  const step = Math.floor(buf.sampleRate / 20);
  const rms = [];
  for (let i = 0; i < d.length; i += step) {
    let s = 0;
    for (let j = i; j < Math.min(d.length, i + step); j++) s += d[j] * d[j];
    rms.push(Math.sqrt(s / step));
  }
  const thr = Math.max(0.01, [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.3)] * 3);
  const segs = [];
  let start = null;
  let quiet = 0;
  rms.forEach((v, i) => {
    if (v > thr) {
      if (start === null) start = i;
      quiet = 0;
    } else if (start !== null && ++quiet > 14) {
      segs.push([start / 20, (i - quiet) / 20]);
      start = null;
      quiet = 0;
    }
  });
  if (start !== null) segs.push([start / 20, rms.length / 20]);
  return { duration: buf.duration, segments: segs.filter(([a, b]) => b - a > 0.3) };
}, readFileSync(audioPath).toString("base64"));
await browser.close();

// Lay turns over the speech segments in order, giving each turn a share of segments by word count.
const words = (t) => t.split(/\s+/).length;
const totalSpeech = segments.reduce((s, [a, b]) => s + (b - a), 0) || duration;
const totalWords = turns.reduce((s, t) => s + words(t.text), 0) || 1;
const out = [];
let seg = 0;
let cursor = segments[0]?.[0] ?? 0;
for (const t of turns) {
  let need = (words(t.text) / totalWords) * totalSpeech;
  const start = Math.max(cursor, segments[seg]?.[0] ?? cursor);
  let end = start;
  while (need > 0 && seg < segments.length) {
    const [a, b] = segments[seg];
    const from = Math.max(a, end);
    const take = Math.min(need, b - from);
    end = from + take;
    need -= take;
    if (end >= b - 0.01) seg++;
  }
  cursor = end;
  out.push({ ...t, start: +start.toFixed(2), end: +Math.max(end, start + 1).toFixed(2) });
}

const file = `public/calls/${name}.json`;
writeFileSync(
  file,
  JSON.stringify(
    {
      title: name === "hero" ? "A real Ruko call on Bolna: a coached 'digital arrest' victim" : `A real Ruko call (${name})`,
      audio: `/calls/${audioPath.split(/[\\/]/).pop()}`,
      duration_s: Math.round(duration),
      execution_id: ex.id,
      recorded_at: ex.created_at ?? new Date().toISOString(),
      cost_cents: typeof ex.total_cost === "number" ? ex.total_cost : undefined,
      note: "The customer is a scripted text-to-speech voice; Ruko is the live Bolna agent. Captions are Bolna's transcript, timed to the recording.",
      turns: out,
    },
    null,
    1,
  ),
);
console.log(`wrote ${file}: ${out.length} captions over ${duration.toFixed(1)} s (${segments.length} speech segments)`);
