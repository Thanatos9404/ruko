import { useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Clock3, FlaskConical, Gauge, KeyRound, MessagesSquare, ShieldCheck, ShieldX, Timer } from "lucide-react";
import { Panel, Reveal, Segmented, cn } from "../../kit";
import { patternById } from "../../../shared/patterns";
import { getJson, useResource } from "./hooks";
import { dateTime, humanize, int, LANG_NAME } from "./fmt";
import { Chip, CIBar, EmptyState, ErrorState, OutcomeBadge, SectionTitle, Skeleton } from "./ui";
import { signalsFromToolTurns, Transcript, useHighlights, type TxTurn } from "./Transcript";
import type { Outcome } from "../../../shared/types";

/* ------------------------------------------------------------------ shapes */

// Mirrors eval/publish.ts and the Summary type in eval/score.ts. Declared here so
// the frontend build doesn't pull the eval harness (and its Node imports) in.

interface Rate {
  n: number;
  k: number;
  rate: number;
  ci95: [number, number];
}

interface Run {
  run_id: string;
  label: string;
  set: "dev" | "holdout" | "holdout2";
  clean_holdout: boolean;
  scenarios: number;
  scam_catch: Rate;
  scam_block: Rate;
  false_hold: Rate;
  ambiguous_ok: Rate | null;
  otp_requests: number;
  agent_turns: number;
  median_turns: number | null;
  median_seconds: number | null;
  truth_said?: Rate;
}

interface Results {
  generated_at: string;
  version: string;
  agent_model: string;
  customer_model: string;
  current: Run[];
  history: Run[];
  combined_current?: { scam_catch: Rate; false_hold: Rate };
  totals: { conversations: number; agent_turns: number; otp_requests: number };
  tool_latency_ms?: { p50: number; p95: number; n: number; where: string; measured_at?: string; by_tool?: Record<string, { n: number; p50: number; p95: number }> } | null;
}

interface Summary {
  run_id: string;
  generated_at: string;
  models?: { agent: string; customer: string; judge?: string };
  counts: { scenarios: number; scam: number; genuine: number; ambiguous: number };
  end_to_end?: { note: string; scam_caught: Rate; scam_missed_by_precall: number; genuine_called: Rate; genuine_ended_held: Rate };
  detail?: {
    by_style?: Record<string, { catch: Rate; false_hold: Rate }>;
    by_coaching?: { light: Rate; heavy: Rate };
    by_pattern?: Record<string, { catch: Rate; named_correctly: Rate }>;
    pattern_named_correctly?: Rate;
    truth_said_when_caught?: Rate;
    contact_requested_in_scams_with_contact?: Rate;
    policy_stricter_than_agent?: number;
    agent_said_release_on_caught_scam?: number;
    errors?: number;
    llm_calls?: number;
  };
  failures?: { scenario: string; expected: string[]; got: string | null; why: string }[];
}

interface Sample {
  id: string;
  run: string;
  decision: Outcome | null;
  detected_pattern: string | null;
  est_seconds: number;
  turns: TxTurn[];
}

/* ----------------------------------------------------------------- helpers */

const p0 = (r: number) => `${Math.round(r * 100)}%`;
const p1 = (r: number) => {
  const v = r * 100;
  return v === 0 || v === 100 ? `${v}%` : `${v.toFixed(1)}%`;
};
const ci = (r: Rate) => `${Math.round(r.ci95[0] * 100)}–${Math.round(r.ci95[1] * 100)}%`;
const version = (id: string) => id.match(/^v\d+/)?.[0] ?? "";
const ACRONYMS = new Set(["ed", "rbi", "gst", "olx", "apk", "kyc", "sim", "upi", "cbi", "otp", "pin", "ncb", "trai", "ipo", "emi", "cvv"]);
/** Library name when the ID is a library pattern; otherwise the eval story ID made readable. */
const patternName = (id: string) =>
  patternById(id)?.name.en ??
  humanize(id)
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w))
    .join(" ");
const STYLE: Record<string, string> = { ...LANG_NAME, hinglish: "Hinglish (code-mixed)" };

const HONESTY =
  "Text mode. An LLM plays the customer; the agent is a Nebius-hosted stand-in (Qwen3-30B-A3B) for Bolna's gpt-4.1-mini, running the same prompt and tools against the real engine. Seconds are estimated from transcript length.";

/* -------------------------------------------------------------------- page */

export function Evaluation() {
  const results = useResource(() => getJson<Results>("/eval/results.json"), []);
  const dev = useResource(() => getJson<Summary>("/eval/summary.json"), []);
  const fresh = useResource(() => getJson<Summary>("/eval/summary-holdout2.json"), []);
  const samples = useResource(() => getJson<Sample[]>("/eval/samples.json"), []);
  const r = results.data;

  if (!r) {
    if (results.loading)
      return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading evaluation results">
          <Skeleton className="h-[120px] !rounded-[20px]" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-[420px] !rounded-[20px]" />
            <Skeleton className="h-[420px] !rounded-[20px]" />
          </div>
        </div>
      );
    return <ErrorState error={results.error} onRetry={results.reload} title="Couldn't load the evaluation results" />;
  }

  const clean = r.current.find((c) => c.clean_holdout) ?? null;
  const devRun = r.current.find((c) => c.set === "dev") ?? null;

  return (
    <div className="space-y-10">
      <Reveal>
        <Method r={r} />
      </Reveal>

      <section aria-labelledby="eval-current" className="space-y-4">
        <SectionTitle id="eval-current" eyebrow={`Current version · ${r.version}`} title="How the voice check performs now">
          The fresh held-out set was written after {r.version} was frozen and never used for tuning, so it is the honest number. The development set is where the prompt was tuned.
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {clean && (
            <Reveal>
              <RunPanel run={clean} lead />
            </Reveal>
          )}
          {devRun && (
            <Reveal delay={0.05}>
              <RunPanel run={devRun} />
            </Reveal>
          )}
        </div>
        {r.combined_current && (
          <Reveal>
            <Combined r={r} />
          </Reveal>
        )}
      </section>

      <section aria-labelledby="eval-history" className="space-y-4">
        <SectionTitle id="eval-history" eyebrow="Version history" title="How the numbers moved">
          Every run is listed, including the ones that look worse. A held-out set is only clean for the version that never saw it.
        </SectionTitle>
        <Reveal>
          <History r={r} />
        </Reveal>
      </section>

      <section aria-labelledby="eval-e2e" className="space-y-4">
        <SectionTitle id="eval-e2e" eyebrow="End to end" title="With the pre-call risk score in front">
          {dev.data?.end_to_end?.note ?? "A payment the pre-call policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction."}
        </SectionTitle>
        <Reveal>
          <EndToEnd dev={dev.data} fresh={fresh.data} />
        </Reveal>
      </section>

      <section aria-labelledby="eval-breakdown" className="space-y-4">
        <Breakdowns dev={dev} fresh={fresh} />
      </section>

      <section aria-labelledby="eval-samples" className="space-y-4">
        <SectionTitle id="eval-samples" eyebrow="Transcripts" title="Read the conversations">
          Samples from the current runs, misses included. Evidence from each record_signal call is highlighted where it was said.
        </SectionTitle>
        <Reveal>
          <Samples res={samples} runs={[...r.current, ...r.history]} />
        </Reveal>
      </section>

      <section aria-labelledby="eval-latency" className="space-y-4">
        <SectionTitle id="eval-latency" eyebrow="Latency" title="Tool endpoint response time">
          How long Ruko takes to answer the agent's custom-function calls. Measured, not estimated.
        </SectionTitle>
        <Reveal>
          <Latency r={r} />
        </Reveal>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ method */

function Method({ r }: { r: Results }) {
  return (
    <section className="surface p-5 md:p-6" aria-labelledby="eval-method">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-[78ch] gap-3.5">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-hair bg-paper-2 text-ink">
            <FlaskConical className="size-[18px]" strokeWidth={1.7} aria-hidden />
          </span>
          <div>
            <h2 id="eval-method" className="t-eyebrow !text-[11px]">
              How this was measured
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{HONESTY}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              An LLM judge reviews every agent line that mentions an OTP, PIN, CVV or password and counts it only if it asks for one. Intervals are 95% Wilson intervals; small sets give wide ones.
            </p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-1 lg:grid-cols-1 lg:gap-y-3 lg:text-right">
          <Stat label="Conversations" value={int(r.totals.conversations)} />
          <Stat label="Agent turns" value={int(r.totals.agent_turns)} />
          <Stat label="OTP or PIN asked" value={int(r.totals.otp_requests)} />
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-hair pt-4 text-[12.5px] text-muted">
        <span>
          Agent <span className="font-mono text-[12px] text-ink-2">{r.agent_model}</span>
        </span>
        <span>
          Customer <span className="font-mono text-[12px] text-ink-2">{r.customer_model}</span>
        </span>
        <span>Published {dateTime(r.generated_at)} IST</span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="t-num text-[22px] leading-tight text-ink">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------- run panels */

function RunPanel({ run, lead }: { run: Run; lead?: boolean }) {
  return (
    <Panel
      className={cn("h-full", lead && "ring-1 ring-[color-mix(in_oklab,var(--go)_35%,transparent)]")}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {run.set === "dev" ? "Development set" : "Fresh held-out set"}
          {run.clean_holdout ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-go-soft px-2 py-0.5 text-[11.5px] font-semibold text-go">
              <BadgeCheck className="size-3.5" strokeWidth={1.9} aria-hidden />
              Clean held-out
            </span>
          ) : (
            <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[11.5px] font-semibold text-muted">Used for tuning</span>
          )}
        </span>
      }
      description={`${int(run.scenarios)} conversations · ${run.label}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RateTile icon={<ShieldCheck />} label="Scam catch rate" rate={run.scam_catch} unit="scams delayed or blocked" tone="go" />
        <RateTile icon={<ShieldX />} label="False holds on genuine payments" rate={run.false_hold} unit="genuine payments left held" tone="stop" lowerBetter />
        <RateTile icon={<Gauge />} label="Scams blocked outright" rate={run.scam_block} unit="scams blocked, not just delayed" />
        <Tile icon={<KeyRound />} label="OTP or PIN requests" value={int(run.otp_requests)} note={`in ${int(run.agent_turns)} agent turns`} good={run.otp_requests === 0} />
        <Tile icon={<MessagesSquare />} label="Median customer turns" value={run.median_turns === null ? "–" : String(run.median_turns)} note={`to a decision · n = ${int(run.scenarios)}`} />
        <Tile icon={<Timer />} label="Median time to decision" value={run.median_seconds === null ? "–" : `${run.median_seconds} s`} note={`estimated from transcript length · n = ${int(run.scenarios)}`} />
      </div>
    </Panel>
  );
}

function RateTile({ icon, label, rate, unit, tone = "ink", lowerBetter }: { icon: ReactNode; label: string; rate: Rate; unit: string; tone?: "ink" | "go" | "stop"; lowerBetter?: boolean }) {
  return (
    <div className="rounded-2xl border border-hair bg-paper-2 p-4">
      <TileLabel icon={icon}>{label}</TileLabel>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="t-num text-[30px] leading-none text-ink">{p1(rate.rate)}</span>
        <span className="text-[12.5px] text-muted">
          {rate.k} of {rate.n} {unit}
        </span>
      </p>
      <CIBar rate={rate.rate} ci={rate.ci95} tone={tone} className="mt-3.5" label={`${label}: ${p1(rate.rate)}, 95% interval ${ci(rate)}`} />
      <p className="mt-2 text-[12px] text-muted">
        95% CI {ci(rate)} · n = {rate.n}
        {lowerBetter ? " · lower is better" : ""}
      </p>
    </div>
  );
}

function Tile({ icon, label, value, note, good }: { icon: ReactNode; label: string; value: string; note: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-hair bg-paper-2 p-4">
      <TileLabel icon={icon}>{label}</TileLabel>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={cn("t-num text-[30px] leading-none", good ? "text-go" : "text-ink")}>{value}</span>
      </p>
      <p className="mt-[22px] text-[12px] text-muted">{note}</p>
    </div>
  );
}

function TileLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex min-h-[40px] items-start gap-2 text-[13px] font-medium leading-[1.5] text-ink-2 [&>svg]:mt-[2px] [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.7] [&>svg]:text-muted">
      {icon}
      {children}
    </p>
  );
}

function Combined({ r }: { r: Results }) {
  const c = r.combined_current!;
  const n = r.current.reduce((s, x) => s + x.scenarios, 0);
  return (
    <div className="surface flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:gap-8">
      <div className="xl:max-w-[34ch]">
        <p className="font-display text-[15px] font-semibold text-ink">All {r.current.length} {r.version} runs combined</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {r.current.map((x) => x.label.split(",")[0].replace(/\s*\(\d+\)/, "")).join(", ")}: {int(n)} conversations. Pooling includes runs that were used for tuning.
        </p>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
        <CombinedRate label="Scam catch rate" rate={c.scam_catch} tone="go" />
        <CombinedRate label="False holds on genuine payments" rate={c.false_hold} tone="stop" />
      </div>
    </div>
  );
}

function CombinedRate({ label, rate, tone }: { label: string; rate: Rate; tone: "go" | "stop" }) {
  return (
    <div>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="t-num text-[22px] text-ink">{p1(rate.rate)}</span>
      </p>
      <CIBar rate={rate.rate} ci={rate.ci95} tone={tone} className="mt-2" />
      <p className="mt-1.5 text-[12px] text-muted">
        {rate.k}/{rate.n} · 95% CI {ci(rate)}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- history */

function History({ r }: { r: Results }) {
  const rows = [...r.history, ...r.current].sort((a, b) => version(a.run_id).localeCompare(version(b.run_id), undefined, { numeric: true }) || order(a.set) - order(b.set));
  return (
    <Panel className="!p-0">
      <div className="rk-scroll-x relative overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <caption className="sr-only">Every evaluation run by version</caption>
          <thead>
            <tr className="border-b border-hair text-[11px] uppercase tracking-[0.08em] text-muted [&>th]:px-3 [&>th]:py-3 [&>th]:font-mono [&>th]:font-normal">
              <th scope="col" className="!pl-6">
                Run
              </th>
              <th scope="col">Set</th>
              <th scope="col" className="text-right">
                n
              </th>
              <th scope="col">Scam catch</th>
              <th scope="col" className="w-[180px]">
                <span className="sr-only">Catch rate interval</span>
                <span aria-hidden>50%</span>
                <span aria-hidden className="float-right">
                  100%
                </span>
              </th>
              <th scope="col" className="text-right">
                Blocked
              </th>
              <th scope="col" className="text-right">
                False holds
              </th>
              <th scope="col" className="text-right">
                OTP asks
              </th>
              <th scope="col" className="!pr-6 text-right">
                Median
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const current = version(x.run_id) === r.version;
              return (
                <tr key={x.run_id} className={cn("border-b border-hair text-[13.5px] last:border-b-0 [&>td]:px-3 [&>td]:py-3", current && "bg-paper-2")}>
                  <td className="!pl-6">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-ink">{version(x.run_id)}</span>
                      {current && <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">Current</span>}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted">{x.run_id}</span>
                  </td>
                  <td>
                    <span className="block text-ink-2">{x.set === "dev" ? "Development" : x.set === "holdout" ? "Held-out set 1" : "Fresh held-out"}</span>
                    {x.clean_holdout ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-go">
                        <BadgeCheck className="size-3.5" strokeWidth={1.9} aria-hidden />
                        Clean held-out
                      </span>
                    ) : x.set !== "dev" ? (
                      <span className="mt-0.5 block text-[12px] text-muted">Seen during tuning</span>
                    ) : null}
                  </td>
                  <td className="t-num text-right text-ink-2">{x.scenarios}</td>
                  <td>
                    <span className="t-num text-ink">{p1(x.scam_catch.rate)}</span>
                    <span className="ml-1.5 text-[12px] text-muted">
                      {x.scam_catch.k}/{x.scam_catch.n}
                    </span>
                  </td>
                  <td>
                    <Forest rate={x.scam_catch} />
                  </td>
                  <td className="t-num text-right text-ink-2">{p0(x.scam_block.rate)}</td>
                  <td className="text-right">
                    <span className={cn("t-num", x.false_hold.k > 0 ? "text-stop" : "text-ink-2")}>{p1(x.false_hold.rate)}</span>
                    <span className="ml-1.5 text-[12px] text-muted">
                      {x.false_hold.k}/{x.false_hold.n}
                    </span>
                  </td>
                  <td className={cn("t-num text-right", x.otp_requests ? "text-stop" : "text-ink-2")}>{x.otp_requests}</td>
                  <td className="!pr-6 text-right text-ink-2">
                    <span className="t-num">{x.median_turns ?? "–"}</span>
                    <span className="text-[12px] text-muted"> turns · </span>
                    <span className="t-num">{x.median_seconds ?? "–"}</span>
                    <span className="text-[12px] text-muted"> s</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const order = (s: string) => (s === "dev" ? 0 : s === "holdout" ? 1 : 2);

/** A catch rate and its interval on a 50–100% axis, so close runs are distinguishable. */
function Forest({ rate }: { rate: Rate }) {
  const x = (v: number) => `${Math.max(0, Math.min(1, (v - 0.5) / 0.5)) * 100}%`;
  return (
    <div className="relative h-4" role="img" aria-label={`${p1(rate.rate)}, 95% interval ${ci(rate)}`}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--hair-strong)]" />
      <span className="absolute left-1/2 top-0.5 h-3 w-px bg-[var(--hair)]" />
      <span className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[color-mix(in_oklab,var(--go)_45%,transparent)]" style={{ left: x(rate.ci95[0]), right: `calc(100% - ${x(rate.ci95[1])})` }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-go" style={{ left: x(rate.rate) }} />
    </div>
  );
}

/* -------------------------------------------------------------- end to end */

function EndToEnd({ dev, fresh }: { dev: Summary | null; fresh: Summary | null }) {
  const sets = [
    { key: "fresh", label: "Fresh held-out set", s: fresh },
    { key: "dev", label: "Development set", s: dev },
  ].filter((x) => x.s?.end_to_end);
  if (!sets.length)
    return (
      <div className="surface">
        <EmptyState icon={<FlaskConical />} title="End-to-end numbers aren't published">
          They appear here once the eval summaries are published.
        </EmptyState>
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {sets.map(({ key, label, s }) => {
        const e = s!.end_to_end!;
        const scamN = e.scam_caught.n;
        const missed = e.scam_missed_by_precall;
        const caught = e.scam_caught.k;
        const releasedAfterCall = Math.max(0, scamN - missed - caught);
        const genN = e.genuine_called.n;
        const called = e.genuine_called.k;
        const endedHeld = e.genuine_ended_held.k;
        return (
          <Panel key={key} title={label} description={`${int(s!.counts.scenarios)} conversations, scored after the pre-call policy decides who gets a call.`}>
            <div className="space-y-6">
              <Funnel
                title="Scams"
                headline={`${p1(e.scam_caught.rate)} caught end to end`}
                sub={`${caught} of ${scamN} · 95% CI ${ci(e.scam_caught)}`}
                parts={[
                  { label: "Caught on the call", n: caught, cls: "bg-go" },
                  { label: "Called, but released", n: releasedAfterCall, cls: "bg-stop" },
                  { label: "Allowed with no call", n: missed, cls: "rk-hatch bg-stop-soft", hatch: "var(--stop)" },
                ]}
              />
              <Funnel
                title="Genuine payments"
                headline={`${p1(e.genuine_ended_held.rate)} left held`}
                sub={`${called} of ${genN} got a call (${p0(e.genuine_called.rate)}); ${endedHeld} still held after it`}
                parts={[
                  { label: "No call, no friction", n: genN - called, cls: "rk-hatch bg-paper-3", hatch: "var(--muted)" },
                  { label: "Called, then released", n: called - endedHeld, cls: "bg-go" },
                  { label: "Called and still held", n: endedHeld, cls: "bg-stop" },
                ]}
              />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function Funnel({ title, headline, sub, parts }: { title: string; headline: string; sub: string; parts: { label: string; n: number; cls: string; hatch?: string }[] }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.n, 0));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-semibold text-ink-2">{title}</p>
        <p className="sm:text-right">
          <span className="t-num text-[17px] text-ink">{headline}</span>
          <span className="ml-2 inline-block text-[12px] text-muted">{sub}</span>
        </p>
      </div>
      <div className="mt-2.5 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.n}`).join(", ")}>
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <span key={p.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.cls)} style={{ width: `${(p.n / total) * 100}%`, ["--hatch" as string]: p.hatch }} />
          ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {parts.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px]", p.cls)} style={{ ["--hatch" as string]: p.hatch }} aria-hidden />
            {p.label} <span className="t-num text-ink-2">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- breakdowns */

function Breakdowns({ dev, fresh }: { dev: ReturnType<typeof useResource<Summary>>; fresh: ReturnType<typeof useResource<Summary>> }) {
  const [which, setWhich] = useState<"fresh" | "dev">("fresh");
  const res = which === "dev" ? dev : fresh;
  const s = res.data;
  const d = s?.detail;
  return (
    <>
      <SectionTitle
        id="eval-breakdown"
        eyebrow="Breakdown"
        title="Where it holds up, and where it doesn't"
        action={
          <div className="relative max-w-full overflow-x-auto">
            <Segmented
              id="eval-set"
              value={which}
              onChange={setWhich}
              options={[
                { value: "fresh", label: <span className="whitespace-nowrap text-[13px]">Fresh held-out</span> },
                { value: "dev", label: <span className="whitespace-nowrap text-[13px]">Development</span> },
              ]}
            />
          </div>
        }
      >
        Language style, how hard the scammer coached, and each scam story. Small cells, so read the intervals.
      </SectionTitle>
      {!s ? (
        res.loading ? (
          <Skeleton className="h-[360px] !rounded-[20px]" />
        ) : (
          <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load this summary" />
        )
      ) : (
        <Reveal key={which} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="By language style" description="How the customer spoke.">
              <RateTable
                head={["Style", "Scam catch", "False holds"]}
                rows={Object.entries(d?.by_style ?? {}).map(([k, v]) => ({ key: k, label: STYLE[k] ?? humanize(k), a: v.catch, b: v.false_hold }))}
              />
            </Panel>
            <Panel title="By coaching" description="Heavy coaching: the scammer scripted the customer to deny everything.">
              <RateTable
                head={["Coaching", "Scam catch"]}
                rows={d?.by_coaching ? [
                  { key: "light", label: "Light", a: d.by_coaching.light },
                  { key: "heavy", label: "Heavy", a: d.by_coaching.heavy },
                ] : []}
              />
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hair pt-4">
                {d?.pattern_named_correctly && <MiniRate label="Pattern named correctly" rate={d.pattern_named_correctly} />}
                {d?.truth_said_when_caught && <MiniRate label="Truth said when caught" rate={d.truth_said_when_caught} />}
                {d?.contact_requested_in_scams_with_contact && <MiniRate label="Trusted contact offered" rate={d.contact_requested_in_scams_with_contact} />}
                {d?.policy_stricter_than_agent !== undefined && (
                  <div>
                    <dt className="text-[12px] text-muted">Policy stricter than the agent</dt>
                    <dd className="t-num mt-1 text-[18px] text-ink">{d.policy_stricter_than_agent}×</dd>
                  </div>
                )}
              </dl>
            </Panel>
          </div>
          <Panel title="By scam story" description={which === "dev" ? "Library patterns, each played in three language styles at two coaching levels." : "New stories written for this set, not in the tuning data."}>
            <StoryTable byPattern={d?.by_pattern ?? {}} />
          </Panel>
          <Panel title={`Misses${s.failures ? ` (${s.failures.length})` : ""}`} description="Every conversation that ended with the wrong decision, with the evidence the policy saw.">
            {s.failures?.length ? (
              <ul className="divide-y divide-[var(--hair)]">
                {s.failures.map((f) => (
                  <li key={f.scenario} className="grid grid-cols-1 gap-x-5 gap-y-1.5 py-3.5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-[12.5px] text-ink">{f.scenario}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{f.why}</p>
                    </div>
                    <p className="flex items-center gap-2 text-[12.5px] text-muted md:justify-end">
                      expected {f.expected.join(" or ")} · got
                      {f.got === "release" || f.got === "delay" || f.got === "block" ? <OutcomeBadge outcome={f.got} /> : <span className="text-ink-2">{f.got ?? "no decision"}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<BadgeCheck />} title="No misses on this set" className="py-8">
                Every conversation in this run ended with an acceptable decision.
              </EmptyState>
            )}
          </Panel>
        </Reveal>
      )}
    </>
  );
}

function RateTable({ head, rows }: { head: string[]; rows: { key: string; label: string; a: Rate; b?: Rate }[] }) {
  if (!rows.length) return <p className="text-[13.5px] text-muted">Not in this summary.</p>;
  return (
    <div className="rk-scroll-x relative -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-hair text-[11px] uppercase tracking-[0.08em] text-muted [&>th]:py-2 [&>th]:font-mono [&>th]:font-normal">
            {head.map((h, i) => (
              <th key={h} scope="col" className={i ? "w-[34%] pl-3" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-hair last:border-b-0 [&>td]:py-2.5">
              <td className="pr-3 text-ink-2">{r.label}</td>
              <td className="pl-3">
                <RateCell rate={r.a} tone="go" />
              </td>
              {r.b && (
                <td className="pl-3">
                  <RateCell rate={r.b} tone={head[2] === "False holds" ? "stop" : "ink"} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NOT_APPLICABLE: Rate = { n: -1, k: 0, rate: 0, ci95: [0, 0] };

/** Stories outside the library have no name to match, so that column only appears when it means something. */
function StoryTable({ byPattern }: { byPattern: Record<string, { catch: Rate; named_correctly: Rate }> }) {
  const entries = Object.entries(byPattern);
  const anyLibrary = entries.some(([k]) => patternById(k));
  const rows = entries
    .map(([k, v]) => ({ key: k, label: patternName(k), a: v.catch, b: anyLibrary ? (patternById(k) ? v.named_correctly : NOT_APPLICABLE) : undefined }))
    .sort((x, y) => x.a.rate - y.a.rate || x.label.localeCompare(y.label));
  return (
    <>
      <RateTable head={anyLibrary ? ["Story", "Scam catch", "Pattern named"] : ["Story", "Scam catch"]} rows={rows} />
      {!anyLibrary && rows.length > 0 && <p className="mt-3 text-[12.5px] text-muted">These stories aren't library patterns, so there's no pattern name to score.</p>}
    </>
  );
}

function RateCell({ rate, tone }: { rate: Rate; tone: "go" | "stop" | "ink" }) {
  if (rate.n < 0)
    return (
      <span className="text-[12.5px] text-muted" title="This story isn't a library pattern, so there is no name to match.">
        New story, no library name
      </span>
    );
  if (!rate.n) return <span className="text-[12.5px] text-muted">None in this set</span>;
  return (
    <span className="flex items-center gap-2.5">
      <span className="t-num w-12 shrink-0 text-ink">{p0(rate.rate)}</span>
      <span className="w-10 shrink-0 text-[12px] text-muted">
        {rate.k}/{rate.n}
      </span>
      <CIBar rate={rate.rate} ci={rate.ci95} tone={tone} className="hidden min-w-[48px] flex-1 sm:block" />
    </span>
  );
}

function MiniRate({ label, rate }: { label: string; rate: Rate }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1">
        {rate.n ? (
          <>
            <span className="t-num text-[18px] text-ink">{p0(rate.rate)}</span>
            <span className="ml-1.5 text-[12px] text-muted">
              {rate.k}/{rate.n}
            </span>
          </>
        ) : (
          <span className="text-[13px] text-muted">Not applicable here</span>
        )}
      </dd>
    </div>
  );
}

/* ----------------------------------------------------------------- samples */

const KIND = (id: string) => (id.includes("scam-") ? "scam" : id.includes("genuine-") ? "genuine" : id.includes("ambiguous-") ? "ambiguous" : "other");

function Samples({ res, runs }: { res: ReturnType<typeof useResource<Sample[]>>; runs: Run[] }) {
  const list = res.data ?? [];
  const [pick, setPick] = useState(0);
  const s = list[Math.min(pick, list.length - 1)];
  if (!res.data) {
    if (res.loading) return <Skeleton className="h-[480px] !rounded-[20px]" />;
    return <ErrorState error={res.error} onRetry={res.reload} title="Couldn't load sample transcripts" />;
  }
  if (!list.length)
    return (
      <div className="surface">
        <EmptyState icon={<MessagesSquare />} title="No samples published">
          Sample transcripts appear here when the eval run is published.
        </EmptyState>
      </div>
    );
  const runLabel = (id: string) => {
    const r = runs.find((x) => x.run_id === id);
    return r ? (r.set === "dev" ? `${version(id)} · development` : r.clean_holdout ? `${version(id)} · fresh held-out` : `${version(id)} · held-out`) : id;
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <div className="surface p-2" role="listbox" aria-label="Sample conversations" aria-activedescendant={`sample-${pick}`}>
        {list.map((x, i) => {
          const kind = KIND(x.id);
          const miss = (kind === "scam" && x.decision === "release") || (kind === "genuine" && x.decision !== "release");
          return (
            <button
              key={`${x.run}-${x.id}`}
              id={`sample-${i}`}
              type="button"
              role="option"
              aria-selected={i === pick}
              onClick={() => setPick(i)}
              className={cn("block w-full rounded-2xl px-3.5 py-3 text-left transition-colors", i === pick ? "bg-paper-3" : "hover:bg-paper-2")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12px] text-ink">{x.id}</span>
                {x.decision && <OutcomeBadge outcome={x.decision} className="!px-2 !py-0.5 !text-[11px]" />}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                {runLabel(x.run)} · {humanize(kind)}
                {miss && <span className="font-semibold text-stop">Miss</span>}
              </span>
            </button>
          );
        })}
      </div>
      {s && <SampleView key={`${s.run}-${s.id}`} s={s} runLabel={runLabel(s.run)} />}
    </div>
  );
}

function SampleView({ s, runLabel }: { s: Sample; runLabel: string }) {
  const turns = s.turns;
  const signals = useMemo(() => signalsFromToolTurns(turns), [turns]);
  const hl = useHighlights(signals, turns);
  const [active, setActive] = useState<string | null>(null);
  const lang = /[ऀ-ॿ]/.test(turns.map((t) => t.text ?? "").join(" ")) ? "hi" : "en";
  const kind = KIND(s.id);
  const parts = s.id.split("-");
  return (
    <Panel
      title={<span className="break-all font-mono text-[14px]">{s.id}</span>}
      description={`${runLabel} · expected ${kind === "scam" ? "delay or block" : kind === "genuine" ? "release" : "release or delay"}`}
      action={s.decision ? <OutcomeBadge outcome={s.decision} size="md" /> : undefined}
    >
      <div className="flex flex-wrap gap-1.5">
        {parts.includes("heavy") && <Chip>Heavy coaching</Chip>}
        {parts.includes("light") && <Chip>Light coaching</Chip>}
        {["en", "hi", "hinglish"].filter((l) => parts.includes(l)).map((l) => (
          <Chip key={l}>{STYLE[l]}</Chip>
        ))}
        <Chip>
          <Clock3 />
          {s.est_seconds} s estimated
        </Chip>
        <Chip>{s.detected_pattern ? `Named: ${patternName(s.detected_pattern)}` : "No pattern named"}</Chip>
        <Chip>
          {signals.length} {signals.length === 1 ? "signal" : "signals"}
        </Chip>
      </div>
      <div className="rk-scroll-x relative mt-4 max-h-[560px] overflow-y-auto rounded-2xl border border-hair bg-paper p-3 sm:p-4" tabIndex={0} role="region" aria-label="Sample transcript, scrollable">
        <Transcript turns={turns} signals={signals} highlights={hl} active={active} onActive={setActive} customerName="Customer" lang={lang} idPrefix="sample" />
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- latency */

function Latency({ r }: { r: Results }) {
  const l = r.tool_latency_ms;
  if (!l)
    return (
      <div className="surface">
        <EmptyState icon={<Timer />} title="No latency measurement published">
          Run the latency bench and publish the eval results to see it here.
        </EmptyState>
      </div>
    );
  const tools = Object.entries(l.by_tool ?? {}).sort((a, b) => b[1].p50 - a[1].p50);
  const max = Math.max(l.p95, ...tools.map(([, t]) => t.p95), 1);
  return (
    <Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10">
        <div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="p50" value={`${l.p50} ms`} />
            <Stat label="p95" value={`${l.p95} ms`} />
            <Stat label="Calls" value={int(l.n)} />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Where: <span className="text-ink-2">{l.where}</span>
            {l.measured_at ? <> · {dateTime(l.measured_at)} IST</> : null}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">A deployed function adds network time on top; Bolna waits on these calls mid-sentence, so they stay small.</p>
        </div>
        {tools.length > 0 && (
          <ul className="space-y-4" aria-label="Latency by tool">
            {tools.map(([name, t]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <code className="font-mono text-[12.5px] text-ink">{name}()</code>
                  <span className="text-muted">
                    p50 <span className="t-num text-ink">{t.p50}</span> · p95 <span className="t-num text-ink">{t.p95}</span> ms · n {t.n}
                  </span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-paper-3" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_oklab,var(--ink)_22%,transparent)]" style={{ width: `${(t.p95 / max) * 100}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded-full bg-ink-2" style={{ width: `${(t.p50 / max) * 100}%` }} />
                </div>
              </li>
            ))}
            <li className="flex gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-ink-2" aria-hidden />
                p50
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-[color-mix(in_oklab,var(--ink)_22%,transparent)]" aria-hidden />
                p95
              </span>
            </li>
          </ul>
        )}
      </div>
    </Panel>
  );
}
