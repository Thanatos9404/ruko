import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpenText, CircleHelp, ListChecks, Megaphone, Quote, Search, ShieldCheck, Waypoints, X } from "lucide-react";
import { Panel, Reveal, Segmented, cn } from "../../kit";
import { api, type PatternView } from "../../lib/api";
import { navigate } from "../../lib/router";
import { SEVERITY_RANK, signalDef } from "../../../shared/signals";
import type { Severity } from "../../../shared/types";
import { useResource, useSearchParam } from "./hooks";
import { humanize } from "./fmt";
import { Chip, EmptyState, ErrorState, ExternalLink, SEVERITY, SeverityTag, Skeleton } from "./ui";

/* ------------------------------------------------------------- normalising */

// The library is growing (another workstream adds categories, channels and
// red-flag questions), so read every field defensively and show what exists.

type Dict<T> = Record<string, T>;

interface Source {
  title: string;
  publisher?: string;
  date?: string;
  url?: string;
  used_for?: string;
}

interface Pattern {
  id: string;
  name: { en: string; hi?: string; other: { lang: string; text: string }[] };
  summary: string;
  category?: string;
  channels: string[];
  rails: string[];
  victim?: string;
  applicability?: string;
  trend?: { status?: string; note?: string };
  indicators: string[];
  claims: string[];
  truth: { lang: string; text: string }[];
  advice: { lang: string; items: string[] }[];
  askNext: { lang: string; text: string }[];
  redFlags: { lang: string; items: string[] }[];
  signals: { type: string; weight: number }[];
  keywords: string[];
  sources: Source[];
  draftLangs: Set<string>;
  haystack: string;
}

const LANG_ORDER = ["en", "hi", "hinglish", "ta", "bn", "mr"];
const LANG_LABEL: Dict<string> = { en: "English", hi: "हिन्दी", hinglish: "Hinglish", ta: "தமிழ்", bn: "বাংলা", mr: "मराठी" };
const LANG_HTML: Dict<string> = { en: "en", hi: "hi", hinglish: "en", ta: "ta", bn: "bn", mr: "mr" };
const DRAFT = new Set(["ta", "bn", "mr"]);

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : typeof v === "string" && v.trim() ? [v] : []);
const byLang = (a: { lang: string }, b: { lang: string }) => (LANG_ORDER.indexOf(a.lang) + 99) % 99 - ((LANG_ORDER.indexOf(b.lang) + 99) % 99);

function perLangText(v: unknown): { lang: string; text: string }[] {
  if (!v || typeof v !== "object") return typeof v === "string" ? [{ lang: "en", text: v }] : [];
  return Object.entries(v as Dict<unknown>)
    .filter(([, t]) => typeof t === "string" && t.trim())
    .map(([lang, t]) => ({ lang, text: t as string }))
    .sort(byLang);
}

function perLangList(v: unknown): { lang: string; items: string[] }[] {
  if (Array.isArray(v)) return strs(v).length ? [{ lang: "en", items: strs(v) }] : [];
  if (!v || typeof v !== "object") return [];
  return Object.entries(v as Dict<unknown>)
    .map(([lang, items]) => ({ lang, items: strs(items) }))
    .filter((x) => x.items.length)
    .sort(byLang);
}

function normalise(raw: PatternView, sourceIndex: Map<string, Source>): Pattern {
  const r = raw as unknown as Dict<unknown>;
  const nameObj = (r.name && typeof r.name === "object" ? r.name : { en: String(r.name ?? r.id) }) as Dict<unknown>;
  const names = perLangText(nameObj);
  const sources: Source[] = (Array.isArray(r.sources) ? r.sources : [])
    .map((s): Source | null => {
      if (typeof s === "string") return sourceIndex.get(s) ?? { title: s };
      if (s && typeof s === "object" && typeof (s as Source).title === "string") return s as Source;
      return null;
    })
    .filter((s): s is Source => s !== null);
  const status = (r.translation_status && typeof r.translation_status === "object" ? r.translation_status : {}) as Dict<unknown>;
  const draftLangs = new Set<string>();
  for (const l of LANG_ORDER) {
    const st = typeof status[l] === "string" ? (status[l] as string).toLowerCase() : "";
    if (st ? /draft|pending|machine|unreviewed/.test(st) : DRAFT.has(l)) draftLangs.add(l);
  }
  const trend = r.trend && typeof r.trend === "object" ? (r.trend as { status?: string; note?: string }) : undefined;
  const p: Pattern = {
    id: String(r.id),
    name: {
      en: names.find((n) => n.lang === "en")?.text ?? humanize(String(r.id)),
      hi: names.find((n) => n.lang === "hi")?.text,
      other: names.filter((n) => n.lang !== "en" && n.lang !== "hi"),
    },
    summary: typeof r.summary === "string" ? r.summary : "",
    category: typeof r.category === "string" ? r.category : undefined,
    channels: strs(r.channel ?? r.channels),
    rails: strs(r.payment_rails),
    victim: typeof r.victim_profile === "string" ? r.victim_profile : undefined,
    applicability: typeof r.ruko_applicability === "string" ? r.ruko_applicability : undefined,
    trend: trend && (trend.status || trend.note) ? trend : undefined,
    indicators: strs(r.indicators),
    claims: strs(r.typical_claims),
    truth: perLangText(r.truth),
    advice: perLangList(r.advice),
    askNext: perLangText(r.ask_next),
    redFlags: perLangList(r.red_flag_questions),
    signals: Object.entries((r.signals && typeof r.signals === "object" ? r.signals : {}) as Dict<unknown>)
      .filter(([, w]) => typeof w === "number")
      .map(([type, w]) => ({ type, weight: w as number }))
      .sort((a, b) => b.weight - a.weight),
    keywords: strs(r.keywords),
    sources,
    draftLangs,
    haystack: "",
  };
  p.haystack = [p.id, p.name.en, p.name.hi, ...p.name.other.map((n) => n.text), p.summary, p.category, ...p.channels, ...p.indicators, ...p.claims, ...p.keywords]
    .filter(Boolean)
    .join(" \u0001 ")
    .toLowerCase();
  return p;
}

interface LibraryData {
  patterns: Pattern[];
  signals: { type: string; severity: Severity; label: string; listen_for: string }[];
  categories: Map<string, string>;
}

async function loadLibrary(): Promise<LibraryData> {
  // The full research library (72 patterns, India and global) when the deployment bundles it,
  // the 12-pattern core otherwise. The signal taxonomy always comes from the core API.
  const core = await api.patterns();
  const full = await fetch("/api/console/library")
    .then((r) => (r.ok ? (r.json() as Promise<{ patterns: PatternView[]; categories?: unknown; sources?: unknown }>) : null))
    .catch(() => null);
  const res = { ...core, ...(full ? { data: full.patterns, categories: full.categories, sources: full.sources } : {}) } as Awaited<ReturnType<typeof api.patterns>> & {
    categories?: unknown;
    sources?: unknown;
  };
  const categories = new Map<string, string>();
  if (Array.isArray(res.categories))
    for (const c of res.categories) if (c && typeof c === "object" && typeof (c as Dict<unknown>).id === "string") categories.set((c as Dict<string>).id, String((c as Dict<unknown>).name ?? (c as Dict<string>).id));
  const sourceIndex = new Map<string, Source>();
  if (Array.isArray(res.sources)) {
    for (const s of res.sources) if (s && typeof s === "object" && typeof (s as Dict<unknown>).id === "string") sourceIndex.set((s as Dict<string>).id, s as unknown as Source);
  } else if (res.sources && typeof res.sources === "object") {
    for (const [id, s] of Object.entries(res.sources as Dict<Source>)) sourceIndex.set(id, s);
  }
  return {
    patterns: (res.data ?? []).map((p) => normalise(p, sourceIndex)),
    signals: (res.signals ?? []).map((s) => ({ ...s, severity: (s.severity in SEVERITY ? s.severity : "process") as Severity })),
    categories,
  };
}

/* -------------------------------------------------------------------- page */

type View = "patterns" | "signals";

export function Library() {
  const res = useResource(loadLibrary, []);
  const selected = useSearchParam("p");
  const [view, setView] = useState<View>("patterns");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const data = res.data;

  const list = useMemo(() => {
    if (!data) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return data.patterns.filter((p) => (!category || p.category === category) && terms.every((t) => p.haystack.includes(t)));
  }, [data, q, category]);

  const categories = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const p of data.patterns) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n, name: data.categories.get(id) ?? humanize(id) }));
  }, [data]);

  const current = data?.patterns.find((p) => p.id === selected) ?? null;
  const missing = Boolean(data && selected && !current);
  const shown = current ?? list[0] ?? null;

  if (!data) {
    if (res.loading) return <LibrarySkeleton />;
    return <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load the pattern library" />;
  }

  return (
    <div className="space-y-5">
      {missing && (
        <div role="status" className="rounded-2xl border border-hair bg-paper-2 px-4 py-3 text-[13.5px] text-ink-2">
          Pattern “{selected}” was not found in this library. Showing the full list instead.
        </div>
      )}
      <Reveal>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[68ch] text-[14px] leading-relaxed text-muted">
            {data.patterns.length} patterns, India first, each with its sources (official advisories wherever they exist; machine-drafted translations are labelled). The agent names a pattern from the signals it hears, then says the pattern's one-line truth to break the
            script. It never improvises official advice.
          </p>
          <div className="relative shrink-0 overflow-x-auto">
            <Segmented
              id="library-view"
              value={view}
              onChange={setView}
              options={[
                { value: "patterns", label: <span className="whitespace-nowrap text-[13px]">Patterns <span className="t-num opacity-60">{data.patterns.length}</span></span> },
                { value: "signals", label: <span className="whitespace-nowrap text-[13px]">Signal taxonomy <span className="t-num opacity-60">{data.signals.length}</span></span> },
              ]}
            />
          </div>
        </div>
      </Reveal>

      {view === "signals" ? (
        <Taxonomy data={data} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          {/* List */}
          <div className={cn("min-w-0 lg:sticky lg:top-[92px] lg:self-start", current && "max-lg:hidden")}>
            <div className="surface flex flex-col overflow-hidden lg:max-h-[calc(100dvh-116px)]">
              <div className="border-b border-hair p-3">
                <label className="flex h-10 items-center gap-2 rounded-full border border-hair bg-paper-2 px-3.5 text-[14px] text-muted transition-colors focus-within:border-[var(--hair-strong)] focus-within:bg-paper">
                  <Search className="size-4 shrink-0" strokeWidth={1.7} aria-hidden />
                  <span className="sr-only">Search patterns</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search names, claims, keywords"
                    className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} className="grid size-6 place-items-center rounded-full text-muted hover:bg-paper-3 hover:text-ink" aria-label="Clear search">
                      <X className="size-3.5" strokeWidth={1.8} />
                    </button>
                  )}
                </label>
                {categories.length > 1 && (
                  <div className="rk-scroll-x relative mt-2.5 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
                    <CatButton on={!category} onClick={() => setCategory(null)}>
                      All
                    </CatButton>
                    {categories.map((c) => (
                      <CatButton key={c.id} on={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
                        {c.name} <span className="opacity-60">{c.n}</span>
                      </CatButton>
                    ))}
                  </div>
                )}
                <p className="mt-2 px-1 text-[12px] text-muted" aria-live="polite">
                  {list.length === data.patterns.length ? `${list.length} patterns` : `${list.length} of ${data.patterns.length} patterns`}
                </p>
              </div>
              {list.length ? (
                <ul className="rk-scroll-x relative min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Patterns">
                  {list.map((p) => (
                    <li key={p.id}>
                      <PatternCard p={p} on={current?.id === p.id} implicit={!current && shown?.id === p.id} category={p.category ? (data.categories.get(p.category) ?? humanize(p.category)) : undefined} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Search />}
                  title="No pattern matches"
                  className="py-10"
                  action={
                    <button
                      type="button"
                      className="rk-btn"
                      onClick={() => {
                        setQuery("");
                        setCategory(null);
                      }}
                    >
                      Clear the search
                    </button>
                  }
                >
                  Nothing in the library mentions “{query.trim()}”{category ? " in this category" : ""}. Try a word the caller used, such as “parcel” or “KYC”.
                </EmptyState>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className={cn("min-w-0", !current && "max-lg:hidden")}>
            {shown ? (
              <PatternDetail key={shown.id} p={shown} data={data} />
            ) : (
              <div className="surface">
                <EmptyState icon={<BookOpenText />} title="Pick a pattern">
                  Choose one on the left to see its indicators, the truth the agent says, advice and sources.
                </EmptyState>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CatButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
        on ? "border-transparent bg-ink text-paper" : "border-hair text-ink-2 hover:border-[var(--hair-strong)] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function PatternCard({ p, on, implicit, category }: { p: Pattern; on: boolean; implicit: boolean; category?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: "nearest" });
  }, [on]);
  return (
    <a
      ref={ref}
      href={`/console/library?p=${encodeURIComponent(p.id)}`}
      aria-current={on ? "true" : undefined}
      className={cn(
        "block rounded-2xl border px-3.5 py-3 transition-colors",
        on ? "border-[var(--hair-strong)] bg-paper-3" : "border-transparent hover:bg-paper-2",
        // With nothing chosen, wide screens show the first pattern; mark it there only.
        implicit && "lg:border-[var(--hair-strong)] lg:bg-paper-3",
      )}
    >
      <span className="block truncate font-display text-[14.5px] font-semibold text-ink">{p.name.en}</span>
      {p.name.hi && (
        <span lang="hi" className="mt-0.5 block truncate text-[13px] text-ink-2">
          {p.name.hi}
        </span>
      )}
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{p.summary}</p>
      {(category || p.channels.length > 0) && (
        <p className="mt-1.5 truncate text-[11.5px] text-ink-2">{[category, ...p.channels.slice(0, 3).map(humanize)].filter(Boolean).join(" · ")}</p>
      )}
    </a>
  );
}

/* ------------------------------------------------------------------ detail */

function PatternDetail({ p, data }: { p: Pattern; data: LibraryData }) {
  const category = p.category ? (data.categories.get(p.category) ?? humanize(p.category)) : null;
  return (
    <Reveal className="space-y-4">
      <a href="/console/library" className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-[13px] font-medium text-muted hover:text-ink lg:hidden">
        <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden />
        All patterns
      </a>

      <section className="surface p-5 md:p-7" aria-labelledby={`pt-${p.id}`}>
        <p className="font-mono text-[11.5px] text-muted">{p.id}</p>
        <h2 id={`pt-${p.id}`} className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[30px]">
          {p.name.en}
        </h2>
        {(p.name.hi || p.name.other.length > 0) && (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[16px] text-ink-2">
            {p.name.hi && <span lang="hi">{p.name.hi}</span>}
            {p.name.other.map((n) => (
              <span key={n.lang} lang={LANG_HTML[n.lang]} className="text-muted">
                {n.text}
              </span>
            ))}
          </p>
        )}
        {(category || p.channels.length || p.rails.length || p.applicability || p.trend?.status) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {category && <Chip>{category}</Chip>}
            {p.channels.map((c) => (
              <Chip key={c}>{humanize(c)}</Chip>
            ))}
            {p.rails.map((c) => (
              <Chip key={c} className="font-mono !text-[11px]">
                {c}
              </Chip>
            ))}
            {p.applicability && <Chip title="How directly a voice check on the payment can interrupt this pattern">Ruko fit: {p.applicability}</Chip>}
            {p.trend?.status && <Chip title={p.trend.note}>Trend: {humanize(p.trend.status)}</Chip>}
          </div>
        )}
        <p className="mt-4 max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{p.summary}</p>
        {p.victim && <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-muted">Who it targets: {p.victim}</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={<TitleIcon icon={<ListChecks />}>Indicators</TitleIcon>} description="What a fraud analyst or the agent should notice.">
          <ul className="space-y-2.5">
            {p.indicators.map((x) => (
              <li key={x} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[var(--sev-high)]" aria-hidden />
                {x}
              </li>
            ))}
            {!p.indicators.length && <li className="text-[13.5px] text-muted">No indicators listed.</li>}
          </ul>
        </Panel>
        <Panel title={<TitleIcon icon={<Quote />}>How it usually sounds</TitleIcon>} description="Paraphrased from advisories. Never used as an instruction to the agent.">
          <ul className="space-y-2.5">
            {p.claims.map((x) => (
              <li key={x} className="rounded-xl border-l-2 border-[var(--hair-strong)] bg-paper-2 py-2.5 pl-3.5 pr-3 text-[14px] italic leading-relaxed text-ink-2">
                “{x}”
              </li>
            ))}
            {!p.claims.length && <li className="text-[13.5px] text-muted">No typical claims listed.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title={<TitleIcon icon={<Megaphone />}>The truth, said out loud</TitleIcon>} description="One sentence the engine hands the agent to break the script, in the customer's language.">
        <ul className="divide-y divide-[var(--hair)]">
          {p.truth.map((t) => (
            <li key={t.lang} className="grid grid-cols-1 gap-x-5 gap-y-1.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
              <div className="flex flex-wrap items-center gap-2 sm:block lg:flex xl:block">
                <span lang={LANG_HTML[t.lang]} className="text-[13px] font-semibold text-ink-2">
                  {LANG_LABEL[t.lang] ?? t.lang}
                </span>
                {p.draftLangs.has(t.lang) && (
                  <span className="whitespace-nowrap rounded-full bg-paper-3 px-2 py-0.5 text-[10.5px] font-semibold text-muted sm:mt-1.5 sm:inline-block lg:mt-0 xl:mt-1.5">Draft translation, review pending</span>
                )}
              </div>
              <p lang={LANG_HTML[t.lang]} className={cn("break-words text-[15px] leading-relaxed", p.draftLangs.has(t.lang) ? "text-ink-2" : "text-ink")}>
                {t.text}
              </p>
            </li>
          ))}
          {!p.truth.length && <li className="text-[13.5px] text-muted">No truth sentence yet.</li>}
        </ul>
      </Panel>

      {p.redFlags.length > 0 && (
        <Panel title={<TitleIcon icon={<CircleHelp />}>Red-flag questions</TitleIcon>} description="Questions that surface this pattern on a call.">
          <LangColumns groups={p.redFlags} draft={p.draftLangs} />
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={<TitleIcon icon={<ShieldCheck />}>Advice</TitleIcon>} description="What the customer is told to do.">
          <LangColumns groups={p.advice} draft={p.draftLangs} stacked />
          {p.askNext.length > 0 && (
            <div className="mt-5 border-t border-hair pt-4">
              <p className="t-eyebrow !text-[10.5px]">The agent asks next</p>
              <ul className="mt-2 space-y-1.5">
                {p.askNext.map((a) => (
                  <li key={a.lang} lang={LANG_HTML[a.lang]} className="text-[13.5px] leading-relaxed text-ink-2">
                    {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel title={<TitleIcon icon={<Waypoints />}>Signals that point here</TitleIcon>} description="How much each recorded signal counts toward naming this pattern.">
          {p.signals.length ? (
            <ul className="space-y-3">
              {p.signals.map((s) => {
                const def = signalDef(s.type);
                const sev = (def?.severity ?? "process") as Severity;
                const max = Math.max(...p.signals.map((x) => x.weight), 1);
                return (
                  <li key={s.type}>
                    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                      <span className="min-w-0 text-ink-2">{def?.label ?? humanize(s.type)}</span>
                      <span className="t-num shrink-0 text-ink">×{s.weight}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-3" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${(s.weight / max) * 100}%`, background: SEVERITY[sev].color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted">No signal weights yet.</p>
          )}
          {p.keywords.length > 0 && (
            <details className="group mt-5 border-t border-hair pt-4">
              <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-2 hover:text-ink">
                <span className="inline-flex items-center gap-1.5">
                  {p.keywords.length} keywords for the text checker
                  <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                </span>
              </summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.keywords.map((k) => (
                  <span key={k} className="rounded-md bg-paper-3 px-2 py-0.5 font-mono text-[11.5px] text-ink-2">
                    {k.trim()}
                  </span>
                ))}
              </div>
            </details>
          )}
        </Panel>
      </div>

      <Panel title={<TitleIcon icon={<BookOpenText />}>Sources</TitleIcon>} description="Official advisories and records this pattern is built from.">
        {p.sources.length ? (
          <ol className="divide-y divide-[var(--hair)]">
            {p.sources.map((s, i) => (
              <li key={`${s.title}-${i}`} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[14px] leading-snug">{s.url ? <ExternalLink href={s.url}>{s.title}</ExternalLink> : <span className="text-ink">{s.title}</span>}</p>
                <p className="mt-1 text-[12.5px] text-muted">{[s.publisher, s.date].filter(Boolean).join(" · ")}</p>
                {s.used_for && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">Used for: {s.used_for}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13.5px] text-muted">No sources attached yet.</p>
        )}
      </Panel>
    </Reveal>
  );
}

function TitleIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 [&>svg]:size-4 [&>svg]:stroke-[1.7] [&>svg]:text-muted">
      {icon}
      {children}
    </span>
  );
}

function LangColumns({ groups, draft, stacked }: { groups: { lang: string; items: string[] }[]; draft: Set<string>; stacked?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 gap-5", !stacked && groups.length > 1 && "md:grid-cols-2")}>
      {groups.map((g) => (
        <div key={g.lang}>
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-muted">
            <span lang={LANG_HTML[g.lang]}>{LANG_LABEL[g.lang] ?? g.lang}</span>
            {draft.has(g.lang) && <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10.5px]">Draft translation, review pending</span>}
          </p>
          <ol className="mt-2 space-y-2">
            {g.items.map((x, i) => (
              <li key={i} lang={LANG_HTML[g.lang]} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                <span className="t-num mt-[1px] w-4 shrink-0 text-right text-[12.5px] text-muted">{i + 1}</span>
                {x}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- taxonomy */

function Taxonomy({ data }: { data: LibraryData }) {
  const rows = [...data.signals].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.severity === "mitigating" ? 0 : 0));
  const order: Severity[] = ["critical", "high", "medium", "process", "mitigating"];
  rows.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const usedBy = (type: string) =>
    data.patterns
      .map((p) => ({ p, w: p.signals.find((s) => s.type === type)?.weight ?? 0 }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w);

  return (
    <Reveal>
      <Panel
        title="Signal taxonomy"
        description="Everything the voice agent can record with record_signal. Severity drives the policy; the agent only labels what it hears."
        className="!p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5 md:[&>div:first-child]:px-6 md:[&>div:first-child]:pt-6"
      >
        <div className="hidden lg:block">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Signals the agent can record</caption>
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[128px]" />
              <col />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-hair text-[11px] uppercase tracking-[0.08em] text-muted [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-mono [&>th]:font-normal">
                <th scope="col" className="!pl-6">
                  Signal
                </th>
                <th scope="col">Severity</th>
                <th scope="col">What the agent listens for</th>
                <th scope="col" className="!pr-6">
                  Points to
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const used = usedBy(s.type);
                return (
                  <tr key={s.type} className="border-b border-hair align-top text-[13.5px] last:border-b-0 [&>td]:px-3 [&>td]:py-3.5">
                    <td className="!pl-6">
                      <span className="block font-medium text-ink">{s.label}</span>
                      <code className="mt-1 block font-mono text-[11.5px] text-muted">{s.type}</code>
                    </td>
                    <td>
                      <SeverityTag severity={s.severity} />
                    </td>
                    <td className="leading-relaxed text-ink-2">{s.listen_for}</td>
                    <td className="!pr-6">
                      <PatternLinks used={used} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-[var(--hair)] border-t border-hair lg:hidden">
          {rows.map((s) => (
            <li key={s.type} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{s.label}</p>
                  <code className="mt-0.5 block font-mono text-[11.5px] text-muted">{s.type}</code>
                </div>
                <SeverityTag severity={s.severity} />
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.listen_for}</p>
              <div className="mt-2">
                <PatternLinks used={usedBy(s.type)} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Reveal>
  );
}

function PatternLinks({ used }: { used: { p: Pattern; w: number }[] }) {
  if (!used.length) return <span className="text-[12.5px] text-muted">Any pattern (not pattern-specific)</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1 text-[12.5px]">
      {used.slice(0, 4).map(({ p, w }) => (
        <a
          key={p.id}
          href={`/console/library?p=${encodeURIComponent(p.id)}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/console/library?p=${encodeURIComponent(p.id)}`);
          }}
          className="text-ink-2 underline decoration-[var(--hair-strong)] underline-offset-4 hover:text-ink"
        >
          {p.name.en}
          <span className="ml-0.5 text-muted no-underline">×{w}</span>
        </a>
      ))}
      {used.length > 4 && <span className="text-muted">+{used.length - 4} more</span>}
    </span>
  );
}

/* ---------------------------------------------------------------- skeleton */

function LibrarySkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading the pattern library">
      <Skeleton className="h-10 w-full max-w-[560px]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Skeleton className="h-[560px] !rounded-[20px]" />
        <div className="space-y-4">
          <Skeleton className="h-[220px] !rounded-[20px]" />
          <Skeleton className="h-[300px] !rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}
