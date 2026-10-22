# REA findings for Ruko

Produced with [REA](https://github.com/morluto/rea) (`rea-agents` 6.5.0, MIT) for lawful interoperability analysis. The analysis covers techniques and contracts only. No third-party code is copied into Ruko. Raw REA outputs are in `raw/`, with local paths redacted. Full Evidence bundles (72 MB + 50 MB) and the npm tarball stay outside the repo.

## 1. Bolna Web Call SDK (`@bolna/web-call` 3.0.1)

### Method

- **Runtime:** REA 6.5.0 on a portable Node 24.22 (`npx -p node@24 -p rea-agents@6.5.0`). System Node (22.17.1) was left unchanged, and `rea setup` was not run.
- **Package:** `npm pack @bolna/web-call@3.0.1`. The integrity hash matches the registry. 3.0.1 is the only version on npm and carries the `latest` tag. Bolna's docs still say v3.0.0.
- **Analysis runs:**
  - `rea analyze-javascript-application`, then `inspect-analysis-view` (summary `ev_c906e402…`).
  - A focused re-run with `--source-path dist/index.js` and higher semantic ceilings (`ev_189c2c31…`). The first pass hit the 20k-node-per-file ceiling before it reached the SDK code at the end of the bundle.
  - `trace-javascript-semantics` from the SDK's constants:
    - `6000`: the media-disconnect grace timer
    - `30000`: the INVITE setup timeout
    - `100`: the volume `setInterval`
    - `"7000"`: the SIP dial target
- **Confirmation:** behaviour was checked by reading the shipped `index.d.ts` and `dist/index.js` at the line ranges REA located.

### What REA could and couldn't do

**Could:**
- Mapped the bundle: SIP.js 0.21.1 is inlined as 91 modules.
- Located the timers, the listeners, the session `fetch` and the order of the awaits.

**Couldn't:**
- REA's event extraction expects EventEmitter-style code, so it could not name this SDK's custom `emit()` events.
- Calls into globals (`setTimeout`, `AudioContext`) stay "dynamic-call" unknowns.
- Every trace is partial or ambiguous.
- Wakaru source recovery only runs on Linux, so it wasn't used.

### SDK contract (3.0.1)

**Transport and call setup**
- SIP over WSS plus WebRTC. The SDK dials extension `7000` with `X-Agent-Id` and `X-Run-Id` headers.
- `start()` runs in this order: mint, then a microphone preflight (`getUserMedia`, with the tracks stopped immediately), then connect.
- Connect timeouts: WebSocket 5 s, ICE gathering capped at 2 s, INVITE 30 s.

**States and events**
- States: `connecting` on `start()`, `ringing` once the SIP session starts establishing, `active` once it is established.
- `call-end` only fires for a call that was live.
- A failed `start()` emits `error` and then the promise rejects. No `call-end` follows. The documented reason `"failed"` is never emitted.
- `volume-level` measures the agent's audio only (analyser, FFT 256, every 100 ms). It is not voice-activity detection, and there are no user-speaking or caption events.
- The meter's `AudioContext` is created outside the click and never resumed, so on iOS Safari the meter may sit at 0. This is unverified.

**Disconnects and page lifecycle**
- There is no reconnection: SIP reconnection attempts and keepalive are both 0, and there is no ICE restart.
- If the media path stays disconnected for 6 s, or reports failed, the call ends as `remote-hangup`. That looks exactly like the agent hanging up.
- `pagehide` hangs up the call. Hidden tabs (`visibilitychange`) are not handled.

**Errors**
- In `getSession` mode, which is what Ruko uses:
  - Any error Ruko throws comes back as `mint_failed`, with Ruko's original error on the event's `cause`.
  - The session shape is not validated.
  - There is no mint timeout.
- `at_capacity` only exists in `sessionUrl` mode, on an HTTP 429.
- `microphone_denied` covers every `getUserMedia` failure, including no microphone and a microphone already in use.
- `autoplay_blocked` fires mid-call. The call stays active but produces no audio.

**Network**
- On networks that block UDP, the 2 s ICE cap drops the slower TCP/TLS TURN candidates.

### Risks in Ruko's live-call integration (highest first)

1. **The cap can lock a judge out after one run** (`gate.ts:58-73`, `app.ts:463`, `config.ts:67`).
   - Every mint counts against both the daily cap and the per-visitor cap (default 3), before the microphone prompt even appears.
   - The visitor key is IP + User-Agent, so judges behind the same venue NAT share one key.
   - One full demo costs 2 attempts (the customer call plus the contact call).
   - A microphone or connect failure still uses up an attempt.
2. **Two calls can share the mic.** "Answer as contact" appears while the customer call is still active (`DemoExperience.tsx:266-272`). Pressing it starts a second call on the same microphone and takes a second concurrency slot.
3. **Error meaning is lost.**
   - Ruko's own errors (`daily_cap`, `visitor_cap`, `wallet_floor`, `access_code_invalid`) all arrive as `mint_failed`.
   - The original code is only on `cause`.
   - Ruko's catch reads the thrown error, where that code sits one level deeper, on `cause2` (`useBolnaCall.ts:51-54`).
4. **Bolna's rate limit is disguised.** Bolna's 429 on the mint becomes a 502 `bolna_error`, and the scope of the limit is lost (`app.ts:108`).
5. **The UI can hang on "connecting…".** The mint has no deadline, and the server calls `bolna.me()` twice per mint (`app.ts:98` plus the gate).
6. **The mic prompt is unannounced.** `media-permission` is ignored, so the browser's microphone prompt appears without warning after the mint round-trip.
7. **The waveform arcs may stay flat on iOS** (see the meter note above).
8. **No recovery from `autoplay_blocked`.** Ruko doesn't pass its own `audioElement`, so there's nothing to retry with.
9. **A network drop looks like a normal ending.** `call-end.reason` is ignored.
10. **The SDK loads late.** The SDK chunk (234 KB, 54 KB gzipped) loads lazily on click. That is slow on a cold network, and it returns 404 if a redeploy lands while a tab is open.
11. **A double click creates a ghost call.** There's no re-entry guard, and `ref.current` is overwritten without stopping the old call.
12. **The mute indicator isn't reset** when a new call starts.
13. **`setLevel` re-renders the whole tree 10 times a second.**

### What Ruko already does right

- The API key stays on the server.
- The SDK version is pinned.
- `user_data` is forwarded in `getSession` mode.
- `start()` is called from click handlers.
- The call is stopped when the component unmounts.
- The mint falls back between the two endpoint paths.

### Recommendations (ranked)

1. **Fix the cap.** Key the per-visitor cap on the access code, exempt the contact call, and only count (or refund) a slot once the call actually connects.
2. **Serialise the two calls.** Stop or mute the customer call before the contact call starts, or wait for the first call to end.
3. **Keep error meaning.**
   - Server: map Bolna's 429 to a 429 `at_capacity` that carries its scope.
   - Client: branch on `e.cause.code` and offer a one-tap "Watch the recorded run".
4. **Replace "connecting…" with a stepper:** securing line → allow mic → ringing → live.
5. **Make the mint fast and bounded.** Add a 10 s abort on the mint, drop the duplicate `me()` call, and warm `/v1/health` when the page loads.
6. **Own the audio element and meter.** Call `play()` and resume an `AudioContext` inside the click, then pass the `audioElement` to the SDK. That fixes the iOS meter and gives a "Tap to hear" recovery.
7. **Handle mid-call drops.** On `remote-hangup` before a decision, offer Reconnect plus the recorded run.
8. **Prepare for the venue network.** Add a `?relay=1` flag that sets `iceTransportPolicy: "relay"`, and bring a phone hotspot and a headset.
9. **Prefetch the SDK chunk.**
10. **Harden `useBolnaCall`:** add a re-entry guard, stop the old instance, reset mute, drive the level through a MotionValue, and set `debug` in dev.
11. **Keep the call alive on phones.** Request a Wake Lock during calls, and on iOS tell users to keep Safari in the foreground.

## 2. obliqq.framer.ai motion spec

In progress.

## 3. bolna.ai design techniques

In progress.
