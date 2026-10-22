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

## 2. obliqq.framer.ai motion spec (motion 12 + Lenis)

### Method

- REA ran `list-browser-targets`, `inspect-web-page --include-script-sources` (allowed origins: obliqq.framer.ai and framerusercontent.com), `analyze-web-bundle` and `export-web-scripts`. They ran against a headless Chrome on a loopback debugging port, with its own profile.
- `capture-browser-scenario` ran at 1440×900 with reduced motion off: PageDown five times, with a screenshot after each step.
- `analyze-javascript-application` ran on the site's page module, main script and shared library.
- REA's semantic graph doesn't keep property values inside object literals in Framer's minified code, so the spring and easing values were read from the scripts REA exported.
- REA can't hover, so hover values come from the exported settings rather than from observation.

### Stack

Framer's runtime, a Framer Motion chunk and React. Lenis comes in through Framer's Smooth Scroll component. There is no canvas, no WebGL, no custom cursor and no pinned section.

### Spec

1. **Smooth scroll**
   - Lenis with `duration: 1.0` (lerp off) and the default exponential-out easing.
   - Nested `overflow:auto` elements get `data-lenis-prevent`, and anchor links go through `lenis.scrollTo`.
   - Change for Ruko: switch from 1.1 with quartic-out to 1.0 with expo-out. Add `data-lenis-prevent` to the call captions, the engine timeline and the console tables.
2. **Hero headline reveal (word by word, on mount)**
   - Each word moves from opacity 0, blur 10 px and y 10 px to rest.
   - Spring stiffness 163, damping 40, mass 1. Words are staggered by 0.05 s, and the subtitle starts 0.1 s later.
   - Change for Ruko: give `WordReveal` a spring mode with these values.
3. **Block reveal on scroll**
   - Blocks fade and rise, with no blur. Each reveals once, when 50% is in view. Spring 150/30/1.
   - Later siblings start lower and later: `y = 64 + 16·i` and `delay = 0.1·i`.
   - Small elements use y 24 and a 0.6 s tween with ease `[.12, .23, .5, 1]`.
4. **Scroll-linked transforms**
   - Pattern: `useScroll({ target, offset: ['start end', 'end end'] })`, then `useTransform`, then `useSpring`.
   - Hero screenshot: from `rotateX 20°, scale .8, y −80` to flat. Spring 400/100, with about 1200 px of perspective.
   - Images: zoom out from `scale 1.3` to 1 inside a clipped, rounded frame. Spring 150/37.
   - Text moves from y 60 to 0. Side elements move from x ±40 or ±200 to 0, spring 150/40.
5. **Nav**
   - It starts transparent and full width.
   - When a sentinel after the hero enters view, it becomes a floating pill: white at 25%, `blur(10px)`, a 1 px hairline border and radius 100.
   - On hover, links get a white background at 20%.
6. **Marquees**
   - 40 px/s for logos and 20 px/s for integrations, running in opposite directions.
   - Hover slows them to 0.5× rather than pausing them.
   - Edges fade over 20–25% of the width.
   - Scroll velocity is added to the offset with a 0.1 lerp (`useAnimationFrame` + `useVelocity(scrollY)`).
7. **Hover and press**
   - Default: a spring with bounce 0.2 and duration 0.4.
   - Image cards scale to 1.15 inside a clipped 16 px frame.
   - The primary button goes to 85% ink, and ghost links get a warm tint.
   - Icon pairs cross-fade, and small icon buttons scale to 0.9 on tap.
8. **Type and colour**
   - Open Runde. Headings are weight 600 with −0.03em tracking and 120% line height. Body text has 150% line height.
   - Size scale: 16, 18, 20, 24, 28, 40, 44, 52 px.
   - Radii: 16 px for cards, about 24 px for media, 100 for pills.
   - A sky-to-sand gradient sits behind the hero and the screenshots.
   - Ruko already has most of this, so these are small adjustments.
9. **Performance**
   - About 1.45 MB of uncompressed JS, about 0.97 MB of images, about 471 KB of fonts and 1,935 DOM nodes.
   - Lenis keeps an animation loop running at all times.
   - Use blur on hero text only.

The structured values are in `raw/obliqq/motion-spec.json`.

## 3. bolna.ai design techniques

### Method

- REA ran list, inspect, bundle analysis and export on the home page and on `/symphony/buildathon`.
- It captured one scenario in dark mode: the home page with PageDown ×5, then the buildathon page with PageDown ×5.
- bolna.ai's robots.txt disallows `/_next/static/`. No extra fetches or source maps were requested, and scripts were read only from what the browser had already loaded.

### Home page

- **Stack.** Next.js App Router on Vercel, React, framer-motion 11.18.2.
- **Hero.** Built entirely in CSS, with no canvas.
  - A navy background with a grid of about 80 px cells and a diagonal blue light beam.
  - A "Backed by Y Combinator" pill.
  - A light-weight headline in which "Built for India" carries a saffron/white/green gradient.
  - A square cyan CTA with a waveform icon.
- **Section language.**
  - Monospace uppercase eyebrow chips.
  - A horizon arc glow behind section intros, and hairline dividers.
  - A code panel with Python, JS and cURL tabs.
  - Step cards joined by hand-drawn arrows.
- **Motion.** Elements reveal from opacity 0, y 20–30 and scale 0.9–0.95, easing out over 0.4–0.5 s, staggered by 0.1 s. Shared-layout indicators use `layoutId`, and `useScroll` is used in a few places.

### Buildathon page

A separate Vite + React + Tailwind app.

- **Hero.**
  - The concentric arcs are a static image, not WebGL.
  - The "BUILDATHON" wordmark is an image.
  - Partner marks sit in a glass pill: black at 55%, heavy blur and saturation, and a 1 px inset highlight.
- **Type.** Space Grotesk. Uppercase labels are tracked at 0.18–0.25em, and dates are set in YC orange.
- **Textures.** Halftone-dot images at 10–25% opacity, with soft-light blending and a radial mask.
- **"How it works".** A sticky full-screen stage. Progress comes from a passive scroll listener and drives a progress bar, step circles and a background-video scrub. No animation library is involved.
- **Marquee.** A CSS keyframe loop (30 s, linear) that pauses on hover.
- **Reduced motion.** Neither page handles it.

### How Ruko can feel at home, in its own way

1. Keep Ruko's SVG arcs as the Symphony nod, but drive them with live call audio. Bolna's arcs are static.
2. Draw the halftone texture in CSS (radial-gradient dots plus a mask) instead of using images.
3. Use Fragment Mono uppercase eyebrow chips (0.18em tracking) for developer labels.
4. Add one dark "stage" band with a horizon rim glow for the live-call section.
5. Add a pinned "How Ruko decides" sequence with `useScroll`: a progress line and steps that light up in turn.
6. Add a tabbed cURL / JS / Python panel for the bank API, with a `layoutId` tab indicator.
7. Use at most one pixel-type word. Don't reuse Bolna's assets, and mention partner marks only as plain fact.
8. Respect reduced motion everywhere.

The structured values are in `raw/bolna/design-techniques.json`.

## Notes on how REA was run

- REA could not name the SDK's custom events, and calls to global functions stayed unresolved, so every trace is partial. The behaviour described above was confirmed against the shipped `dist/index.js` and `index.d.ts`.
- Source recovery needs Wakaru on Linux, so it wasn't used.
- The agent's safety check declined to extract the SDK's original source from its source map, and no workaround was attempted.
