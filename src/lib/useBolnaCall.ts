import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps Bolna's Web Call SDK (@bolna/web-call). The browser never sees the Bolna
 * key: `mint` asks our server for a short-lived, single-use session, and the
 * server checks the access code, caps and wallet floor before minting one.
 */
export type CallState = "idle" | "connecting" | "ringing" | "active" | "ended";

export interface BolnaCallError {
  code: string;
  message: string;
}

interface Call {
  on(event: string, fn: (...a: never[]) => void): unknown;
  start(): Promise<void>;
  stop(): Promise<void>;
  setMuted(m: boolean): void;
  getRunId(): string | null | undefined;
}

export function useBolnaCall(mint: () => Promise<unknown>) {
  const ref = useRef<Call | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<BolnaCallError | null>(null);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const mintRef = useRef(mint);
  mintRef.current = mint;

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    try {
      const { BolnaWebCall } = await import("@bolna/web-call");
      const call = new BolnaWebCall({
        getSession: async () => (await mintRef.current()) as never,
      }) as unknown as Call;
      ref.current = call;
      call.on("state-change", ((s: CallState) => setState(s)) as never);
      call.on("volume-level", ((v: number) => setLevel(v)) as never);
      call.on("error", ((e: BolnaCallError) => setError({ code: e.code, message: e.message })) as never);
      call.on("call-end", (() => {
        setState("ended");
        setLevel(0);
      }) as never);
      await call.start();
      setRunId(call.getRunId() ?? null);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError({ code: err.code ?? "start_failed", message: err.message ?? "Could not start the call." });
      setState("ended");
    }
  }, []);

  const stop = useCallback(async () => {
    await ref.current?.stop();
    setState("ended");
    setLevel(0);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      ref.current?.setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(() => () => void ref.current?.stop(), []);

  return { state, error, level, muted, runId, start, stop, toggleMute };
}
