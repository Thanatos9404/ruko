import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, EyeOff, Inbox, MessageSquareWarning, PhoneIncoming, Type } from "lucide-react";
import { Button, Panel, Reveal, Segmented, cn } from "../../kit";
import { api } from "../../lib/api";
import { useNow, useResource } from "./hooks";
import { ago, dateTime, humanize, int, LANG_NAME } from "./fmt";
import { EmptyState, ErrorState, Skeleton, StaleBanner } from "./ui";

interface Report {
  id: string;
  at: string;
  pattern_id: string;
  summary: string;
  language: string;
}

type LangFilter = "all" | "en" | "hi";

async function load() {
  const [reports, names] = await Promise.all([
    api.consoleReports(),
    // Names are a nicety: if the library is unavailable the IDs still read fine.
    api
      .patterns()
      .then((p) => new Map(p.data.map((x) => [x.id, x.name?.en ?? x.id])))
      .catch(() => new Map<string, string>()),
  ]);
  return { reports: reports.data as Report[], names };
}

export function Reports() {
  const res = useResource(load, [], 10_000);
  const now = useNow(15_000);
  const [lang, setLang] = useState<LangFilter>("all");
  const data = res.data;
  const list = useMemo(() => (data?.reports ?? []).filter((r) => lang === "all" || r.language === lang), [data, lang]);
  const name = (id: string) => (id === "unknown" ? "No clear pattern" : (data?.names.get(id) ?? humanize(id)));

  const stats = useMemo(() => {
    const rs = data?.reports ?? [];
    const day = rs.filter((r) => now - Date.parse(r.at) < 24 * 3600 * 1000).length;
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(r.pattern_id, (counts.get(r.pattern_id) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const hi = rs.filter((r) => r.language === "hi").length;
    return { total: rs.length, day, top, hi };
  }, [data, now]);

  return (
    <div className="space-y-4">
      <Reveal>
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Where reports come from">
          <Explainer icon={<PhoneIncoming />} title="From the public line">
            Anyone can call the “Is this a scam?” line. The voice agent matches their story to the pattern library, says the truth sentence, and logs a short summary with log_report.
          </Explainer>
          <Explainer icon={<EyeOff />} title="Anonymised before storage">
            Phone numbers and email addresses are replaced before a summary is saved, and the report stores no caller number. Reports expire after 90 days.
          </Explainer>
          <Explainer icon={<Type />} title="The text checker keeps nothing">
            Messages pasted into the text checker are matched against the library and discarded, so they never appear here.{" "}
            <a href="/check" className="whitespace-nowrap font-medium text-ink underline decoration-[var(--hair-strong)] underline-offset-4 hover:decoration-current">
              Open it
            </a>
          </Explainer>
        </section>
      </Reveal>

      {res.error && data && <StaleBanner error={res.error} onRetry={res.reload} />}

      {!data ? (
        res.loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading reports">
            <Skeleton className="h-[88px] !rounded-[20px]" />
            <Skeleton className="h-[320px] !rounded-[20px]" />
          </div>
        ) : (
          <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load line reports" />
        )
      ) : !data.reports.length ? (
        <Reveal>
          <div className="surface">
            <EmptyState
              icon={<Inbox />}
              title="No line reports yet"
              action={
                <Button href="/check" size="sm" variant="glass" icon={<ArrowUpRight className="size-4" strokeWidth={1.8} />}>
                  Try the text checker
                </Button>
              }
            >
              When someone calls the public line and the agent logs what happened, the anonymised summary lands here within ten seconds, with the pattern it matched.
            </EmptyState>
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal>
            <dl className="surface grid grid-cols-2 gap-x-6 gap-y-4 p-5 md:grid-cols-4 md:p-6">
              <Stat label="Reports" value={int(stats.total)} />
              <Stat label="In the last 24 hours" value={int(stats.day)} />
              <Stat label="Most reported" value={stats.top[0] ? name(stats.top[0][0]) : "–"} small />
              <Stat label="In Hindi" value={stats.total ? `${Math.round((stats.hi / stats.total) * 100)}%` : "–"} />
            </dl>
          </Reveal>
          <Reveal>
            <Panel
              title="Reports"
              description="Newest first. Refreshed every 10 seconds."
              action={
                <Segmented
                  id="report-lang"
                  value={lang}
                  onChange={setLang}
                  options={(["all", "en", "hi"] as LangFilter[]).map((l) => ({ value: l, label: <span className="text-[13px]">{l === "all" ? "All" : LANG_NAME[l]}</span> }))}
                />
              }
              className="!p-0 [&>div:first-child]:flex-wrap [&>div:first-child]:px-5 [&>div:first-child]:pt-5 md:[&>div:first-child]:px-6 md:[&>div:first-child]:pt-6"
            >
              {list.length ? (
                <ol className="divide-y divide-[var(--hair)] border-t border-hair">
                  {list.map((r) => (
                    <li key={r.id} className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:px-6">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:block">
                        <p className="text-[13px] text-ink-2">
                          <time dateTime={r.at}>{dateTime(r.at)}</time>
                        </p>
                        <p className="text-[12px] text-muted md:mt-0.5">
                          {ago(r.at, now)} · {LANG_NAME[r.language] ?? r.language}
                        </p>
                      </div>
                      <div className="min-w-0">
                        {r.pattern_id !== "unknown" ? (
                          <a
                            href={`/console/library?p=${encodeURIComponent(r.pattern_id)}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-hair px-2.5 py-0.5 text-[12px] font-semibold text-ink-2 transition-colors hover:border-[var(--hair-strong)] hover:text-ink"
                          >
                            <MessageSquareWarning className="size-3.5" strokeWidth={1.8} aria-hidden />
                            {name(r.pattern_id)}
                          </a>
                        ) : (
                          <span className="inline-flex rounded-full border border-dashed border-[var(--hair-strong)] px-2.5 py-0.5 text-[12px] font-semibold text-muted">No clear pattern</span>
                        )}
                        <p lang={r.language === "hi" ? "hi" : "en"} className={cn("mt-2 text-[14px] leading-relaxed text-ink")}>
                          {r.summary || <span className="text-muted">No summary given.</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState icon={<Inbox />} title="Nothing in this language" className="border-t border-hair">
                  No reports in {LANG_NAME[lang] ?? lang} yet.
                </EmptyState>
              )}
            </Panel>
          </Reveal>
          {stats.top.length > 1 && (
            <Reveal>
              <Panel title="By pattern" description="What callers described, as matched by the agent.">
                <ul className="space-y-3">
                  {stats.top.map(([id, n]) => (
                    <li key={id}>
                      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                        <span className="text-ink-2">{name(id)}</span>
                        <span className="t-num text-ink">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-3" aria-hidden>
                        <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(n / stats.top[0][1]) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}

function Explainer({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="surface p-5">
      <span className="grid size-9 place-items-center rounded-full border border-hair bg-paper-2 text-ink [&>svg]:size-4 [&>svg]:stroke-[1.7]">{icon}</span>
      <p className="mt-4 font-display text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("t-num mt-1 truncate leading-tight text-ink", small ? "text-[17px]" : "text-[24px]")}>{value}</dd>
    </div>
  );
}
