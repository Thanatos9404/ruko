import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The text model's published evaluation (ml/results/summary.json, written by the
 * research owner's training script). Read once; null if it isn't bundled.
 */
let cached: unknown | null | undefined;

export function readModelResults(): unknown | null {
  if (cached !== undefined) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  for (const base of [resolve(here, ".."), process.cwd()]) {
    const p = join(base, "ml", "results", "summary.json");
    if (existsSync(p)) {
      try {
        cached = JSON.parse(readFileSync(p, "utf8"));
        return cached;
      } catch {
        break;
      }
    }
  }
  cached = null;
  return cached;
}
