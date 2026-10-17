import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn, EASE } from "../../kit";
import { BRAND, MARK, MARK_COMPACT_VIEWBOX, WORDMARK } from "./paths";

/**
 * The Ruko mark. Ink parts use currentColor, so the logo follows the theme
 * (navy on paper, paper on navy); the coral line is constant.
 *
 * `motion="intro"` plays the brand beat once: a voice wave rises bar by bar,
 * hits the coral line, the line flares, the wave freezes, and the R resolves.
 * `motion="live"` keeps the wave talking until `stopped` turns true (used as the
 * "payment held" moment in the demo). Reduced motion shows the final frame.
 */
export function RukoMark({
  className,
  motion: mode = "none",
  stopped = false,
  compact = false,
  title = "Ruko",
  tone = "auto",
}: {
  className?: string;
  motion?: "none" | "intro" | "live";
  stopped?: boolean;
  /** R and line only, for small sizes. */
  compact?: boolean;
  title?: string;
  tone?: "auto" | "dark";
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const animate = !reduce && mode !== "none";
  const [barA, barB] = tone === "dark" ? BRAND.barsDark : ["var(--logo-bar-a, #cfd4dc)", "var(--logo-bar-b, #8a93a3)"];

  const barVariants = {
    hidden: { scaleY: 0.05, opacity: 0, x: -24 },
    show: (i: number) => ({
      scaleY: 1,
      opacity: 1,
      x: 0,
      transition: { delay: 0.1 + i * 0.13, duration: 0.55, ease: EASE },
    }),
  };

  return (
    <svg viewBox={compact ? MARK_COMPACT_VIEWBOX : MARK.viewBox} className={cn("block", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`bars-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={barA} />
          <stop offset="1" stopColor={barB} />
        </linearGradient>
        <linearGradient id={`line-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND.coral} stopOpacity="0" />
          <stop offset="0.18" stopColor={BRAND.coral} />
          <stop offset="0.82" stopColor={BRAND.coral} />
          <stop offset="1" stopColor={BRAND.coral} stopOpacity="0" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-300%" y="-30%" width="700%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {!compact && (
        <g fill={`url(#bars-${id})`}>
          {MARK.bars.map(([x, y, w, h], i) =>
            animate ? (
              <motion.rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={w / 2}
                custom={i}
                variants={barVariants}
                initial="hidden"
                animate={
                  mode === "live" && !stopped
                    ? { scaleY: [1, 0.55 + ((i * 37) % 40) / 100, 1], opacity: 1, x: 0, transition: { duration: 0.9 + i * 0.07, repeat: Infinity, ease: "easeInOut" } }
                    : mode === "live" && stopped
                      ? { scaleY: 1, opacity: 0.55, x: 0, transition: { duration: 0.4, ease: EASE } }
                      : "show"
                }
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            ) : (
              <rect key={i} x={x} y={y} width={w} height={h} rx={w / 2} />
            ),
          )}
        </g>
      )}

      <motion.g
        filter={`url(#glow-${id})`}
        fill={BRAND.coral}
        initial={animate ? { opacity: 0 } : false}
        animate={
          animate
            ? mode === "intro"
              ? { opacity: [0, 1, 0.75], transition: { delay: 0.8, duration: 0.9, times: [0, 0.35, 1] } }
              : { opacity: stopped ? [0.75, 1, 0.85] : 0.6, transition: { duration: 0.8 } }
            : undefined
        }
      >
        <path d={MARK.lineGlow} opacity={0.7} />
        <ellipse cx={MARK.lens.cx} cy={MARK.lens.cy} rx={MARK.lens.rx} ry={MARK.lens.ry} opacity={0.55} />
      </motion.g>
      <motion.path
        d={MARK.line}
        fill={`url(#line-${id})`}
        initial={animate && mode === "intro" ? { scaleY: 0.2, opacity: 0 } : false}
        animate={animate && mode === "intro" ? { scaleY: 1, opacity: 1, transition: { delay: 0.7, duration: 0.6, ease: EASE } } : undefined}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />

      <motion.g
        fill="currentColor"
        initial={animate && mode === "intro" ? { opacity: 0, x: 18, filter: "blur(10px)" } : false}
        animate={animate && mode === "intro" ? { opacity: 1, x: 0, filter: "blur(0px)", transition: { delay: 1.15, duration: 0.8, ease: EASE } } : undefined}
      >
        <path d={MARK.bowl} />
        <path d={MARK.leg} />
      </motion.g>
    </svg>
  );
}

export function RukoWordmark({ className, title = "Ruko" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={cn("block", className)} role="img" aria-label={title}>
      <g fill="none" stroke="currentColor" strokeWidth={WORDMARK.stroke}>
        {WORDMARK.strokes.map((d) => (
          <path key={d} d={d} />
        ))}
        <circle cx={WORDMARK.circle.cx} cy={WORDMARK.circle.cy} r={WORDMARK.circle.r} />
      </g>
      <g fill="currentColor">
        {WORDMARK.polygons.map((p) => (
          <polygon key={p} points={p} />
        ))}
      </g>
    </svg>
  );
}

/** Horizontal lockup for navs and footers: compact mark + wordmark. */
export function RukoLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <RukoMark compact className={cn("h-7 w-auto", markClassName)} title="" />
      <RukoWordmark className="h-[18px] w-auto" />
      <span className="sr-only">Ruko</span>
    </span>
  );
}

/** Animated intro lockup: full mark with the brand beat, wordmark rising after. */
export function RukoIntro({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <RukoMark motion="intro" className="h-auto w-full" />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 1.6, duration: 0.8, ease: EASE }}
        className="-mt-[6%] w-[58%]"
      >
        <RukoWordmark className="h-auto w-full" />
      </motion.div>
    </div>
  );
}
