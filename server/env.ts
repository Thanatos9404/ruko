import { existsSync, readFileSync } from "node:fs";

/**
 * Loads KEY=VALUE lines from a dotenv file into process.env without overriding
 * values that are already set. Used by local scripts and the dev server; on
 * Vercel, environment variables come from the project settings instead.
 */
export function loadDotEnv(path = ".env", only?: string[]): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, rawV] = m;
    if (only && !only.includes(k)) continue;
    let v = rawV.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/** The Nebius key lives outside this repo; the eval reads it at runtime and never logs it. */
export const NEBIUS_ENV_PATH = "C:/Desktop/COLLEGE/Coding/Hackathon/NebiusXNvidia/.env";
