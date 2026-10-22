import { describe, expect, it, vi } from "vitest";
import { CallController, errorFrom, withDeadline, type CallStep, type SdkCall } from "../src/lib/callController.js";

/** A stand-in for @bolna/web-call: records instances, lets each test script the call. */
function fakeSdk(script: (opts: Record<string, unknown>, emit: (ev: string, ...a: unknown[]) => void) => Promise<void> = async () => {}) {
  const instances: FakeCall[] = [];
  class FakeCall implements SdkCall {
    handlers = new Map<string, ((...a: unknown[]) => void)[]>();
    stopped = 0;
    muted: boolean | null = null;
    runId: string | null = null;
    constructor(public opts: Record<string, unknown>) {
      instances.push(this);
    }
    on(ev: string, fn: (...a: never[]) => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn as never]);
      return this;
    }
    emit = (ev: string, ...a: unknown[]) => (this.handlers.get(ev) ?? []).forEach((f) => f(...a));
    async start() {
      const session = (await (this.opts.getSession as () => Promise<{ run_id: string }>)()) as { run_id: string };
      this.runId = session.run_id;
      await script(this.opts, this.emit);
    }
    async stop() {
      this.stopped++;
    }
    setMuted(m: boolean) {
      this.muted = m;
    }
    getRunId() {
      return this.runId;
    }
  }
  return { loadSdk: async () => ({ BolnaWebCall: FakeCall as never }), instances };
}

const mintOk = async () => ({ run_id: "run-1" });

describe("call controller", () => {
  it("ignores a double click while a call is starting (no ghost call)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sdk = fakeSdk(async () => gate);
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: mintOk });
    const a = c.start();
    const b = c.start();
    await Promise.resolve();
    release();
    await Promise.all([a, b]);
    expect(sdk.instances).toHaveLength(1);
  });

  it("stops the previous instance before starting a new call, and resets mute", async () => {
    const sdk = fakeSdk();
    const muted: boolean[] = [];
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: mintOk }, { muted: (m) => muted.push(m) });
    await c.start();
    c.toggleMute();
    expect(sdk.instances[0].muted).toBe(true);
    await c.start();
    expect(sdk.instances).toHaveLength(2);
    expect(sdk.instances[0].stopped).toBe(1);
    expect(muted.at(-1)).toBe(false);
  });

  it("walks the steps: securing line, allow mic, ringing, live", async () => {
    const steps: CallStep[] = [];
    const sdk = fakeSdk(async (_o, emit) => {
      emit("media-permission");
      emit("state-change", "ringing");
      emit("state-change", "active");
    });
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: mintOk }, { step: (s) => steps.push(s) });
    await c.start();
    expect(steps).toEqual(["securing", "mic", "ringing", "active"]);
  });

  it("keeps Ruko's error code when the SDK wraps it as mint_failed, and offers the recorded run", async () => {
    const wrapped = { code: "mint_failed", message: "mint failed", cause: Object.assign(new Error("Today's live calls are used up."), { code: "daily_cap" }) };
    expect(errorFrom(wrapped)).toMatchObject({ code: "daily_cap", fallback: true });
    const nested = { code: "mint_failed", cause: { code: "mint_failed", cause: { code: "at_capacity", scope: "customer", message: "busy" } } };
    expect(errorFrom(nested)).toMatchObject({ code: "at_capacity", scope: "customer", fallback: true });
    expect(errorFrom({ code: "microphone_denied", message: "x" })).toMatchObject({ code: "microphone_denied", fallback: false });
  });

  it("gives up on a mint that hangs, with a mint_timeout the UI can explain", async () => {
    vi.useFakeTimers();
    const p = withDeadline(() => new Promise(() => {}), 10_000);
    const assertion = expect(p).rejects.toMatchObject({ code: "mint_timeout" });
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
    vi.useRealTimers();
  });

  it("hands the slot back when a minted call fails before connecting", async () => {
    const released: string[] = [];
    const sdk = fakeSdk(async () => {
      throw Object.assign(new Error("denied"), { code: "microphone_denied" });
    });
    const errors: string[] = [];
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: async () => ({ run_id: "run-mic" }), onRelease: (id) => released.push(id) }, { error: (e) => e && errors.push(e.code) });
    await c.start();
    expect(released).toEqual(["run-mic"]);
    expect(errors).toContain("microphone_denied");
  });

  it("passes the relay policy and the audio element to the SDK", async () => {
    const sdk = fakeSdk();
    const el = { tag: "audio" };
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: mintOk, relay: true, audioElement: () => el });
    await c.start();
    expect(sdk.instances[0].opts.iceTransportPolicy).toBe("relay");
    expect(sdk.instances[0].opts.audioElement).toBe(el);
  });

  it("reports why a call ended, so a dropped call can offer Reconnect", async () => {
    const reasons: string[] = [];
    const sdk = fakeSdk(async (_o, emit) => {
      emit("state-change", "active");
      emit("call-end", { reason: "remote-hangup" });
    });
    const c = new CallController({ loadSdk: sdk.loadSdk, mint: mintOk }, { end: (r) => reasons.push(r) });
    await c.start();
    expect(reasons).toEqual(["remote-hangup"]);
  });
});
