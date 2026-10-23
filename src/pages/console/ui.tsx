import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, AudioLines, Check as CheckIcon, CircleCheck, Clock3, Copy, FlaskConical, MonitorSmartphone, OctagonX, RefreshCw, TriangleAlert } from "lucide-react";
import { cn, EASE } from "../../kit";
import type { CheckStatus, Confidence, Outcome, RiskBand, Severity } from "../../../shared/types";
import { copyText } from "./hooks";

/* ------------------------------------------------------------------ outcome */

export const OUTCOME: Record<Outcome, { label: string; verb: string; icon: typeof CircleCheck; cls: string; text: string }> = {
  release: { label: "Released", verb: "release", icon: CircleCheck, cls: "bg-go-soft text-go", text: "text-go" },
  delay: { label: "Delayed", verb: "delay", icon: Clock3, cls: "bg-accent-soft text-accent", text: "text-accent" },
  // Solid fill so a block reads as the strongest state even where the hold and stop tones are close.
  block: { label: "Blocked", verb: "block", icon: OctagonX, cls: "bg-stop text-[var(--accent-ink)]", text: "text-stop" },
};

export function OutcomeBadge({ outcome, size = "sm", className }: { outcome: Outcome; size?: "sm" | "md" | "lg"; className?: string }) {
  const m = OUTCOME[outcome];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-display font-semibold",
        size === "sm" && "px-2.5 py-1 text-[12px] [&>svg]:size-3.5",
        size === "md" && "px-3 py-1.5 text-[13.5px] [&>svg]:size-4",
        size === "lg" && "px-5 py-2.5 text-[20px] tracking-[-0.01em] [&>svg]:size-[22px]",
        m.cls,
        className,
      )}
    >
      <Icon strokeWidth={size === "lg" ? 1.8 : 1.9} aria-hidden />
      {m.label}
    </span>
  );
}

/* ------------------------------------------------------------------- status */

const STATUS: Record<CheckStatus, { label: string; live?: boolean; cls: string }> = {
  allowed: { label: "Allowed", cls: "text-muted" },
  holding: { label: "Holding", live: true, cls: "text-accent" },
  in_call: { label: "On call", live: true, cls: "text-go" },
  decided: { label: "Decided", cls: "text-ink-2" },
  expired: { label: "Expired", cls: "text-muted" },
};

export function StatusPill({ status }: { status: CheckStatus }) {
  const s = STATUS[status] ?? { label: status, cls: "text-muted" };
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium", s.cls)}>
      {s.live ? <span className="rk-live size-2" aria-hidden /> : <span className="size-2 rounded-full bg-current opacity-40" aria-hidden />}
      {s.label}
    </span>
  );
}

/* --------------------------------------------------------------------- risk */

export const BAND: Record<RiskBand, { label: string; fill: string; text: string }> = {
  low: { label: "Low", fill: "var(--go)", text: "text-go" },
  elevated: { label: "Elevated", fill: "var(--sev-high)", text: "text-accent" },
  high: { label: "High", fill: "var(--stop)", text: "text-stop" },
};

/** Compact score cell: number, a 0–100 track, and the band in words. */
export function RiskCell({ score, band }: { score: number; band: RiskBand }) {
  const b = BAND[band] ?? BAND.low;
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Risk ${score} of 100, ${b.label}`}>
      <span className="t-num w-7 text-right text-[14px] text-ink">{score}</span>
      <span className="relative h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-paper-3" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(4, score)}%`, background: b.fill }} />
      </span>
      <span className="text-[12.5px] text-muted">{b.label}</span>
    </span>
  );
}

/* ----------------------------------------------------------------- severity */

export const SEVERITY: Record<Severity, { label: string; color: string }> = {
  critical: { label: "Critical", color: "var(--sev-critical)" },
  high: { label: "High", color: "var(--sev-high)" },
  medium: { label: "Medium", color: "var(--sev-medium)" },
  mitigating: { label: "Mitigating", color: "var(--sev-mitigating)" },
  process: { label: "Process", color: "var(--sev-process)" },
};

export function SeverityTag({ severity, className }: { severity: Severity | string; className?: string }) {
  const s = SEVERITY[severity as Severity] ?? { label: severity, color: "var(--muted)" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hair px-2 py-0.5 text-[11.5px] font-semibold text-ink-2", className)}>
      <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

export function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const n = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-[1px]", i < n ? "bg-ink-2" : "bg-paper-3")} style={{ height: 5 + i * 3 }} />
        ))}
      </span>
      {confidence} confidence
    </span>
  );
}

/* ------------------------------------------------------------------- origin */

const ORIGIN_NOTE = "An eval conversation replayed through the real engine. The customer is an LLM playing a scripted person, not a real customer.";

const SCRIPTED_NOTE = "One of our own test runs: a real, live Bolna web call in which the customer is a scripted text-to-speech voice, not a real person.";

/** Provenance tag. Eval replays and our scripted test calls say so plainly everywhere they appear. */
export function OriginTag({ origin, scripted, compact, className }: { origin: "api" | "sandbox" | "eval-replay" | null; scripted?: boolean; compact?: boolean; className?: string }) {
  if (scripted) {
    return (
      <span
        title={SCRIPTED_NOTE}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[var(--hair-strong)] font-medium text-muted [&>svg]:size-3 [&>svg]:stroke-[1.8]",
          compact ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]",
          className,
        )}
      >
        <AudioLines aria-hidden />
        {compact ? "Scripted test call" : "Live web call · scripted TTS customer"}
        {compact && <span className="sr-only"> · live web call with a scripted text-to-speech customer</span>}
      </span>
    );
  }
  if (origin !== "eval-replay" && origin !== "sandbox") return null;
  const replay = origin === "eval-replay";
  return (
    <span
      title={replay ? ORIGIN_NOTE : "Made in the public sandbox at /demo."}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[var(--hair-strong)] font-medium text-muted [&>svg]:size-3 [&>svg]:stroke-[1.8]",
        compact ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]",
        className,
      )}
    >
      {replay ? <FlaskConical aria-hidden /> : <MonitorSmartphone aria-hidden />}
      {replay ? (compact ? "Eval replay" : "Eval replay · synthetic customer") : "Sandbox"}
      {replay && compact && <span className="sr-only"> · synthetic customer</span>}
    </span>
  );
}

/* ------------------------------------------------------------------- states */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rk-skel", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="relative grid size-14 place-items-center">
        <span className="absolute inset-0 rounded-full border border-hair" />
        <span className="absolute -inset-3 rounded-full border border-hair opacity-60" />
        <span className="absolute -inset-6 rounded-full border border-hair opacity-30" />
        <span className="relative grid size-11 place-items-center rounded-full bg-paper-3 text-ink-2 [&>svg]:size-5 [&>svg]:stroke-[1.6]">{icon}</span>
      </div>
      <p className="mt-7 font-display text-[16px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: Error | null; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-hair bg-paper-2 p-5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stop-soft text-stop">
        <TriangleAlert className="size-[18px]" strokeWidth={1.7} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[13.5px] text-muted">{friendlyError(error)}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="rk-btn">
          <RefreshCw className="size-4" strokeWidth={1.7} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

export function friendlyError(e: Error | null): string {
  if (!e) return "Something went wrong.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) return "The Ruko API didn't answer. Check that the server is running, then try again.";
  const status = (e as Error & { status?: number }).status;
  // Server errors can carry internals (paths, stack lines); keep those out of the UI.
  if (typeof status === "number" && status >= 500) return `The Ruko API hit an error (${status}). Try again in a moment.`;
  return e.message;
}

/** Shown above data that is still on screen after a refresh failed. */
export function StaleBanner({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-hair bg-paper-2 px-4 py-2.5 text-[13px] text-ink-2">
      <TriangleAlert className="size-4 shrink-0 text-accent" strokeWidth={1.7} aria-hidden />
      <span className="min-w-0 flex-1">Live refresh paused: {friendlyError(error)} Showing the last data received.</span>
      <button onClick={onRetry} className="font-semibold text-ink underline-offset-4 hover:underline">
        Retry
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        }
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-hair bg-paper-2 px-3 text-[12.5px] font-semibold text-ink-2 transition hover:border-[var(--hair-strong)] hover:text-ink active:scale-[0.97]",
        className,
      )}
    >
      <span className="sr-only" role="status">
        {done ? "Copied to clipboard" : ""}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? "y" : "n"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="inline-flex items-center gap-1.5"
        >
          {done ? <CheckIcon className="size-3.5 text-go" strokeWidth={2} aria-hidden /> : <Copy className="size-3.5" strokeWidth={1.8} aria-hidden />}
          {done ? "Copied" : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** In-page section heading: mono eyebrow, a display title and an optional line of context. */
export function SectionTitle({
  eyebrow,
  title,
  children,
  action,
  id,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 max-w-[72ch]">
        {eyebrow && <p className="t-eyebrow !text-[11px]">{eyebrow}</p>}
        <h2 id={id} className="mt-1.5 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[22px]">
          {title}
        </h2>
        {children && <div className="mt-1.5 text-[14px] leading-relaxed text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Small neutral pill for metadata. */
export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hair px-2.5 py-1 text-[12px] font-medium text-ink-2 [&>svg]:size-3.5 [&>svg]:stroke-[1.8]", className)}>
      {children}
    </span>
  );
}

/**
 * A rate with its 95% interval on a 0–100% track: the band is the interval, the
 * tick is the point estimate. `tone` colours the tick only.
 */
export function CIBar({ rate, ci, tone = "ink", className, label }: { rate: number; ci: [number, number]; tone?: "ink" | "go" | "stop"; className?: string; label?: string }) {
  const col = tone === "go" ? "var(--go)" : tone === "stop" ? "var(--stop)" : "var(--ink)";
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-paper-3", className)} role="img" aria-label={label ?? `${Math.round(rate * 100)}%, 95% interval ${Math.round(ci[0] * 100)} to ${Math.round(ci[1] * 100)}%`}>
      <span
        className="absolute inset-y-0 rounded-full"
        style={{ left: `${ci[0] * 100}%`, width: `${Math.max(1.5, (ci[1] - ci[0]) * 100)}%`, background: `color-mix(in oklab, ${col} 30%, transparent)` }}
      />
      <span className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${rate * 100}%`, background: col }} />
    </div>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cn("inline-flex items-center gap-1 text-ink underline decoration-[var(--hair-strong)] underline-offset-4 transition-colors hover:decoration-current", className)}>
      {children}
      <ArrowUpRight className="size-3.5 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12.5px] text-ink-2", className)}>{children}</span>;
}

/** Small label/value pair used in metadata rows. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="t-eyebrow !text-[10.5px]">{label}</dt>
      <dd className="mt-1.5 text-[14px] text-ink">{children}</dd>
    </div>
  );
}

/** A tile shaped like the kit's StatTile, for figures that need more than one number. */
export function TileFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("relative overflow-hidden rounded-[18px] border border-hair bg-gradient-to-b from-surface to-paper-2 p-4 shadow-[var(--shadow-soft)]", className)}
    >
      {children}
    </motion.div>
  );
}

export function TileHead({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-full border border-hair bg-surface text-ink [&>svg]:size-4 [&>svg]:stroke-[1.7]">{icon}</span>
      <span className="text-[13.5px] font-medium text-ink-2">{label}</span>
    </div>
  );
}
