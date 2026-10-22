/**
 * Framework-free driver for Bolna's Web Call SDK (@bolna/web-call 3.0.1), so the
 * tricky parts are testable without a browser:
 *  - one call at a time (re-entry guard; a new start stops the old instance),
 *  - a deadline on the session mint, and error codes that survive the SDK's
 *    `mint_failed` wrapper (Ruko's code sits on `cause`),
 *  - a step model for the UI: securing line → allow mic → ringing → live,
 *  - the slot is handed back (onRelease) when a call fails before connecting.
 */

export type CallStep = "idle" | "securing" | "mic" | "ringing" | "active" | "ended";

export interface CallErrorInfo {
  code: string;
  message: string;
  scope?: string;
  /** True when the right next move is the recorded run, not a retry. */
  fallback: boolean;
}

export interface SdkCall {
  on(event: string, fn: (...a: never[]) => void): unknown;
  start(): Promise<void>;
  stop(): Promise<void>;
  setMuted(m: boolean): void;
  getRunId(): string | null | undefined;
}

export type SdkCtor = new (options: Record<string, unknown>) => SdkCall;

export interface ControllerOptions {
  loadSdk: () => Promise<{ BolnaWebCall: SdkCtor }>;
  mint: (signal: AbortSignal) => Promise<unknown>;
  mintTimeoutMs?: number;
  relay?: boolean;
  debug?: boolean;
  audioElement?: () => unknown;
  onRelease?: (runId: string) => void;
}

export interface ControllerListener {
  step?: (s: CallStep) => void;
  level?: (v: number) => void;
  error?: (e: CallErrorInfo | null) => void;
  end?: (reason: string) => void;
  autoplayBlocked?: () => void;
  runId?: (id: string | null) => void;
  muted?: (m: boolean) => void;
}

/** Ruko's gate codes and the SDK's terminal codes for which a retry won't help right now. */
const FALLBACK = new Set([
  "daily_cap",
  "code_cap",
  "visitor_cap",
  "wallet_floor",
  "at_capacity",
  "bolna_unreachable",
  "bolna_error",
  "mint_timeout",
  "not_configured",
  "connect_failed",
  "call_rejected",
  "rate_limited",
  "contact_tries",
]);

const MESSAGES: Record<string, string> = {
  microphone_denied: "Ruko needs your microphone for a live call. Allow it in the browser, or watch the recorded run.",
  mint_timeout: "The voice service took too long to answer. Try again, or watch the recorded run.",
  connect_failed: "The call couldn't connect on this network. Try a phone hotspot, add ?relay=1 to the address, or watch the recorded run.",
  at_capacity: "The voice service is busy right now. Watch the recorded run, or try again in a minute.",
  already_active: "A call is already running.",
};

/** Unwraps the SDK's error chain: `mint_failed` hides Ruko's own code on `cause` (sometimes nested). */
export function errorFrom(e: unknown): CallErrorInfo {
  const chain: { code?: string; message?: string; scope?: string; cause?: unknown }[] = [];
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    chain.push(cur as never);
    cur = (cur as { cause?: unknown }).cause;
  }
  const generic = new Set(["mint_failed", "start_failed", "error", undefined]);
  const specific = chain.find((x) => !generic.has(x.code)) ?? chain[0] ?? {};
  const code = specific.code ?? "start_failed";
  const scope = chain.find((x) => x.scope)?.scope;
  const message = MESSAGES[code] ?? specific.message ?? chain[0]?.message ?? "Could not start the call.";
  return { code, message, scope, fallback: FALLBACK.has(code) };
}

export function withDeadline<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      ctrl.abort();
      reject(Object.assign(new Error("The voice service took too long to answer."), { code: "mint_timeout" }));
    }, ms);
    p(ctrl.signal).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

export class CallController {
  private call: SdkCall | null = null;
  private busy = false;
  private token = 0;
  private connected = false;
  private isMuted = false;
  private listeners: ControllerListener;

  constructor(
    private opts: ControllerOptions,
    listeners: ControllerListener = {},
  ) {
    this.listeners = listeners;
  }

  setListeners(l: ControllerListener) {
    this.listeners = l;
  }

  get active(): boolean {
    return this.busy || this.connected;
  }

  /** Call from a click. A second click while starting is ignored; an old call is stopped first. */
  async start(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const token = ++this.token;
    const L = this.listeners;
    try {
      await this.stopInstance();
      this.connected = false;
      this.isMuted = false;
      L.muted?.(false);
      L.error?.(null);
      L.runId?.(null);
      L.step?.("securing");
      const audioElement = this.opts.audioElement?.();
      const { BolnaWebCall } = await this.opts.loadSdk();
      if (token !== this.token) return;
      const call = new BolnaWebCall({
        getSession: () => withDeadline((signal) => this.opts.mint(signal), this.opts.mintTimeoutMs ?? 10_000),
        ...(audioElement ? { audioElement } : {}),
        ...(this.opts.relay ? { iceTransportPolicy: "relay" } : {}),
        debug: Boolean(this.opts.debug),
      });
      this.call = call;
      const mine = () => token === this.token;
      call.on("media-permission", (() => mine() && L.step?.("mic")) as never);
      call.on("state-change", ((s: string) => {
        if (!mine()) return;
        if (s === "ringing") L.step?.("ringing");
        else if (s === "active") {
          this.connected = true;
          L.step?.("active");
        }
      }) as never);
      call.on("volume-level", ((v: number) => mine() && L.level?.(v)) as never);
      call.on("error", ((e: { code?: string }) => {
        if (!mine()) return;
        if (e?.code === "autoplay_blocked") L.autoplayBlocked?.();
        else L.error?.(errorFrom(e));
      }) as never);
      call.on("call-end", ((info: { reason?: string }) => {
        if (!mine()) return;
        this.connected = false;
        L.level?.(0);
        L.step?.("ended");
        L.end?.(info?.reason ?? "unknown");
      }) as never);
      await call.start();
      if (mine()) L.runId?.(call.getRunId() ?? null);
    } catch (e) {
      if (token !== this.token) return;
      L.error?.(errorFrom(e));
      L.step?.("ended");
      const run = this.call?.getRunId();
      // The call never connected: give the slot back (the server verifies with Bolna).
      if (run && !this.connected) this.opts.onRelease?.(run);
    } finally {
      if (token === this.token) this.busy = false;
    }
  }

  async stop(): Promise<void> {
    this.token++;
    this.busy = false;
    await this.stopInstance();
    this.connected = false;
    this.listeners.level?.(0);
    this.listeners.step?.("ended");
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.call?.setMuted(this.isMuted);
    this.listeners.muted?.(this.isMuted);
    return this.isMuted;
  }

  private async stopInstance() {
    const old = this.call;
    this.call = null;
    if (old) await old.stop().catch(() => undefined);
  }
}
