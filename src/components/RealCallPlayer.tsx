import { AnimatePresence, motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../kit";

/**
 * "Hear the real call": Bolna's own recording of a live Ruko call, with captions
 * from Bolna's transcript. Loaded from /calls/<name>.json; renders nothing until
 * that file exists, so the page never advertises a call we haven't made.
 */
export interface RealCall {
  title: string;
  audio: string;
  duration_s: number;
  execution_id: string;
  recorded_at: string;
  cost_cents?: number;
  note?: string;
  turns: { role: "agent" | "customer"; text: string; start: number; end: number }[];
}

export function useRealCall(name = "hero"): RealCall | null {
  const [call, setCall] = useState<RealCall | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/calls/${name}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RealCall>) : null))
      .then((j) => alive && j && Array.isArray(j.turns) && setCall(j))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [name]);
  return call;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function RealCallPlayer({ call, className }: { call: RealCall; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const current = useMemo(() => call.turns.findIndex((x) => t >= x.start && t < x.end), [call.turns, t]);
  const shown = current >= 0 ? call.turns[current] : null;

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const on = () => setT(a.currentTime);
    const end = () => setPlaying(false);
    a.addEventListener("timeupdate", on);
    a.addEventListener("ended", end);
    return () => {
      a.removeEventListener("timeupdate", on);
      a.removeEventListener("ended", end);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className={cn("card overflow-hidden p-5 md:p-6", className)}>
      <div className="flex items-start gap-4">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause the real call" : "Play the real call"}
          className="ring-focus grid size-12 shrink-0 place-items-center rounded-full bg-[var(--coral)] text-[#0b111c] transition hover:-translate-y-px"
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-semibold text-ink">{call.title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Bolna's own recording · {clock(call.duration_s)} · {new Date(call.recorded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · execution{" "}
            <span className="font-mono">{call.execution_id.slice(0, 8)}</span>
            {typeof call.cost_cents === "number" ? ` · ${call.cost_cents.toFixed(1)}¢` : ""}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--hair)]" aria-hidden>
            <div className="h-full rounded-full bg-[var(--coral)]" style={{ width: `${Math.min(100, (t / Math.max(1, call.duration_s)) * 100)}%` }} />
          </div>
        </div>
        <span className="t-num shrink-0 pt-1 text-[12.5px] text-muted">{clock(t)}</span>
      </div>
      <div className="mt-4 min-h-[64px]" aria-live="polite">
        <AnimatePresence mode="wait">
          {shown ? (
            <motion.p
              key={current}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("rounded-2xl px-4 py-3 text-[14px] leading-snug", shown.role === "agent" ? "bg-[#16233a] text-[#e6eefb]" : "bg-paper-3 text-ink")}
            >
              <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide opacity-60">{shown.role === "agent" ? "Ruko (Bolna agent)" : "Customer"}</span>
              {shown.text}
            </motion.p>
          ) : (
            <p className="px-1 text-[13px] text-muted">{call.note ?? "Press play to hear the live call."}</p>
          )}
        </AnimatePresence>
      </div>
      <audio ref={audio} src={call.audio} preload="none" />
    </div>
  );
}
