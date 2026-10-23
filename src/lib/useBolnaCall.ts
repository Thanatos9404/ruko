import { useMotionValue, type MotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CallController, type CallErrorInfo, type CallStep } from "./callController";

/**
 * Wraps Bolna's Web Call SDK (@bolna/web-call) for React. The browser never sees
 * the Bolna key: `mint` asks our server for a short-lived, single-use session,
 * and the server checks the access code, caps and wallet floor before minting.
 *
 * Browser-side hardening (see research/rea/FINDINGS.md):
 *  - we own the audio element and the level meter, both unlocked inside the click,
 *    so playback and the waveform work on iOS Safari, with a "Tap to hear" fallback;
 *  - the level is a MotionValue (no React re-render ten times a second);
 *  - a Wake Lock keeps the phone's screen on during the call;
 *  - `?relay=1` forces TURN relay on venue networks that block UDP.
 */
export type CallState = "idle" | "connecting" | "ringing" | "active" | "ended";
export type { CallErrorInfo, CallStep };

/** Warm the SDK chunk (about 54 KB gzipped) before the visitor presses Answer. */
export function prefetchBolnaSdk(): void {
  void import("@bolna/web-call").catch(() => undefined);
}

// A few milliseconds of silence: playing it inside the click unlocks the element on iOS.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function releaseSlot(runId: string) {
  void fetch("/api/live/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: runId }), keepalive: true }).catch(() => undefined);
}

export function useBolnaCall(mint: (signal: AbortSignal) => Promise<unknown>) {
  const [step, setStep] = useState<CallStep>("idle");
  const [error, setError] = useState<CallErrorInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const level: MotionValue<number> = useMotionValue(0);
  const mintRef = useRef(mint);
  mintRef.current = mint;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meter = useRef<{ ctx: AudioContext | null; timer: number | null; ours: boolean }>({ ctx: null, timer: null, ours: false });
  const wake = useRef<{ release(): Promise<void> } | null>(null);

  const stopMeter = useCallback(() => {
    const m = meter.current;
    if (m.timer) window.clearInterval(m.timer);
    m.timer = null;
    m.ours = false;
    void m.ctx?.close().catch(() => undefined);
    m.ctx = null;
    level.set(0);
  }, [level]);

  const controller = useMemo(
    () =>
      new CallController({
        loadSdk: () => import("@bolna/web-call") as never,
        mint: (signal) => mintRef.current(signal),
        relay: typeof location !== "undefined" && new URLSearchParams(location.search).get("relay") === "1",
        debug: Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV),
        audioElement: () => audioRef.current ?? undefined,
        onRelease: releaseSlot,
      }),
    [],
  );

  useEffect(() => {
    controller.setListeners({
      step: setStep,
      level: (v) => {
        if (!meter.current.ours) level.set(v);
        // Exposed for scripted test calls (scripts/live-call.mjs), which wait for the agent to finish.
        (window as unknown as { __rukoAgentLevel?: number }).__rukoAgentLevel = v;
      },
      error: setError,
      end: setEndReason,
      autoplayBlocked: () => setNeedsTap(true),
      runId: setRunId,
      muted: setMuted,
    });
  }, [controller, level]);

  // Keep the screen awake while a call is live; release it afterwards.
  useEffect(() => {
    if (step !== "active") {
      void wake.current?.release().catch(() => undefined);
      wake.current = null;
      if (step === "ended") stopMeter();
      return;
    }
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (wake.current = l))
      .catch(() => undefined);
  }, [step, stopMeter]);

  /** Must run inside the click: unlocks audio playback and the meter's AudioContext. */
  const primeAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    stopMeter();
    const a = new Audio();
    a.autoplay = true;
    a.setAttribute("playsinline", "");
    a.src = SILENCE;
    void a.play().catch(() => undefined);
    audioRef.current = a;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume().catch(() => undefined);
    meter.current.ctx = ctx;
    // Once the SDK attaches the agent's stream to our element, measure it ourselves.
    const startedAt = Date.now();
    meter.current.timer = window.setInterval(() => {
      const m = meter.current;
      const stream = a.srcObject as MediaStream | null;
      if (!m.ctx || m.ours) return;
      if (!stream) {
        if (Date.now() - startedAt > 60_000 && m.timer) window.clearInterval(m.timer);
        return;
      }
      try {
        const src = m.ctx.createMediaStreamSource(stream);
        const an = m.ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        m.ours = true;
        if (m.timer) window.clearInterval(m.timer);
        m.timer = window.setInterval(() => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const b of buf) sum += ((b - 128) / 128) ** 2;
          level.set(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        }, 100);
      } catch {
        m.ours = false;
      }
    }, 200);
  }, [level, stopMeter]);

  const start = useCallback(async () => {
    if (controller.active) return;
    setEndReason(null);
    setNeedsTap(false);
    primeAudio();
    await controller.start();
  }, [controller, primeAudio]);

  const stop = useCallback(async () => {
    await controller.stop();
    stopMeter();
  }, [controller, stopMeter]);

  const toggleMute = useCallback(() => {
    controller.toggleMute();
  }, [controller]);

  /** The browser blocked playback mid-call: one tap resumes it. */
  const tapToHear = useCallback(() => {
    void audioRef.current?.play().catch(() => undefined);
    void meter.current.ctx?.resume().catch(() => undefined);
    setNeedsTap(false);
  }, []);

  useEffect(() => () => void controller.stop(), [controller]);

  const state: CallState = step === "securing" || step === "mic" ? "connecting" : step;
  return { state, step, error, level, muted, runId, endReason, needsTap, start, stop, toggleMute, tapToHear };
}
