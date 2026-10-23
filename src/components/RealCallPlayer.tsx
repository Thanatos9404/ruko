import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../kit";

/**
 * "Hear a real call": Bolna's own recordings of live Ruko calls, with Bolna's
 * transcript beside them. Each call is loaded from /calls/<name>.json and the player
 * renders nothing until at least one exists, so the page never advertises a call we
 * haven't made. The customer in these calls is a scripted text-to-speech voice, and
 * the player says so on every take. A take without `audio` is shown as its transcript
 * and a still frame (used when the customer voice may not be redistributed).
 */
export interface RealCall {
  title: string;
  audio?: string;
  image?: string;
  image_alt?: string;
  audio_note?: string;
  /** How the audio was prepared from Bolna's recording, shown next to its length. */
  audio_label?: string;
  /** Where each side's utterances sit in the audio (no two overlap). */
  segments?: { role: "agent" | "customer"; start: number; end: number }[];
  /** Length of Bolna's recording, which leaves out silences. */
  duration_s: number;
  /** Length of the call itself. */
  call_s?: number;
  execution_id: string;
  recorded_at: string;
  cost_cents?: number;
  note?: string;
  detail?: string;
  timing?: string;
  /** in_recording: false marks a line that is in Bolna's transcript but not in its recording. */
  turns: { role: "agent" | "customer"; text: string; start: number; end: number; in_recording?: boolean }[];
}

export const REAL_CALLS: { name: string; label: string }[] = [
  { name: "hero", label: "English" },
  { name: "hero-hi", label: "हिंदी (Hindi)" },
];

export interface RealCallTake {
  label: string;
  call: RealCall;
}

/** Loads every recorded take that exists; missing files are skipped. */
export function useRealCalls(): RealCallTake[] {
  const [takes, setTakes] = useState<RealCallTake[]>([]);
  useEffect(() => {
    let alive = true;
    void Promise.all(
      REAL_CALLS.map(({ name, label }) =>
        fetch(`/calls/${name}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<RealCall>) : null))
          .then((call): RealCallTake | null => (call && Array.isArray(call.turns) ? { label, call } : null))
          .catch(() => null),
      ),
    ).then((all) => alive && setTakes(all.filter((x): x is RealCallTake => x !== null)));
    return () => {
      alive = false;
    };
  }, []);
  return takes;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const SCRIPTED = "Customer: a scripted text-to-speech voice, not a real person. Ruko: the live Bolna agent.";

export function RealCallPlayer({ takes, className }: { takes: RealCallTake[]; className?: string }) {
  const [which, setWhich] = useState(0);
  const { call } = takes[Math.min(which, takes.length - 1)];
  const audio = useRef<HTMLAudioElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  // Turns under the playhead (both sides can talk at once); the list follows the latest-starting one.
  const active = call.turns.map((x) => t >= x.start && t < x.end);
  const current = call.turns.reduce((best, x, i) => (active[i] && (best < 0 || x.start >= call.turns[best].start) ? i : best), -1);

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
  }, [call.audio]);

  const hasAudio = Boolean(call.audio);

  // Switching takes stops playback and rewinds.
  useEffect(() => {
    setPlaying(false);
    setT(0);
    if (list.current) list.current.scrollTop = 0;
  }, [which]);

  // Keep the highlighted line in view inside the transcript box (never scrolls the page).
  useEffect(() => {
    const box = list.current;
    const row = current >= 0 ? (box?.children[current] as HTMLElement | undefined) : undefined;
    if (!box || !row) return;
    const top = row.offsetTop; // the list is position: relative, so this is measured from its top
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
  }, [current]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      a.pause();
      setPlaying(false);
    }
  };
  const seek = (s: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = s;
    setT(s);
    if (a.paused) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className={cn("card overflow-hidden p-5 md:p-6", className)} data-testid="real-call">
      <p className="t-eyebrow mb-3">Hear a real call · recorded by Bolna</p>
      {takes.length > 1 && (
        <div role="tablist" aria-label="Choose a recorded call" className="mb-4 inline-flex rounded-full bg-paper-3 p-1">
          {takes.map((c, i) => (
            <button
              key={c.call.execution_id}
              role="tab"
              aria-selected={i === which}
              onClick={() => setWhich(i)}
              className={cn(
                "ring-focus rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                i === which ? "bg-[var(--coral)] text-[#0b111c]" : "text-muted hover:text-ink",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-start gap-4">
        {hasAudio && (
          <button
            onClick={toggle}
            aria-label={playing ? "Pause the recorded call" : "Play the recorded call"}
            className="ring-focus grid size-12 shrink-0 place-items-center rounded-full bg-[var(--coral)] text-[#0b111c] transition hover:-translate-y-px"
          >
            {playing ? <Pause size={20} /> : <Play size={20} className="translate-x-px" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-semibold text-ink">{call.title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {hasAudio ? `Bolna's own recording ${clock(call.duration_s)} (${call.audio_label ?? "silences removed"})` : "Transcript only"}
            {typeof call.call_s === "number" ? ` · call ${Math.round(call.call_s)} s` : ""} · {new Date(call.recorded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · execution{" "}
            <span className="font-mono">{call.execution_id.slice(0, 8)}</span>
            {typeof call.cost_cents === "number" ? ` · cost ${call.cost_cents.toFixed(2)}¢` : ""}
          </p>
          {hasAudio && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--hair)]" aria-hidden>
              <div className="h-full rounded-full bg-[var(--coral)]" style={{ width: `${Math.min(100, (t / Math.max(1, call.duration_s)) * 100)}%` }} />
            </div>
          )}
        </div>
        {hasAudio && <span className="t-num shrink-0 pt-1 text-[12.5px] text-muted">{clock(t)}</span>}
      </div>

      <p className="mt-4 rounded-xl border border-[var(--hair)] px-3.5 py-2.5 text-[13px] font-medium leading-snug text-ink" data-testid="scripted-label">
        {call.note ?? SCRIPTED}
      </p>

      {!hasAudio && call.audio_note && <p className="mt-3 text-[13px] leading-relaxed text-ink-2" data-testid="audio-note">{call.audio_note}</p>}
      {call.image && (
        <figure className="mt-3 overflow-hidden rounded-2xl border border-[var(--hair)]">
          <img src={call.image} alt={call.image_alt ?? ""} loading="lazy" decoding="async" className="block h-auto w-full" />
        </figure>
      )}

      <ol ref={list} data-lenis-prevent className="relative mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1" aria-label="Transcript">
        {call.turns.map((x, i) => {
          const recorded = x.in_recording !== false;
          const seekable = hasAudio && recorded;
          return (
            <li key={i} data-recorded={recorded ? undefined : "false"}>
              <button
                onClick={() => seekable && seek(x.start)}
                tabIndex={seekable ? 0 : -1}
                className={cn(
                  "ring-focus w-full rounded-2xl px-4 py-2.5 text-left text-[14px] leading-snug transition",
                  x.role === "agent" ? "bg-[#16233a] text-[#e6eefb]" : "bg-paper-3 text-ink",
                  !recorded && "border border-dashed border-[var(--hair-strong)] bg-transparent text-ink-2",
                  active[i] ? "opacity-100 ring-2 ring-[var(--coral)]" : playing || t > 0 ? "opacity-60" : "opacity-100",
                )}
              >
                <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide opacity-60">
                  {x.role === "agent" ? "Ruko (live Bolna agent)" : "Customer (scripted voice)"}
                  {!recorded && " · in Bolna's transcript, not in its recording"}
                </span>
                {x.text}
              </button>
            </li>
          );
        })}
      </ol>

      {call.detail && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{call.detail}</p>}
      {call.timing && <p className="mt-1.5 text-[12px] text-muted opacity-80">{call.timing}</p>}
      {hasAudio && <audio key={call.audio} ref={audio} src={call.audio} preload="none" />}
    </div>
  );
}
