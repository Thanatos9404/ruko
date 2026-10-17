/**
 * Loader and types for the scam pattern library (data/patterns/library.json)
 * and the signal cue lexicon (data/patterns/signal_cues.json).
 *
 * Files are read from disk lazily, once per process. On Vercel, make sure the
 * JSON files are bundled with the function (see research/INTEGRATION.md:
 * vercel.json "includeFiles"). Tests and callers can inject objects with
 * configureLibrary() instead of reading files.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type LibLang = "en" | "hi" | "hinglish" | "ta" | "bn" | "mr";

export interface LibraryPattern {
  id: string;
  aliases?: string[];
  name: Partial<Record<LibLang, string>> & { en: string; hi: string };
  category: string;
  region: "india" | "global";
  markets: string[];
  summary: string;
  channel: string[];
  payment_rails: string[];
  victim_profile: string;
  indicators: string[];
  typical_claims: string[];
  red_flag_questions: Partial<Record<LibLang, string[]>> & { en: string[] };
  coaching_phrases: Partial<Record<LibLang, string[]>> & { en: string[] };
  cues: Partial<Record<LibLang, string[]>> & { en: string[] };
  keywords: string[];
  signals: Record<string, number>;
  truth: Partial<Record<LibLang, string>> & { en: string; hi: string };
  advice: Partial<Record<LibLang, string[]>> & { en: string[]; hi: string[] };
  ask_next: Partial<Record<LibLang, string>> & { en: string; hi: string };
  first_seen: { value: string; sources: string[] };
  trend: { status: string; note: string; sources: string[] };
  ruko_applicability: "direct" | "partial" | "indirect";
  applicability_note?: string;
  sources: string[];
  citations: Record<string, string[]>;
  translation_status: Partial<Record<LibLang, string>>;
  provenance: { origin: string; notes?: string };
}

export interface PatternLibrary {
  library: "ruko-scam-patterns";
  version: string;
  generated: string;
  categories: { id: string; name: string; description: string }[];
  patterns: LibraryPattern[];
}

export interface SignalCues {
  version: string;
  signals: Record<string, Partial<Record<LibLang, string[]>>>;
  negators: Partial<Record<LibLang, string[]>>;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  accessed: string;
  kind: string;
  jurisdiction: string;
  verified: string;
  notes: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));

/** Candidate locations: next to this file (dev, tests, Vercel with includeFiles), then the process cwd. */
function findFile(rel: string): string | null {
  for (const base of [resolve(HERE, "../.."), process.cwd()]) {
    const p = join(base, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

function readJson<T>(rel: string): T | null {
  const p = findFile(rel);
  if (!p) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

let library: PatternLibrary | null | undefined;
let signalCues: SignalCues | null | undefined;
let sources: Map<string, Source> | null | undefined;

export function configureLibrary(opts: { library?: PatternLibrary | null; signalCues?: SignalCues | null; sources?: Source[] | null }): void {
  if (opts.library !== undefined) library = opts.library;
  if (opts.signalCues !== undefined) signalCues = opts.signalCues;
  if (opts.sources !== undefined) sources = opts.sources ? new Map(opts.sources.map((s) => [s.id, s])) : null;
}

/** Forget loaded or injected files; the next access reads from disk again. */
export function resetLibrary(): void {
  library = undefined;
  signalCues = undefined;
  sources = undefined;
  byId = null;
  byIdFor = null;
}

export function getLibrary(): PatternLibrary | null {
  if (library === undefined) library = readJson<PatternLibrary>("data/patterns/library.json");
  return library;
}

export function getSignalCues(): SignalCues | null {
  if (signalCues === undefined) signalCues = readJson<SignalCues>("data/patterns/signal_cues.json");
  return signalCues;
}

export function getSources(): Map<string, Source> {
  if (sources === undefined) {
    const s = readJson<{ sources: Source[] }>("data/patterns/sources.json");
    sources = s ? new Map(s.sources.map((x) => [x.id, x])) : null;
  }
  return sources ?? new Map();
}

let byId: Map<string, LibraryPattern> | null = null;
let byIdFor: PatternLibrary | null = null;

/** Looks a pattern up by id or by alias. */
export function libraryPattern(id: string): LibraryPattern | undefined {
  const lib = getLibrary();
  if (!lib) return undefined;
  if (byIdFor !== lib) {
    byId = new Map();
    for (const p of lib.patterns) {
      byId.set(p.id, p);
      for (const a of p.aliases ?? []) if (!byId.has(a)) byId.set(a, p);
    }
    byIdFor = lib;
  }
  return byId!.get(id);
}

/** Text for a language with sensible fallbacks: hinglish -> en, ta/bn/mr -> en. */
export function pick<T>(m: Partial<Record<LibLang, T>> & { en: T }, lang: string): T {
  return (m as Record<string, T>)[lang] ?? m.en;
}
