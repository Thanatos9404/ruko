#!/usr/bin/env node
// Builds the English "Hear a real call" clip (public/calls/live-en.mp3 + hero.json) from Bolna's
// own recording of live call #2 (execution b6818362, 23 Oct 2026; scripted text-to-speech customer).
//
// Bolna's recording is stereo (customer left, agent right) and Bolna removed each side's silences
// separately, so the two channels drift apart: mixed to mono, the voices overlap from about 13 s.
// So each utterance is cut out unchanged from its own channel, and the utterances are laid end to
// end in the order of Bolna's transcript with a short gap. The search windows below were found with
// word timings on each channel and checked against the transcript (the same cuts as the demo video).
// Bolna's recording ends before the agent's last line, so that line is a caption marked as being in
// Bolna's transcript but not in its recording.
//
//   FFMPEG=<path to ffmpeg> node scripts/splice-call.mjs .data/live/smoke-en-2.flac \
//     .data/live/execution-smoke-en-2-b6818362-8118-49fd-8f76-146432254c27.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [flac, execPath] = process.argv.slice(2);
if (!flac || !existsSync(flac) || !execPath || !existsSync(execPath)) {
  console.error("usage: FFMPEG=<ffmpeg> node scripts/splice-call.mjs <smoke-en-2.flac> <execution.json>");
  process.exit(2);
}
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SR = 48000;
const GAP = 0.42; // silence between turns (Bolna's file has none between one side's own utterances)
const LEAD = 0.25;
const TAIL = 0.5;

// (role, search window in seconds of the FLAC, [caption text from Bolna's transcript, split time or null])
// A split time divides one utterance into two captions.
const CALL_EN = [
  ["agent", [0.3, 9.4], [["Hi Kamla, Ruko here, Demo Bank's automated safety line, on a recorded call.", 5.62], ["Your code word is BADAL 84. Does it match your app?", null]]],
  ["customer", [9.2, 12.5], [["yes", null]]],
  ["agent", [11.5, 17.82], [["Okay. Your app shows you were on a call while paying.", 15.2], ["What's this payment for, and who were you speaking with?", null]]],
  ["customer", [12.6, 18.2], [["it's for my nephew's college fees", null]]],
  ["agent", [17.84, 24.0], [["Just give me a moment, I'll be back with you.", 20.05], ["Has someone said RBI is holding money, a prize or a payout for you?", null]]],
  ["customer", [18.3, 24.6], [["actually", 20.7], ["acbi officer is on a video call with me", null]]],
  ["agent", [24.6, 28.0], [["Just give me a moment, I'll be back with you.", null]]],
  ["customer", [24.7, 31.3], [["and i must move my savings to a safe custody account", null]]],
];
// In Bolna's transcript after the last recorded turn, but not in its recording.
const NOT_RECORDED = [
  "For your safety, this payment is stopped. Your money is safe in your account. Shall I call Ravi, your son, so you can talk it over?",
  "Hello? Are you there?",
];

const dec = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", flac, "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
if (dec.status !== 0) throw new Error(`ffmpeg decode failed: ${dec.stderr}`);
const inter = new Float32Array(dec.stdout.buffer, dec.stdout.byteOffset, dec.stdout.byteLength / 4);
const chan = { customer: new Float32Array(inter.length / 2), agent: new Float32Array(inter.length / 2) };
for (let i = 0; i < chan.agent.length; i++) {
  chan.customer[i] = inter[2 * i];
  chan.agent[i] = inter[2 * i + 1];
}

const HOP = SR / 100;
const frameDb = (x) => {
  const n = Math.floor(x.length / HOP);
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let j = k * HOP; j < (k + 1) * HOP; j++) s += x[j] * x[j];
    out[k] = 20 * Math.log10(Math.sqrt(s / HOP) + 1e-9);
  }
  return out;
};

const pieces = [new Float32Array(Math.round(LEAD * SR))];
const segments = [];
const turns = [];
let t = LEAD;
CALL_EN.forEach(([role, [w0, w1], parts], i) => {
  const x = chan[role];
  const db = frameDb(x.subarray(Math.round(w0 * SR), Math.round(w1 * SR)));
  const act = [...db.keys()].filter((k) => db[k] > -52);
  if (!act.length) throw new Error(`no speech in ${role} window ${w0}-${w1}`);
  const s0 = Math.max(w0, w0 + act[0] / 100 - 0.1);
  const s1 = Math.min(w1, w0 + (act[act.length - 1] + 1) / 100 + 0.16);
  const clip = x.slice(Math.round(s0 * SR), Math.round(s1 * SR));
  const r = Math.round(0.012 * SR); // 12 ms fades at the cut points
  for (let j = 0; j < r; j++) {
    clip[j] *= j / r;
    clip[clip.length - 1 - j] *= j / r;
  }
  if (i) {
    pieces.push(new Float32Array(Math.round(GAP * SR)));
    t += GAP;
  }
  const start = t;
  const dur = clip.length / SR;
  segments.push({ role, start: +start.toFixed(3), end: +(start + dur).toFixed(3), source: [+s0.toFixed(3), +s1.toFixed(3)] });
  let cs = start;
  for (const [text, split] of parts) {
    const ce = split !== null ? start + (split - s0) : start + dur;
    turns.push({ role, text, start: +cs.toFixed(2), end: +ce.toFixed(2) });
    cs = ce;
  }
  pieces.push(clip);
  t += dur;
});
pieces.push(new Float32Array(Math.round(TAIL * SR)));
const total = pieces.reduce((s, p) => s + p.length, 0);
const audio = new Float32Array(total);
let off = 0;
for (const p of pieces) {
  audio.set(p, off);
  off += p.length;
}

// Balance the two sides on speech frames, then peak-normalise to -1 dBFS.
const speechDb = (role) => {
  let sum = 0;
  let n = 0;
  for (const s of segments.filter((x) => x.role === role))
    for (const v of frameDb(audio.subarray(Math.round(s.start * SR), Math.round(s.end * SR))))
      if (v > -45) {
        sum += 10 ** (v / 10);
        n++;
      }
  return 10 * Math.log10(sum / Math.max(1, n));
};
const gainC = 10 ** ((speechDb("agent") - speechDb("customer")) / 20);
for (const s of segments.filter((x) => x.role === "customer")) for (let i = Math.round(s.start * SR); i < Math.round(s.end * SR); i++) audio[i] *= gainC;
let peak = 0;
for (const v of audio) peak = Math.max(peak, Math.abs(v));
if (peak > 0) for (let i = 0; i < audio.length; i++) audio[i] *= 0.89 / peak;

const out = "public/calls/live-en.mp3";
const enc = spawnSync(
  FFMPEG,
  ["-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", "-metadata", "title=Ruko live call #2 (English). Customer: scripted TTS. Silences removed by Bolna; turns in transcript order.", out],
  { input: Buffer.from(audio.buffer) },
);
if (enc.status !== 0) throw new Error(`ffmpeg encode failed: ${enc.stderr}`);

const ex = JSON.parse(readFileSync(execPath, "utf8"));
const duration = total / SR;
const call = {
  title: "English: a coached 'digital arrest' victim, payment blocked",
  audio: "/calls/live-en.mp3",
  audio_label: "silences removed by Bolna; turns in transcript order",
  duration_s: +duration.toFixed(2),
  call_s: ex.conversation_duration,
  execution_id: ex.id,
  recorded_at: ex.created_at,
  cost_cents: ex.total_cost,
  note: "Customer: a scripted text-to-speech voice, not a real person. Ruko: the live Bolna agent.",
  detail:
    "Our second test call (23 Oct). The customer admits a 'CBI officer' is on a video call with her. Bolna's transcript then has Ruko stop the payment and offer to call her son, but Bolna's recording ends before that line, so it is shown as text only. The call still has Bolna's default filler line ('Just give me a moment…'), which we have since replaced.",
  timing:
    "Bolna records the customer and Ruko on separate channels and removes each side's silences separately, so the two drift apart. Each turn here is cut unchanged from its own channel and played in the order of Bolna's transcript, with a short gap.",
  segments,
  turns: [...turns, ...NOT_RECORDED.map((text) => ({ role: "agent", text, start: +duration.toFixed(2), end: +duration.toFixed(2), in_recording: false }))],
};
writeFileSync("public/calls/hero.json", JSON.stringify(call, null, 1) + "\n");
const speech = segments.reduce((s, x) => s + (x.end - x.start), 0);
console.log(
  `wrote ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB, ${duration.toFixed(2)} s = ${speech.toFixed(2)} s of turns + ${(GAP * (segments.length - 1)).toFixed(2)} s gaps + ${LEAD + TAIL} s lead/tail; customer gain x${gainC.toFixed(2)}) and public/calls/hero.json (${call.turns.length} captions)`,
);
