import { isMotionValue, motion, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useId } from "react";
import { cn } from "../kit";

/**
 * Concentric arcs, after Bolna's Symphony artwork and recoloured to Ruko's palette, used as the visible
 * shape of a voice: they breathe when idle and swell with the agent's audio level
 * (the Web Call SDK's `volume-level` event) during a live call.
 */
export function Arcs({ level = 0, className, tone = "slate" }: { level?: number | MotionValue<number>; className?: string; tone?: "slate" | "coral" | "sage" }) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const s = useSpring(0, { stiffness: 180, damping: 22 });
  const swell = useTransform(s, (v) => 1 + v * 1.6);
  const glow = useTransform(s, (v) => Math.min(0.9, v * 1.2));
  useEffect(() => {
    // A MotionValue drives the spring directly, without re-rendering React.
    if (typeof level === "number") {
      s.set(level);
      return;
    }
    if (isMotionValue(level)) {
      s.set(level.get());
      return level.on("change", (v) => s.set(v));
    }
  }, [level, s]);
  const colors = {
    slate: ["#7f8ca3", "#1b2638"],
    coral: ["#f29a90", "#7a2d27"],
    sage: ["#b6e0c6", "#2d5a45"],
  }[tone];
  const rings = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id={`f-${id}`} cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1000" height="600" fill={`url(#f-${id})`} />
        {rings.map((i) => (
          <motion.circle
            key={i}
            cx="500"
            cy="640"
            r={150 + i * 85}
            fill="none"
            stroke={`url(#g-${id})`}
            strokeWidth={i === 0 ? 3 : 2}
            initial={{ opacity: 0 }}
            animate={
              reduce
                ? { opacity: 0.55 - i * 0.06 }
                : { opacity: [0.55 - i * 0.06, 0.25 - i * 0.02, 0.55 - i * 0.06], scale: [1, 1.015, 1] }
            }
            transition={{ duration: 4.5, delay: i * 0.25, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "500px 640px", scale: reduce ? 1 : undefined }}
          />
        ))}
        {!reduce && (
          <motion.circle
            cx="500"
            cy="640"
            r={150}
            fill="none"
            stroke="#e46157"
            strokeWidth={2}
            style={{ transformOrigin: "500px 640px", scale: swell, opacity: glow }}
          />
        )}
      </svg>
    </div>
  );
}
