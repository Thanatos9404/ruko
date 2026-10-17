import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Gauge,
  IndianRupee,
  Inbox,
  MessagesSquare,
  PhoneCall,
  PhoneOff,
  Scale,
  Timer,
} from "lucide-react";
import { Button, Panel, Reveal, Segmented, StatTile, cn } from "../../kit";
import { api, type ConsoleOverview } from "../../lib/api";
import { navigate } from "../../lib/router";
import { formatINR } from "../../../shared/format";
import type { Check } from "../../../shared/types";
import { useNow, useResource } from "./hooks";
import { ago, agoShort, clockTime, duration, int, LANG_NAME, pct, usd } from "./fmt";
import { EmptyState, ErrorState, OutcomeBadge, RiskCell, Skeleton, StaleBanner, StatusPill, TileFrame, TileHead } from "./ui";
import { SignalsChart } from "./SignalsChart";

const POLL_MS = 3000;

export function Overview() {
  const overview = useResource(() => api.consoleOverview(), [], POLL_MS);
  const checks = useResource(() => api.consoleChecks(60), [], POLL_MS);
  const m = overview.data?.metrics;

  return (
    <div className="space-y-4">
      {overview.error && overview.data && <StaleBanner error={overview.error} onRetry={overview.reload} />}

      {/* Figures */}
      {overview.loading && !overview.data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[132px] !rounded-[18px]" />
          ))}
        </div>
      ) : !m ? (
        <ErrorState error={overview.error} onRetry={overview.reload} title="Couldn't load the overview" />
      ) : (
        <Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatTile icon={<Activity />} label="Checks" value={int(m.checks)} hint={`${int(m.allowed)} allowed with no call · ${int(m.held)} held`} />
            <StatTile
              icon={<Gauge />}
              label="Hold rate"
              value={m.checks ? pct(m.hold_rate) : "–"}
              hint={m.checks ? `${int(m.held)} of ${int(m.checks)} held for a voice check` : "No payments checked yet"}
            />
            <div className="col-span-2 lg:col-span-1">
              <OutcomeTile m={m} />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <StatTile icon={<IndianRupee />} label="Held back" value={formatINR(m.inr_held_back)} hint="In payments that were delayed or blocked" />
            </div>
            <StatTile
              icon={<Timer />}
              label="Friction for genuine payers"
              value={duration(m.median_release_seconds)}
              hint={m.released ? `Median added time on ${int(m.released)} released ${m.released === 1 ? "payment" : "payments"}` : "No payment has been released after a call yet"}
            />
            <StatTile
              icon={<MessagesSquare />}
              label="Calls with a conversation"
              value={int(m.calls_with_conversation)}
              hint={`Of ${int(m.held)} held · policy stricter than the agent ${int(m.agent_overruled)}×`}
            />
          </div>
        </Reveal>
      )}

      {/* Live table */}
      <Reveal delay={0.05}>
        <ChecksPanel res={checks} />
      </Reveal>

      {/* Signals + budget */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Panel title="Signals heard" description="What the voice agent recorded on held checks, coloured by severity." className="h-full">
            {!m ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : m.signals.length ? (
              <SignalsChart data={m.signals} />
            ) : (
              <EmptyState icon={<MessagesSquare />} title="No signals yet">
                Signals appear when the agent records what it heard, such as a stranger coaching the customer on another call.
              </EmptyState>
            )}
          </Panel>
        </Reveal>
        <div className="space-y-4 xl:col-span-5">
          <Reveal delay={0.1}>
            <BudgetPanel data={overview.data} />
          </Reveal>
          <Reveal delay={0.15}>
            <Panel title="Patterns named" description="The scam pattern the policy named on delayed or blocked checks.">
              {!m ? (
                <Skeleton className="h-20" />
              ) : m.patterns.length ? (
                <ul className="space-y-3">
                  {m.patterns.map((p) => {
                    const max = Math.max(...m.patterns.map((x) => x.count));
                    return (
                      <li key={p.id}>
                        <a href={`/console/library?p=${encodeURIComponent(p.id)}`} className="group block rounded-lg">
                          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                            <span className="truncate text-ink-2 transition-colors group-hover:text-ink">{p.name}</span>
                            <span className="t-num text-ink">{p.count}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-3">
                            <motion.div
                              className="h-full rounded-full bg-ink-2"
                              initial={{ width: 0 }}
                              animate={{ width: `${(p.count / max) * 100}%` }}
                              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted">No pattern named yet. A pattern is named when a check ends delayed or blocked.</p>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- outcomes */

function OutcomeTile({ m }: { m: ConsoleOverview["metrics"] }) {
  const parts = [
    { key: "release", label: "Released", n: m.released, color: "var(--go)" },
    { key: "delay", label: "Delayed", n: m.delayed, color: "var(--sev-high)" },
    { key: "block", label: "Blocked", n: m.blocked, color: "var(--stop)" },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  return (
    <TileFrame className="h-full">
      <TileHead icon={<Scale />} label="Released · delayed · blocked" />
      <div className="mt-5 flex items-end gap-4">
        {parts.map((p, i) => (
          <div key={p.key} className="flex items-end gap-4">
            {i > 0 && <span className="mb-1.5 h-5 w-px bg-[var(--hair-strong)]" aria-hidden />}
            <span className="t-num text-[30px] leading-none text-ink" aria-label={`${p.n} ${p.label.toLowerCase()}`}>
              {p.n}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-paper-3" aria-hidden>
        {total > 0 &&
          parts
            .filter((p) => p.n > 0)
            .map((p) => <motion.span key={p.key} className="h-full" style={{ background: p.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: p.n }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label}
          </span>
        ))}
        <span className="ml-auto">{m.decided ? `${int(m.decided)} decided` : "None decided yet"}</span>
      </div>
    </TileFrame>
  );
}

/* ------------------------------------------------------------------ checks */

type Filter = "all" | "open" | "release" | "delay" | "block";
const PAGE = 12;

function matches(c: Check, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "open") return !c.decision && (c.status === "holding" || c.status === "in_call");
  return c.decision?.outcome === f;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "On hold" },
  { value: "release", label: "Released" },
  { value: "delay", label: "Delayed" },
  { value: "block", label: "Blocked" },
];

function ChecksPanel({ res }: { res: ReturnType<typeof useResource<{ data: Check[] }>> }) {
  const now = useNow(1000);
  const all = res.data?.data;
  const fresh = useFreshRows(all);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const filtered = all?.filter((c) => matches(c, filter)) ?? [];
  const rows = filtered.slice(0, limit);
  const count = (f: Filter) => all?.filter((c) => matches(c, f)).length ?? 0;

  return (
    <Panel
      title="Live checks"
      description="Newest first. Every payment the bank sent to Ruko, refreshed every 3 seconds."
      action={
        res.updatedAt ? (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-hair px-3 py-1.5 text-[12px] text-muted" aria-live="off">
            <span className={cn("rk-live", res.error ? "text-stop" : "text-go")} aria-hidden />
            <span className="hidden sm:inline">{res.error ? "Paused" : "Live"} · </span>
            {ago(res.updatedAt, now)}
          </span>
        ) : null
      }
      className="!p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5 md:[&>div:first-child]:px-6 md:[&>div:first-child]:pt-6"
    >
      {res.error && all && (
        <div className="px-5 md:px-6">
          <StaleBanner error={res.error} onRetry={res.reload} />
        </div>
      )}
      {all && all.length > 0 && (
        <div className="rk-scroll-x -mt-1 mb-4 overflow-x-auto px-5 pb-1 md:px-6">
          <Segmented
            id="checks-filter"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setLimit(PAGE);
            }}
            options={FILTERS.map((o) => ({
              value: o.value,
              label: (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
                  {o.label}
                  <span className="t-num text-[12px] opacity-60">{count(o.value)}</span>
                </span>
              ),
            }))}
          />
        </div>
      )}
      {res.loading && !all ? (
        <div className="space-y-2 px-5 pb-6 md:px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !all ? (
        <div className="px-5 pb-6 md:px-6">
          <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load checks" />
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="No checks yet"
          action={
            <Button href="/demo" size="sm" icon={<ArrowUpRight className="size-4" />}>
              Make a sandbox payment
            </Button>
          }
        >
          Make a sandbox payment and it appears here within three seconds, with its risk score, the call and the decision.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Nothing in this view" className="border-t border-hair">
          No check matches this filter right now. The list is live, so new checks land here on their own.
        </EmptyState>
      ) : (
        <>
          {/* Wide screens: a table */}
          <div className="hidden xl:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Checks for the demo tenant, newest first</caption>
              <colgroup>
                <col className="w-[96px]" />
                <col className="w-[112px]" />
                <col />
                <col className="w-[112px]" />
                <col className="w-[160px]" />
                <col className="w-[104px]" />
                <col className="w-[112px]" />
                <col className="w-[148px]" />
                <col className="w-[36px]" />
              </colgroup>
              <thead>
                <tr className="border-y border-hair text-[11px] uppercase tracking-[0.08em] text-muted [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-mono [&>th]:font-normal">
                  <th scope="col" className="!pl-6">
                    Time
                  </th>
                  <th scope="col">Customer</th>
                  <th scope="col">Payee</th>
                  <th scope="col" className="text-right">
                    Amount
                  </th>
                  <th scope="col">Risk</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Pattern</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/console/checks/${c.id}`)}
                    className={cn(
                      "group cursor-pointer border-b border-hair text-[13.5px] transition-colors last:border-b-0 focus-within:bg-paper-2 hover:bg-paper-2 [&>td]:px-3 [&>td]:py-3 [&>td]:align-middle",
                      fresh.has(c.id) && "rk-new",
                    )}
                  >
                    <td className="!pl-6">
                      <a href={`/console/checks/${c.id}`} className="block rounded-md" onClick={(e) => e.stopPropagation()}>
                        <span className="t-num block text-ink">{clockTime(c.created_at)}</span>
                        <span className="block whitespace-nowrap text-[12px] text-muted">{agoShort(c.created_at, now)}</span>
                        <span className="sr-only">Open check {c.id}</span>
                      </a>
                    </td>
                    <td>
                      <span className="block truncate text-ink">{c.customer.name}</span>
                      <span className="block text-[12px] text-muted">{LANG_NAME[c.customer.language] ?? c.customer.language}</span>
                    </td>
                    <td>
                      <span className="block truncate text-ink">{c.payment.payee.name}</span>
                      <span className="block truncate font-mono text-[11.5px] text-muted">{c.payment.payee.handle}</span>
                    </td>
                    <td className="text-right">
                      <span className="t-num block text-ink">{formatINR(c.payment.amount_inr)}</span>
                      <span className="block text-[12px] text-muted">{c.payment.rail}</span>
                    </td>
                    <td>
                      <RiskCell score={c.risk.score} band={c.risk.band} />
                    </td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td>
                      <DecisionCell c={c} />
                    </td>
                    <td className="truncate text-ink-2" title={c.decision?.pattern?.name}>
                      {c.decision?.pattern?.name ?? <span className="text-muted">–</span>}
                    </td>
                    <td className="!pl-0 !pr-4 text-muted">
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" strokeWidth={1.7} aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: one card per check */}
          <ul className="grid grid-cols-1 gap-2 px-3 pb-3 md:grid-cols-2 md:px-4 md:pb-4 xl:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <a
                  href={`/console/checks/${c.id}`}
                  className={cn("block rounded-2xl border border-hair bg-paper-2 p-4 transition-colors hover:border-[var(--hair-strong)] hover:bg-paper-3", fresh.has(c.id) && "rk-new")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-muted">
                        <span className="t-num text-ink-2">{clockTime(c.created_at)}</span> · {agoShort(c.created_at, now)}
                      </p>
                      <p className="t-num mt-1 text-[20px] leading-tight text-ink">{formatINR(c.payment.amount_inr)}</p>
                      <p className="mt-0.5 truncate text-[13.5px] text-ink-2">to {c.payment.payee.name}</p>
                    </div>
                    <DecisionCell c={c} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair pt-3 text-[13px]">
                    <span className="text-ink-2">
                      {c.customer.name} <span className="text-[12px] text-muted">{LANG_NAME[c.customer.language] ?? c.customer.language}</span>
                    </span>
                    <RiskCell score={c.risk.score} band={c.risk.band} />
                    <StatusPill status={c.status} />
                    {c.decision?.pattern && <span className="text-[12.5px] text-muted">{c.decision.pattern.name}</span>}
                  </div>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-3.5 text-[12.5px] text-muted md:px-6">
            <span>
              Showing <span className="t-num text-ink-2">{rows.length}</span> of <span className="t-num text-ink-2">{filtered.length}</span>
              {filter !== "all" ? " in this view" : ""}
            </span>
            <div className="flex items-center gap-2">
              {limit > PAGE && (
                <button type="button" className="rk-btn !h-8 !text-[12.5px]" onClick={() => setLimit(PAGE)}>
                  Show fewer
                </button>
              )}
              {filtered.length > rows.length && (
                <button type="button" className="rk-btn !h-8 !text-[12.5px]" onClick={() => setLimit((l) => l + PAGE * 2)}>
                  Show {Math.min(PAGE * 2, filtered.length - rows.length)} more
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function DecisionCell({ c }: { c: Check }) {
  if (c.decision) return <OutcomeBadge outcome={c.decision.outcome} />;
  if (c.status === "allowed") return <span className="text-[12.5px] text-muted">No call</span>;
  if (c.status === "expired") return <span className="text-[12.5px] text-muted">Expired</span>;
  return <span className="text-[12.5px] text-muted">Awaiting</span>;
}

/** Rows that are new, or whose state changed, since the previous poll. */
function useFreshRows(rows: Check[] | undefined): Set<string> {
  const prev = useRef<Map<string, string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!rows) return;
    const sig = new Map(rows.map((c) => [c.id, `${c.status}|${c.decision?.outcome ?? ""}|${c.signals.length}`]));
    if (prev.current) {
      const changed = rows.filter((c) => prev.current!.get(c.id) !== sig.get(c.id)).map((c) => c.id);
      if (changed.length) setFresh(new Set(changed));
    }
    prev.current = sig;
  }, [rows]);
  return fresh;
}

/* ------------------------------------------------------------------ budget */

const GATE_REASON: Record<string, string> = {
  not_configured: "No Bolna agent is configured on this deployment, so held checks play a recorded call through the real engine.",
  access_code_required: "Live calls are off: no judge access codes are set here. The sandbox replays recorded calls through the real engine instead.",
  access_code_invalid: "The access code given was not valid.",
  daily_cap: "Today's live-call cap is used up. The sandbox falls back to a recorded call.",
  visitor_cap: "This visitor has used their live calls for today.",
  wallet_floor: "Paused to protect the credit budget: the Bolna wallet is at its floor.",
  bolna_unreachable: "Bolna's API didn't answer the wallet check, so no call was started.",
};

function BudgetPanel({ data }: { data: ConsoleOverview | null }) {
  const live = data?.live;
  return (
    <Panel title="Live voice budget" description="Real Bolna calls cost credits, so every one passes a gate first.">
      {!data || !live ? (
        <Skeleton className="h-36" />
      ) : (
        <>
          <div className={cn("flex items-start gap-3 rounded-2xl border border-hair p-4", live.live ? "bg-go-soft" : "bg-paper-2")}>
            <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", live.live ? "bg-[color-mix(in_oklab,var(--go)_22%,transparent)] text-go" : "bg-paper-3 text-ink-2")}>
              {live.live ? <PhoneCall className="size-4" strokeWidth={1.7} /> : <PhoneOff className="size-4" strokeWidth={1.7} />}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold text-ink">{live.live ? "Live calls available" : "Live calls off"}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                {live.live ? "A judge with an access code can start a real Bolna call from the sandbox." : (GATE_REASON[live.reason ?? ""] ?? live.reason ?? "Unavailable.")}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
            <BudgetStat label="Calls left today" value={int(live.calls_left_today)} />
            <BudgetStat label="Bolna spend logged" value={usd(data.spend_cents_logged)} />
            <BudgetStat label="Spend on listed checks" value={usd(data.metrics.spend_cents)} />
            <BudgetStat label="Median call length" value={duration(data.metrics.median_call_seconds)} />
          </dl>
          <div className="mt-5 border-t border-hair pt-4">
            <p className="t-eyebrow !text-[10.5px]">Gate, in order</p>
            <ol className="mt-2.5 grid grid-cols-2 gap-1.5 text-[12px] text-ink-2">
              {["Access code", "Daily cap", "Per-visitor cap", "Wallet floor"].map((g, i) => (
                <li key={g} className="flex items-center gap-2 rounded-xl border border-hair px-2.5 py-1.5">
                  <span className="t-num grid size-[18px] shrink-0 place-items-center rounded-full bg-paper-3 text-[10.5px] text-ink-2">{i + 1}</span>
                  {g}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Panel>
  );
}

function BudgetStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="t-num mt-1 text-[20px] leading-none text-ink">{value}</dd>
    </div>
  );
}
