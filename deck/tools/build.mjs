#!/usr/bin/env node
/**
 * Builds the pitch deck from the eval results.
 *
 *   node deck/tools/build.mjs            # fill numbers, then print deck/Ruko-pitch.pdf
 *   node deck/tools/build.mjs --no-pdf   # fill numbers only
 *
 * 1. Reads deck/results.config.json and the results it points at:
 *    - source "runs":   eval/results/<run>/summary.json for the dev and held-out runs
 *    - source "public": public/eval/results.json (what eval/publish.ts publishes)
 * 2. Rewrites every <!--r:key-->...<!--/r--> marker in deck/index.html and
 *    docs/PITCH.md. Unknown keys stop the build, so nothing is left stale.
 * 3. Prints the deck to deck/Ruko-pitch.pdf with headless Chrome (16:9, one slide a page).
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DECK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(DECK, "..");
const cfg = JSON.parse(readFileSync(join(DECK, "results.config.json"), "utf8"));
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// ---------- load and normalise ----------
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function fromSummary(s) {
  const h = s.headline;
  return {
    run_id: s.run_id,
    generated_at: s.generated_at,
    scenarios: s.counts.scenarios,
    catch: h.scam_catch_rate,
    block: h.scam_block_rate,
    fh: h.false_hold_rate_genuine,
    otp: h.otp_pin_requests.confirmed,
    turns: h.otp_pin_requests.agent_turns,
    median_s: h.median_est_seconds_to_decision,
    heavy: s.detail.by_coaching.heavy,
    e2e: s.end_to_end.scam_caught,
    precall_missed: s.end_to_end.scam_missed_by_precall,
  };
}

function fromPublic(c, published) {
  return {
    run_id: c.run_id,
    generated_at: published,
    scenarios: c.scenarios,
    catch: c.scam_catch,
    block: c.scam_block,
    fh: c.false_hold,
    otp: c.otp_requests,
    turns: c.agent_turns,
    median_s: c.median_seconds,
    heavy: c.heavy_catch,
    e2e: c.e2e_scam_caught,
    precall_missed: c.e2e_scam_caught ? null : null,
  };
}

let dev, ho, sourceLine, version;
if (cfg.source === "public") {
  const pub = readJson("public/eval/results.json");
  const pick = (want, fallback) => pub.current.find((c) => c.run_id === want.run) ?? pub.current.find(fallback);
  const d = pick(cfg.dev, (c) => c.set === "dev");
  const h = pick(cfg.holdout, (c) => c.clean_holdout);
  if (!d || !h) throw new Error("public/eval/results.json has no dev run or no clean held-out run");
  dev = fromPublic(d, pub.generated_at);
  ho = fromPublic(h, pub.generated_at);
  version = pub.version;
  sourceLine = `Source: public/eval/results.json (${pub.version}, published ${day(pub.generated_at)}): runs ${d.run_id} and ${h.run_id}. 95% Wilson intervals.`;
} else {
  dev = fromSummary({ run_id: cfg.dev.run, ...readJson(`eval/results/${cfg.dev.run}/summary.json`) });
  ho = fromSummary({ run_id: cfg.holdout.run, ...readJson(`eval/results/${cfg.holdout.run}/summary.json`) });
  version = cfg.version;
  sourceLine = `Source: eval/results/${dev.run_id} and eval/results/${ho.run_id} (generated ${day(ho.generated_at)}); report.md in each. 95% Wilson intervals.`;
}
const lat = existsSync(join(ROOT, cfg.latency_file)) ? readJson(cfg.latency_file) : null;
if (lat) sourceLine += ` Tool latency: ${lat.n} calls, ${lat.where}, ${day(lat.measured_at)}.`;

// ---------- formatting ----------
function day(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
const pct = (r) => {
  const v = r * 100;
  return `${Number.isInteger(Math.round(v * 10) / 10) ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}%`;
};
const ci = (r) => `${Math.round(r.ci95[0] * 100)}–${Math.round(r.ci95[1] * 100)}%`;
const frac = (r) => `${r.k}/${r.n}`;
const secs = (s) => (s == null ? "–" : String(Math.round(s)));

function otpText(m, note) {
  if (!m.otp) return `0 of ${m.turns} agent turns asked for an OTP, PIN, card or account number`;
  const base = `${m.otp} of ${m.turns} agent turns flagged by the judge`;
  return note ? `${base}: ${note}` : base;
}

const values = { version, source_line: sourceLine, failure_note: cfg.failure_note, false_hold_note: cfg.false_hold_note };
for (const [p, m, c] of [["dev", dev, cfg.dev], ["ho", ho, cfg.holdout]]) {
  Object.assign(values, {
    [`${p}.label`]: c.label,
    [`${p}.note`]: c.note,
    [`${p}.run`]: m.run_id,
    [`${p}.scenarios`]: String(m.scenarios),
    [`${p}.catch`]: frac(m.catch),
    [`${p}.catch_pct`]: pct(m.catch.rate),
    [`${p}.catch_ci`]: ci(m.catch),
    [`${p}.block`]: frac(m.block),
    [`${p}.fh`]: frac(m.fh),
    [`${p}.fh_pct`]: pct(m.fh.rate),
    [`${p}.fh_ci`]: ci(m.fh),
    [`${p}.otp`]: `${m.otp} of ${m.turns}`,
    [`${p}.otp_text`]: otpText(m, p === "dev" ? cfg.otp_note_dev : cfg.otp_note_holdout),
    [`${p}.median_s`]: secs(m.median_s),
    [`${p}.heavy`]: frac(m.heavy),
    [`${p}.e2e`]: frac(m.e2e),
    [`${p}.precall_missed`]: m.precall_missed == null ? "–" : String(m.precall_missed),
  });
}
values["otp.turns_total"] = String(dev.turns + ho.turns);
values["lat.p50"] = lat ? String(lat.p50) : "–";
values["lat.p95"] = lat ? String(lat.p95) : "–";
values["live.made"] = String(cfg.live_calls.made);
values["live.note"] = cfg.live_calls.note;
values.chart = chart(dev, ho);

// ---------- the results chart: 95% intervals, dev vs held-out ----------
function chart(d, h) {
  const W = 1000, X0 = 200, X1 = 830, ROW = 34, TITLE = 30;
  const sx = (r) => (X0 + r * (X1 - X0)).toFixed(1);
  const sets = [
    { m: d, name: cfg.dev.label, color: "var(--dev)" },
    { m: h, name: cfg.holdout.label, color: "var(--coral)" },
  ];
  const panels = [
    { title: "Scams caught", key: "catch" },
    { title: "False holds on genuine payments", key: "fh" },
  ];
  const panelH = TITLE + sets.length * ROW + 10;
  const H = panels.length * panelH + 26;
  const out = [];
  const gridTop = TITLE - 4, gridBottom = panels.length * panelH - 6;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    out.push(`<line class="g" x1="${sx(t)}" y1="${gridTop}" x2="${sx(t)}" y2="${gridBottom}"/>`);
    out.push(`<text class="ax" x="${sx(t)}" y="${gridBottom + 20}" text-anchor="middle">${t * 100}%</text>`);
  }
  panels.forEach((p, i) => {
    const y0 = i * panelH;
    out.push(`<text class="t" x="0" y="${y0 + 20}">${p.title}</text>`);
    sets.forEach((s, j) => {
      const r = s.m[p.key];
      const cy = y0 + TITLE + j * ROW + ROW / 2;
      out.push(`<text class="lab" x="0" y="${cy + 5}">${s.name}</text>`);
      out.push(`<line class="w" x1="${sx(r.ci95[0])}" y1="${cy}" x2="${sx(r.ci95[1])}" y2="${cy}" stroke="${s.color}"/>`);
      out.push(`<circle cx="${sx(r.rate)}" cy="${cy}" r="7.5" fill="${s.color}" stroke="var(--paper)" stroke-width="2.5"><title>${s.name}: ${frac(r)} (${pct(r.rate)}), 95% CI ${ci(r)}</title></circle>`);
      out.push(`<text class="val" x="${W}" y="${cy + 5}" text-anchor="end">${frac(r)} · ${pct(r.rate)}</text>`);
    });
  });
  return `<svg class="ci" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Scam catch and false-hold rates with 95% intervals, development set against the held-out set">${out.join("")}</svg>`;
}

// ---------- fill markers ----------
const MARK = /<!--r:([\w.]+)-->([\s\S]*?)<!--\/r-->/g;
function fill(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return console.log(`skip ${file} (missing)`);
  const before = readFileSync(path, "utf8");
  const missing = new Set();
  let count = 0;
  const after = before.replace(MARK, (_, key) => {
    if (!(key in values)) {
      missing.add(key);
      return _;
    }
    count++;
    return `<!--r:${key}-->${values[key]}<!--/r-->`;
  });
  if (missing.size) throw new Error(`${file}: unknown result keys: ${[...missing].join(", ")}`);
  if (after !== before) writeFileSync(path, after);
  console.log(`${file}: ${count} markers filled${after === before ? " (no change)" : ""}`);
}
fill("deck/index.html");
fill("docs/PITCH.md");

// ---------- the video's results scene (deck/video/ruko-demo.yaml) ----------
function videoResults() {
  const holds = (k) => `${k} false hold${k === 1 ? "" : "s"}`;
  const live = cfg.live_calls.made ? `${cfg.live_calls.made} live Bolna calls measured so far` : "An LLM plays the customer; no live calls measured yet";
  return [
    "  # >>> results: written by deck/tools/build.mjs from deck/results.config.json; edit the template there",
    "  - id: results",
    "    card:",
    "      template: section",
    `      eyebrow: "Results · text mode · ${version}"`,
    `      title: "Tuned on one set. *Frozen* the other."`,
    "      bullets:",
    `        - "${cfg.dev.label}: ${frac(dev.catch)} scams caught, ${frac(dev.fh)} false holds"`,
    `        - "${cfg.holdout.label}, frozen before any run: ${frac(ho.catch)} caught, ${frac(ho.fh)} false holds"`,
    `        - "${live}"`,
    `    chapter: "Results"`,
    "    narration: >-",
    `      In text-mode tests, Ruko caught ${dev.catch.k} of ${dev.catch.n} scams on the set we tuned on, and ${ho.catch.k} of ${ho.catch.n} on a held-out set`,
    `      we froze before any run, with ${holds(ho.fh.k)} in ${ho.fh.n} genuine payments. The held-out number is the one we are improving.`,
    "  # <<< results",
  ].join("\n");
}
{
  const file = join(DECK, "video", "ruko-demo.yaml");
  if (existsSync(file)) {
    const before = readFileSync(file, "utf8");
    const after = before.replace(/  # >>> results[\s\S]*?  # <<< results/, videoResults());
    if (after !== before) writeFileSync(file, after);
    console.log(`deck/video/ruko-demo.yaml: results scene ${after === before ? "unchanged" : "rewritten"}`);
  }
}
console.log(
  JSON.stringify(
    { source: cfg.source, dev: [dev.run_id, values["dev.catch"], values["dev.fh"], values["dev.otp"]], holdout: [ho.run_id, values["ho.catch"], values["ho.fh"], values["ho.otp"]] },
    null,
    1,
  ),
);

// ---------- print ----------
if (!process.argv.includes("--no-pdf")) {
  const pdf = join(DECK, "Ruko-pitch.pdf");
  const url = `${pathToFileURL(join(DECK, "index.html")).href}?print`;
  const profile = mkdtempSync(join(tmpdir(), "ruko-deck-chrome-"));
  execFileSync(
    CHROME,
    ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000", `--print-to-pdf=${pdf}`, url],
    { stdio: ["ignore", "inherit", "ignore"] },
  );
  rmSync(profile, { recursive: true, force: true });
  const mb = statSync(pdf).size / 1024 / 1024;
  console.log(`wrote ${pdf} (${mb.toFixed(2)} MB)`);
  if (mb > 10) console.warn("warning: the PDF is over 10 MB");
}
