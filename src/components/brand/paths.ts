/**
 * Ruko brand geometry: the single source for the React logo and the generated
 * SVG/PNG assets in brand/ (scripts/brand.ts). Redrawn as clean vectors from
 * the logo concept by Yashvardhan Thanvi: a voice wave runs into a coral line and
 * stops; the folded R stands on the other side.
 */

export const BRAND = {
  navy: "#161f2e",
  paper: "#fdfdfb",
  coral: "#e46157",
  barsLight: ["#cfd4dc", "#8a93a3"] as const,
  barsDark: ["#3a4558", "#8f9aae"] as const,
};

/** Mark, viewBox 0 0 600 600. Bars are [x, y, width, height]. */
export const MARK = {
  viewBox: "0 0 600 600",
  bars: [
    [34.5, 288, 13, 30],
    [65, 272, 18, 59],
    [99.5, 245, 23, 108],
    [145, 208, 30, 178],
    [205, 155, 33, 281],
  ] as [number, number, number, number][],
  line: "M271 77 C275.5 200 275.5 400 271 524 C266.5 400 266.5 200 271 77Z",
  lineGlow: "M271 77 C279 200 279 400 271 524 C263 400 263 200 271 77Z",
  lens: { cx: 296, cy: 262, rx: 16, ry: 70 },
  bowl: "M291 129 L418 129 C470 129 512 170 512 230 C512 285 492 318 469 339 C466 300 452 268 430 255 C400 238 352 236 322 205 C303 186 293 160 291 129 Z",
  leg: "M343 331 L390 331 L562 484 L446 484 Q436 484 430 476 L336 343 Q333 331 343 331 Z",
};

/** Tight crop of the mark for small sizes (R + line only), viewBox 240 70 340 470. */
export const MARK_COMPACT_VIEWBOX = "236 60 344 480";

/**
 * Wordmark, viewBox "15 20 965 290": strokes (width 36) and filled polygons.
 * The k is one junction: the arm starts inside the stem and the leg branches off
 * the arm's centreline, both 36 wide, with horizontal terminals like R/u.
 */
export const WORDMARK = {
  viewBox: "15 20 965 290",
  width: 965,
  height: 290,
  strokes: ["M25 52 H175 A59 59 0 0 1 175 170 H70", "M316 100 V204 A78 78 0 0 0 472 204 V100 M472 204 V300"],
  circle: { cx: 879, cy: 200, r: 82 },
  polygons: ["70,170 121,170 254,300 203,300", "538,48 574,30 574,300 538,300", "544.9,213.9 690,100 748.1,100 567.1,242.1", "633.1,165.5 759.9,300 710.5,300 606.9,190.1"],
  stroke: 36,
};
