#!/usr/bin/env node
// Converts a Bolna recording (FLAC, stereo: customer and agent on separate channels) to a
// mono 22.05 kHz WAV for the web player, using the browser's decoder (no ffmpeg needed).
//   node scripts/to-mono-wav.mjs public/calls/hero-hi.flac public/calls/hero-hi.wav
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [src, dst] = process.argv.slice(2);
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.goto("about:blank");
const b64 = await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const decoded = await new AudioContext().decodeAudioData(bytes.buffer);
  const rate = 22050;
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const s = off.createBufferSource();
  s.buffer = decoded;
  s.connect(off.destination); // downmixes both channels to mono
  s.start();
  const out = (await off.startRendering()).getChannelData(0);
  // Normalise to -1 dBFS so both voices are comfortably loud.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1;
  const buf = new ArrayBuffer(44 + out.length * 2);
  const dv = new DataView(buf);
  const w = (o, t) => [...t].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  dv.setUint32(4, 36 + out.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, "data");
  dv.setUint32(40, out.length * 2, true);
  for (let i = 0; i < out.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i] * gain)) * 0x7fff, true);
  let bin = "";
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}, readFileSync(src).toString("base64"));
await browser.close();
writeFileSync(dst, Buffer.from(b64, "base64"));
console.log(`wrote ${dst} (${(Buffer.from(b64, "base64").length / 1024).toFixed(0)} KB)`);
