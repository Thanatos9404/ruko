/**
 * Generates Ruko's brand assets from the single geometry source
 * (src/components/brand/paths.ts): SVG marks, wordmarks and lockups in light,
 * dark and mono, the favicon and app icons (16–512, maskable), and the social
 * card. PNGs are rendered with the locally installed Chrome (no downloads).
 *
 *   npx tsx scripts/brand.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BRAND, MARK, WORDMARK } from "../src/components/brand/paths.js";

type Theme = "light" | "dark" | "mono";

const ink = (t: Theme) => (t === "dark" ? BRAND.paper : t === "mono" ? "currentColor" : BRAND.navy);
const bars = (t: Theme) => (t === "dark" ? BRAND.barsDark : t === "mono" ? (["currentColor", "currentColor"] as const) : BRAND.barsLight);

function markGroup(t: Theme, id: string, opts: { glow?: boolean; compact?: boolean } = {}) {
  const [a, b] = bars(t);
  const coral = t === "mono" ? "currentColor" : BRAND.coral;
  const glow = opts.glow !== false && t !== "mono";
  return `
  <defs>
    <linearGradient id="bars-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"${t === "mono" ? ' stop-opacity="0.45"' : ""}/><stop offset="1" stop-color="${b}"${t === "mono" ? ' stop-opacity="0.7"' : ""}/></linearGradient>
    <linearGradient id="line-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${coral}" stop-opacity="0"/><stop offset="0.18" stop-color="${coral}"/><stop offset="0.82" stop-color="${coral}"/><stop offset="1" stop-color="${coral}" stop-opacity="0"/></linearGradient>
    ${glow ? `<filter id="glow-${id}" x="-300%" y="-30%" width="700%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>` : ""}
  </defs>
  ${opts.compact ? "" : `<g fill="url(#bars-${id})">${MARK.bars.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`).join("")}</g>`}
  ${glow ? `<g filter="url(#glow-${id})" fill="${coral}"><path d="${MARK.lineGlow}" opacity="0.7"/><ellipse cx="${MARK.lens.cx}" cy="${MARK.lens.cy}" rx="${MARK.lens.rx}" ry="${MARK.lens.ry}" opacity="0.55"/></g>` : ""}
  <path d="${MARK.line}" fill="url(#line-${id})"/>
  <g fill="${ink(t)}"><path d="${MARK.bowl}"/><path d="${MARK.leg}"/></g>`;
}

function wordmarkGroup(t: Theme) {
  const c = ink(t);
  return `<g fill="none" stroke="${c}" stroke-width="${WORDMARK.stroke}">${WORDMARK.strokes.map((d) => `<path d="${d}"/>`).join("")}<circle cx="${WORDMARK.circle.cx}" cy="${WORDMARK.circle.cy}" r="${WORDMARK.circle.r}"/></g><g fill="${c}">${WORDMARK.polygons.map((p) => `<polygon points="${p}"/>`).join("")}</g>`;
}

const svg = (viewBox: string, body: string, title = "Ruko", bg?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}">${bg ? `<rect x="${viewBox.split(" ")[0]}" y="${viewBox.split(" ")[1]}" width="${viewBox.split(" ")[2]}" height="${viewBox.split(" ")[3]}" fill="${bg}"/>` : ""}${body}</svg>\n`;

function mark(t: Theme) {
  return svg(MARK.viewBox, markGroup(t, `m${t}`), "Ruko");
}
function wordmark(t: Theme) {
  return svg(WORDMARK.viewBox, wordmarkGroup(t), "Ruko");
}
/** Horizontal lockup: mark (600 tall) + wordmark scaled to sit on its optical centre. */
function horizontal(t: Theme) {
  const s = 300 / WORDMARK.height; // wordmark height 300
  return svg(
    "0 0 1680 600",
    `<g>${markGroup(t, `h${t}`)}</g><g transform="translate(${640 - 15 * s} ${150 - 20 * s}) scale(${s})">${wordmarkGroup(t)}</g>`,
    "Ruko",
  );
}
function stacked(t: Theme) {
  const s = 600 / WORDMARK.width;
  return svg("0 0 600 820", `<g>${markGroup(t, `s${t}`)}</g><g transform="translate(${0 - 15 * s} ${590 - 20 * s}) scale(${s})">${wordmarkGroup(t)}</g>`, "Ruko");
}
/** App icon: navy tile, paper R, coral line, short wave. Reads at 16 px (compact mark). */
function appIcon(size: number, maskable = false) {
  const pad = maskable ? 0.2 : 0.12;
  const radius = maskable ? 0 : 0.22;
  const inner = 1 - pad * 2;
  const k = (size * inner) / 600;
  const compact = size <= 48;
  const vb = compact ? { x: 236, y: 60, w: 344, h: 480 } : { x: 0, y: 0, w: 600, h: 600 };
  const kk = (size * inner) / Math.max(vb.w, vb.h);
  const ox = (size - vb.w * kk) / 2 - vb.x * kk;
  const oy = (size - vb.h * kk) / 2 - vb.y * kk;
  void k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND.navy}"/><g transform="translate(${ox} ${oy}) scale(${kk})">${markGroup("dark", `i${size}${maskable ? "m" : ""}`, { glow: size >= 64, compact })}</g></svg>\n`;
}
function ogCard() {
  const s = 120 / WORDMARK.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs><radialGradient id="bg" cx="30%" cy="45%" r="75%"><stop offset="0" stop-color="#16233a"/><stop offset="1" stop-color="#0b111c"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(40 95) scale(0.72)">${markGroup("dark", "og")}</g>
  <g transform="translate(${530 - 15 * s} ${150 - 20 * s}) scale(${s})">${wordmarkGroup("dark")}</g>
  <text x="530" y="345" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="40" font-weight="600" fill="#eef1f6">Wait, before the money leaves.</text>
  <text x="530" y="405" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26" fill="#c2c9d6">A one-minute voice check, built on Bolna,</text>
  <text x="530" y="442" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26" fill="#c2c9d6">that stops payment scams like "digital arrest".</text>
  <text x="530" y="540" font-family="Consolas, monospace" font-size="20" fill="#8f9aac">Bolna x YC Symphony Buildathon · 2026</text>
</svg>\n`;
}

async function main() {
  await mkdir("brand", { recursive: true });
  await mkdir("public/icons", { recursive: true });
  const files: Record<string, string> = {};
  for (const t of ["light", "dark", "mono"] as Theme[]) {
    const suf = t === "light" ? "" : `-${t}`;
    files[`brand/ruko-mark${suf}.svg`] = mark(t);
    files[`brand/ruko-wordmark${suf}.svg`] = wordmark(t);
    files[`brand/ruko-lockup-horizontal${suf}.svg`] = horizontal(t);
    files[`brand/ruko-lockup-stacked${suf}.svg`] = stacked(t);
  }
  files["brand/ruko-app-icon.svg"] = appIcon(512);
  files["brand/ruko-og-card.svg"] = ogCard();
  files["public/favicon.svg"] = appIcon(64);
  for (const [p, c] of Object.entries(files)) await writeFile(p, c);
  await writeFile(
    "public/site.webmanifest",
    JSON.stringify(
      {
        name: "Ruko",
        short_name: "Ruko",
        description: "A voice check that stops payment scams before the money leaves.",
        start_url: "/",
        display: "standalone",
        background_color: BRAND.navy,
        theme_color: "#0b111c",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      null,
      2,
    ),
  );

  const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p));
  if (!chrome) {
    console.log("No local Chrome/Edge found; SVGs written, PNGs skipped.");
    return;
  }
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const render = async (svgText: string, w: number, h: number, out: string) => {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svgText.replace("<svg ", `<svg style="display:block;width:${w}px;height:${h}px" `)}</body></html>`);
    await page.screenshot({ path: out as `${string}.png`, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (const n of [16, 32, 48, 64, 128, 180, 192, 256, 512]) await render(appIcon(n), n, n, `public/icons/icon-${n}.png`);
  await render(appIcon(512, true), 512, 512, "public/icons/maskable-512.png");
  await render(appIcon(180), 180, 180, "public/apple-touch-icon.png");
  await render(ogCard(), 1200, 630, "public/og.png");
  await render(mark("light"), 1200, 1200, "brand/ruko-mark.png");
  await render(stacked("light").replace('role="img"', 'role="img" style="background:#fdfdfb"'), 1200, 1640, "brand/ruko-lockup-stacked.png");
  await browser.close();
  console.log(`Wrote ${Object.keys(files).length} SVGs, manifest, icons, og.png`);
}

await main();
