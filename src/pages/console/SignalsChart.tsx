import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE } from "../../kit";
import { signalDef } from "../../../shared/signals";
import type { Severity } from "../../../shared/types";
import { SEVERITY } from "./ui";
import { humanize } from "./fmt";

const ROW = 46;
const BAR = 12;
const MAX_ROWS = 10;

/**
 * Horizontal bars, one per signal type, coloured by severity. Custom SVG sized to
 * its container (so text is never scaled), with a per-bar tooltip on hover and focus.
 */
export function SignalsChart({ data }: { data: { type: string; count: number }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, MAX_ROWS);
  const rest = sorted.slice(MAX_ROWS);
  const rows = head.map((d) => {
    const def = signalDef(d.type);
    return { key: d.type, label: def?.label ?? humanize(d.type), type: d.type, severity: (def?.severity ?? "process") as Severity, listen: def?.listen_for, count: d.count };
  });
  if (rest.length)
    rows.push({ key: "__other", label: `${rest.length} other signal ${rest.length === 1 ? "type" : "types"}`, type: "other", severity: "process", listen: undefined, count: rest.reduce((s, d) => s + d.count, 0) });

  const max = Math.max(1, ...rows.map((r) => r.count));
  const valueGutter = 40;
  const barMax = Math.max(40, width - valueGutter);
  const height = rows.length * ROW;
  const present = [...new Set(rows.filter((r) => r.key !== "__other").map((r) => r.severity))].sort(
    (a, b) => ["critical", "high", "medium", "mitigating", "process"].indexOf(a) - ["critical", "high", "medium", "mitigating", "process"].indexOf(b),
  );
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Severity legend">
        {present.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SEVERITY[s].color }} aria-hidden />
            {SEVERITY[s].label}
          </li>
        ))}
      </ul>
      <div ref={wrap} className="relative">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="list" aria-label={`Signals recorded on held checks, ${total} in total`} className="block overflow-visible">
          {rows.map((r, i) => {
            const y = i * ROW;
            const w = Math.max(4, (r.count / max) * barMax);
            const dim = hover !== null && hover !== i;
            return (
              <g
                key={r.key}
                tabIndex={0}
                role="listitem"
                aria-label={`${r.label}: ${r.count} ${r.count === 1 ? "time" : "times"}, ${SEVERITY[r.severity].label.toLowerCase()} severity`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none [&:focus-visible_.rk-hit]:stroke-[var(--accent)]"
                style={{ opacity: dim ? 0.45 : 1, transition: "opacity .2s" }}
              >
                <rect className="rk-hit" x={-6} y={y} width={width + 12} height={ROW - 4} rx={8} fill={hover === i ? "var(--paper-3)" : "transparent"} strokeWidth={1.5} stroke="transparent" />
                <text x={0} y={y + 16} fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                  {truncate(r.label, Math.floor(width / 7))}
                </text>
                <rect x={0} y={y + 24} width={barMax} height={BAR} rx={4} fill="var(--paper-3)" opacity={0.6} />
                <motion.path
                  d={barPath(0, y + 24, w, BAR, 4)}
                  fill={SEVERITY[r.severity].color}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: EASE, delay: i * 0.04 }}
                  style={{ transformOrigin: `0px ${y + 24}px`, transformBox: "view-box" }}
                />
                <text x={width} y={y + 34} textAnchor="end" fontSize={13} fill="var(--ink)" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {r.count}
                </text>
              </g>
            );
          })}
        </svg>
        <AnimatePresence>
          {hover !== null && rows[hover] && (
            <motion.div
              key={rows[hover].key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="surface pointer-events-none absolute right-0 z-10 w-[min(300px,100%)] !rounded-xl p-3.5 shadow-[var(--shadow-lift)]"
              style={{ top: Math.min(hover * ROW + ROW, Math.max(0, height - 120)) }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11.5px] text-muted">{rows[hover].type}</span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2">
                  <span className="size-2 rounded-full" style={{ background: SEVERITY[rows[hover].severity].color }} />
                  {SEVERITY[rows[hover].severity].label}
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] font-medium text-ink">{rows[hover].label}</p>
              <p className="mt-1 text-[12.5px] text-ink-2">
                <span className="t-num text-ink">{rows[hover].count}</span> {rows[hover].count === 1 ? "time" : "times"} ·{" "}
                {Math.round((rows[hover].count / Math.max(1, total)) * 100)}% of signals heard
              </p>
              {rows[hover].listen && <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted">{rows[hover].listen}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Bar with a square base and a 4px rounded data end. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, Math.max(8, n - 1))}…` : s;
}
