#!/usr/bin/env node
// Builds public/calls/<name>.json for the "Hear the real call" player from a Bolna
// execution (scripts/bolna-execution.ts output) and its recording (an audio file
// the owner downloaded from the execution's recording_url into public/calls/).
// Captions are timed by finding each speaker's speech segments in the recording (the
// stereo original when given) and laying that speaker's turns over them in order.
// Bolna removes each channel's silences separately, so the two sides drift apart and a mono
// mix overlaps them: for a clip people will listen to, use scripts/splice-call.mjs instead
// (it builds the English call #2 clip the site plays).
//
//   node scripts/build-call.mjs .data/live/execution-<id>.json public/calls/live-en.wav hero .data/live/smoke-en-2.flac
// WAVs are git-ignored: encode the WAV to MP3 for the site and set CALL_AUDIO=/calls/live-en.mp3.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [execPath, audioPath, name = "hero", timingArg] = process.argv.slice(2);
// Optional 4th argument: the original stereo recording, used only for timing the captions.
const timingPath = timingArg && existsSync(timingArg) ? timingArg : audioPath;
if (!execPath || !audioPath || !existsSync(execPath) || !existsSync(audioPath)) {
  console.error("usage: node scripts/build-call.mjs <execution.json> <public/calls/audio> [name] [stereo-original-for-timing]");
  process.exit(2);
}
const ex = JSON.parse(readFileSync(execPath, "utf8"));
const turns = String(ex.transcript ?? "")
  .split(/\n/)
  .map((l) => l.match(/^(assistant|user):\s*(.*)$/))
  .filter(Boolean)
  .map((m) => ({ role: m[1] === "assistant" ? "agent" : "customer", text: m[2].trim() }))
  .filter((t) => t.text)
  // Merge consecutive lines from the same speaker into one caption.
  .reduce((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.role === t.role) last.text = `${last.text} ${t.text}`;
    else acc.push({ ...t });
    return acc;
  }, []);

const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.goto("about:blank");
// Speech segments per channel. Bolna's recordings are stereo with the customer on channel 0
// and the agent on channel 1, so each side's captions can be timed against its own voice.
const { duration, channels } = await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buf = await new AudioContext().decodeAudioData(bytes.buffer);
  const step = Math.floor(buf.sampleRate / 20);
  const segmentsOf = (d) => {
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
      } else if (start !== null && ++quiet > 8) {
        segs.push([start / 20, (i - quiet) / 20]);
        start = null;
        quiet = 0;
      }
    });
    if (start !== null) segs.push([start / 20, rms.length / 20]);
    return segs.filter(([a, b]) => b - a > 0.25);
  };
  const chans = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(segmentsOf(buf.getChannelData(c)));
  return { duration: buf.duration, channels: chans };
}, readFileSync(timingPath).toString("base64"));
await browser.close();

const words = (t) => t.trim().split(/\s+/).length;
// Lays one speaker's turns over that speaker's speech segments. The turns split the speech
// time between them by word count; a dynamic program picks the cut points, preferring the gaps
// between segments and charging a penalty for cutting through the middle of one.
function layOver(ts, segs) {
  if (!ts.length) return [];
  if (!segs.length) return ts.map((t) => ({ ...t, start: 0, end: 1 }));
  const cum = [];
  let total = 0;
  for (const [a0, b0] of segs) {
    cum.push(total);
    total += b0 - a0;
  }
  const tw = ts.reduce((s, t) => s + words(t.text), 0);
  const want = ts.map((t) => (words(t.text) / tw) * total);
  // Candidate cut points in speech time: segment gaps (free) and every 0.25 s inside a segment.
  const cuts = [{ x: 0, pen: 0 }];
  segs.forEach(([a0, b0], i) => {
    for (let x = cum[i] + 0.25; x < cum[i] + (b0 - a0) - 0.1; x += 0.25) cuts.push({ x, pen: 6 });
    cuts.push({ x: cum[i] + (b0 - a0), pen: 0 });
  });
  const m = ts.length;
  const n = cuts.length - 1;
  const cost = Array.from({ length: m + 1 }, () => Array(n + 1).fill(Infinity));
  const from = Array.from({ length: m + 1 }, () => Array(n + 1).fill(-1));
  cost[0][0] = 0;
  for (let k = 1; k <= m; k++)
    for (let j = 1; j <= n; j++) {
      if (k === m && j !== n) continue;
      for (let i = 0; i < j; i++) {
        if (cost[k - 1][i] === Infinity) continue;
        const c = cost[k - 1][i] + (cuts[j].x - cuts[i].x - want[k - 1]) ** 2 + (k < m ? cuts[j].pen : 0);
        if (c < cost[k][j]) {
          cost[k][j] = c;
          from[k][j] = i;
        }
      }
    }
  const absStart = (x) => {
    const i = Math.max(0, cum.findLastIndex((c, idx) => c <= x + 1e-6 && x < c + (segs[idx][1] - segs[idx][0]) - 1e-6));
    return segs[i][0] + (x - cum[i]);
  };
  const absEnd = (x) => {
    const i = Math.max(0, cum.findIndex((c, idx) => x > c + 1e-6 && x <= c + (segs[idx][1] - segs[idx][0]) + 1e-6));
    return segs[i][0] + (x - cum[i]);
  };
  const idx = [];
  for (let k = m, j = n; k > 0; k--) {
    idx.unshift([from[k][j], j]);
    j = from[k][j];
  }
  return ts.map((t, k) => ({ ...t, start: absStart(cuts[idx[k][0]].x), end: absEnd(cuts[idx[k][1]].x) }));
}

const stereo = channels.length >= 2;
const indexed = turns.map((t, i) => ({ ...t, i }));
const laid = stereo
  ? [...layOver(indexed.filter((t) => t.role === "customer"), channels[0]), ...layOver(indexed.filter((t) => t.role === "agent"), channels[1])]
  : layOver(indexed, channels[0] ?? []);
// Captions stay in Bolna's transcript order; only the highlight timing comes from the audio.
const out = laid
  .sort((x, y) => x.i - y.i)
  .map(({ i: _i, ...t }) => ({ ...t, start: +t.start.toFixed(2), end: +Math.max(t.end, t.start + 1).toFixed(2) }));
const segments = channels.flat();
if (process.env.DEBUG_SEGS) console.log(JSON.stringify(channels));

const file = `public/calls/${name}.json`;
writeFileSync(
  file,
  JSON.stringify(
    {
      title: process.env.CALL_TITLE ?? `A real Ruko call on Bolna (${name})`,
      // CALL_AUDIO=none publishes the transcript without the recording (e.g. a customer voice we
      // may not redistribute); CALL_AUDIO=/calls/x.mp3 points at the encoded file the site serves.
      audio: process.env.CALL_AUDIO === "none" ? undefined : (process.env.CALL_AUDIO ?? `/calls/${audioPath.split(/[\\/]/).pop()}`),
      duration_s: Math.round(duration),
      // The call's real length; Bolna's recording leaves out silences, so duration_s is shorter.
      call_s: typeof ex.conversation_duration === "number" ? ex.conversation_duration : undefined,
      execution_id: ex.id,
      recorded_at: ex.created_at ?? new Date().toISOString(),
      cost_cents: typeof ex.total_cost === "number" ? ex.total_cost : undefined,
      note: "Customer: a scripted text-to-speech voice, not a real person. Ruko: the live Bolna agent.",
      // What went wrong or is worth knowing about this particular take, in plain words.
      detail: process.env.CALL_DETAIL || undefined,
      timing: "Transcript from Bolna. The highlight is timed to Bolna's recording, which leaves out silences, so it is approximate.",
      turns: out,
    },
    null,
    1,
  ),
);
console.log(`wrote ${file}: ${out.length} captions over ${duration.toFixed(1)} s (${segments.length} speech segments)`);
