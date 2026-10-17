import { cn } from "../../kit";

/**
 * The brand motif as a band: a voice waveform that builds toward a coral line and
 * stops there, then a flat, quiet line. Ruko's whole idea in one shape: the call
 * reaches the money before it leaves. Bars breathe gently; reduced motion keeps
 * them still (see .ruko-bar in app.css).
 */
const W = 1200;
const H = 200;
const MID = W / 2;
const STEP = 12;

const bars = Array.from({ length: Math.floor((MID - 36) / STEP) }, (_, i) => {
  const x = 30 + i * STEP;
  const t = x / MID; // 0 at the far left, 1 at the line
  const wobble = 0.55 + 0.25 * Math.sin(i * 0.9) + 0.2 * Math.sin(i * 0.37 + 1.3);
  const h = Math.max(6, (14 + 118 * t * t) * wobble);
  return { x, h, delay: ((i * 137) % 23) / 10 };
});

export function StopLine({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={cn("pointer-events-none block", className)}>
      <defs>
        <linearGradient id="stopline-wave" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
          <stop offset="0.55" stopColor="var(--ink)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="stopline-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--coral)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--coral)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={MID} cy={H / 2} rx="260" ry="120" fill="url(#stopline-glow)" />
      <g fill="url(#stopline-wave)">
        {bars.map((b) => (
          <rect
            key={b.x}
            className="ruko-bar"
            x={b.x}
            y={(H - b.h) / 2}
            width="4"
            height={b.h}
            rx="2"
            style={{ animationDelay: `-${b.delay}s` }}
          />
        ))}
      </g>
      <line x1={MID + 18} x2={W - 30} y1={H / 2} y2={H / 2} stroke="var(--ink)" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 10" />
      <rect x={MID - 2} y="22" width="4" height={H - 44} rx="2" fill="var(--coral)" />
    </svg>
  );
}
