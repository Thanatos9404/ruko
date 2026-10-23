# Ruko progress log

Newest first. Wallet figures come from Bolna's `GET /user/me` (free); 500 = $5.00.

## 23 Oct 2026, ~15:30 IST: deployed, v5 published, first live Bolna calls

**What works**
- **Production:** https://ruko-symphony.vercel.app (Vercel, bom1). State lives in the Vercel Runtime Cache and is shared across function instances (`scripts/state-check.mjs`: 80 parallel reads, consistent). e2e on production passes 33/33: every scenario in English and Hindi to the final screen, glass blur, phone widths, hero timing.
- **Live calls, gated:** per-judge access codes (2 calls a day each) plus the owner's, a daily cap of 8, a wallet floor of 150 cents kept for the 20 Nov finale. A slot is refunded if a call never connects. Hardened per the Web Call SDK reverse-engineering findings (re-entry guard, mint deadline, error codes, iOS audio, Wake Lock, `?relay=1`).
- **First live Bolna web calls (2, 13.75 cents in total):** the second one ran the whole flow on the live voice path: code word, device-signal question, cover story caught as a payee mismatch, admission, `coached_on_call`, **blocked**, contact offer. Two fixes followed (fillers, truth line in the decision message). See BOLNA_SPEND.md.
- **Agent v5** (frozen c0b56c9, text model ruko-text-1.0.0): fresh held-out set 4 (frozen before v5 ran, heavy coaching in Hindi/Hinglish) **15/18 scams caught, 2/10 false holds (both delays)**, about a minute to a decision, 0 OTP or PIN requests in 959 agent turns. Holdouts 1–3 are reported as previously seen. Safe default: on critical pre-call risk, a release needs positive evidence; a delay never auto-releases.
- **Policy holes closed** with tests (a later decision can't loosen an earlier one, an unsure contact can't wipe a delay, execution ownership, story conflicts, holds never expire under a live call).
- **Console:** no code words, masked phones, no real caller's transcript, private line reports; the full 72-pattern library; the demo bank shows the v5 eval replays only.
- **Public checker:** official-advisory library plus the on-server text classifier; no LLM, and nothing typed is stored.
- **Agents in sync:** `npm run bolna:check` diffs all three saved agents (including the Hindi prompt and Sarvam STT/TTS) against the repo.

**Next**
- Hero call (English, or Hinglish if a Piper Hindi voice is approved), then a "Hear the real call" player from Bolna's recording.

**Wallet:** 486.25.

## 17 Oct 2026, ~22:45 IST: brand system, retheme, working 60-second demo, eval v3

**What works**
- **Brand.** The logo concept (by Yashvardhan Thanvi) is redrawn as clean vectors from one geometry source: mark, wordmark, horizontal and stacked lockups in light, dark and mono, app icons 16–512, a maskable icon, an OG card and a web manifest (`scripts/brand.ts`). The site uses an ink-navy canvas, coral as the single signal colour, and sage for "released".
- **Demo** (`/demo`). The flow is pay → hold screen (code word; the mark freezes the voice wave at the coral line) → call → outcome. The engine panel beside the phone animates each tool call as it lands, with real timings. A trusted-contact lane rings in the browser during live calls.
  - The recorded digital-arrest run blocks the payment about 43 s after the hold, naming the pattern and saying the official line.
  - Live Bolna web calls are wired behind the access code. None have been made yet.
- **Eval v3** (text mode, Nebius stand-in for Bolna's gpt-4.1-mini):

  | Set | Scams caught | False holds on genuine | Notes |
  |---|---|---|---|
  | Dev (96) | 58/60 | 0/24 | ambiguous cases acceptable 10/12 |
  | Fresh held-out (28, never used for tuning) | 16/16 | 0/12 | |

  - Across all 372 eval conversations (1,752 agent turns), the agent never asked for an OTP or PIN.
  - Known gap: heavily coached customers who stick to a cover story. The v2 held-out set caught 4/8 of them; v3 improved this by having the agent use the bank's own "on a call while paying" signal.
  - The pre-call policy alone lets some small, no-call scams through without a call (12/60 on the dev set). That is honest, and it is the bank's existing risk signals' job.
- **Tool endpoint latency** on the local dev server (100 calls): p50 74 ms, p95 303 ms. Vercel numbers will follow after deployment.

**Next**
- Console (re-spawning the helper), public text checker with Nebius chat mode, landing page, then integrating the research library.

**Wallet:** 500 (still no paid calls).

## 16 Oct 2026, ~01:45 IST: engine, Bolna agents and eval harness

**What works**
- Ruko API (`/v1/checks`) with a transparent risk policy: every point of the score comes from a named rule with a plain-language reason. It also has idempotency keys, tenant API keys and a per-check client secret for the customer's app.
- Bolna custom-function endpoints (`get_check_context`, `record_signal`, `call_trusted_contact`, `check_trusted_contact`, `set_decision`, plus the contact-agent and public-line tools). They check a bearer token and, optionally, Bolna's published source IPs.
- The decision policy is deterministic. The agent's recommendation can make the outcome stricter, but never more lenient than the recorded evidence.
- Webhook receiver: secret-token URL, idempotent per execution and status. It re-reads every terminal execution from Bolna's API, so a forged webhook body can't change a decision.
- Gate in front of every paid call: an access code, a daily cap, a per-visitor cap, and a wallet floor read from `/user/me` before each session.
- The three Bolna agents (payment safety check, trusted contact, public safety line) were created through the API. All saved with `restricted: false`. Only flat-rate preferred models; English and Hindi with mid-call switching.
- 12-pattern scam library built from official sources (MHA/I4C, RBI, CERT-In, DoT/TRAI, SEBI, NPCI), with English and Hindi "truth" sentences and per-pattern citations.
- Text-mode eval harness on Nebius: 96 scenarios across 10 scam types, 8 genuine payment types and 6 ambiguous cases, in English, Hindi and Hinglish, at two coaching levels.
  - A 12-scenario smoke run caught 12 of 12 correctly: every scam held, no false holds, no OTP or PIN requests.
  - This is a smoke run, not the headline result. The full run comes next.
- 47 tests pass; type checks and lint are clean.

**Next**
- Tighten the call to under 60 seconds.
- Run the full eval.
- Build the demo PSP app, console, public checker (text mode on Nebius) and landing page.

**Wallet:** 500 (no paid calls yet).
