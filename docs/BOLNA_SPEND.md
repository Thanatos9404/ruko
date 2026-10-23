# Bolna spend log

The Bolna account has **$5.00 (500 cents) in total** for the whole hackathon:
development, the demo video, judging and the shortlist interview. There are no
more credits, so every paid call is planned and logged here.

## Rules

- **Free calls only by default.** Creating, updating and reading agents, listing
  voices, reading executions and `GET /user/me` cost nothing.
- **The eval never uses Bolna.** It runs in text mode on Nebius.
- **Web calls only.** No phone numbers and no telephony charges. Phone calls are
  behind `RUKO_ALLOW_PHONE_CALLS=false`.
- **Short calls.** `call_terminate` is 90 s; prompts aim for under 80 s. Only
  flat-rate "preferred" models (gpt-4.1-mini, nova-3, saaras:v3,
  eleven_turbo_v2_5, bulbul:v3).
- **Wallet floor.** The server reads `GET /user/me` before minting any web-call
  session and refuses below `RUKO_WALLET_FLOOR_CENTS` (350 during development).
- **Public pages are gated:** access code + daily cap + per-visitor cap (see
  `server/engine/gate.ts`). Without a code, visitors get the recorded demo.
- **No loops, no retries** of paid calls. Each one is announced in the progress
  notes before it runs.

## Budget plan

| Purpose | Cents |
|---|---|
| Smoke calls (English, Hindi) and one hero take for the video | ≈ 30 |
| Judges (per-judge codes, 2 calls a day each) and the shortlist interview | ≈ 320 |
| Reserve for a live call at the 20 Nov finale (production wallet floor) | 150 |

Measured on the first call: a 32 s web call cost 5.5 cents (Bolna's breakdown: platform 2.0,
synthesizer 1.64, transcriber 0.22, LLM 0.13).

## Log

| When (IST) | What | Why | Wallet before | Wallet after | Cost |
|---|---|---|---|---|---|
| 16 Oct 00:30 | `GET /user/me`, voice catalogue, agent create/update ×6 | Setup | 500 | 500 | 0 (free) |
| 17–23 Oct | Agent updates (free PUTs), `GET /v2/agent/{id}` drift checks, `GET /user/me` | v5 prompts and tools, voice polish | 500 | 500 | 0 (free) |
| 23 Oct 14:47 | **Live web call #1 (smoke, English)**, digital-arrest scenario on the production demo; scripted TTS customer. Execution `ddc9026c-e7f1-4cdc-8ee1-34431deb822b`, 32.1 s, completed. The agent greeted with the code word and asked the device-signal question, but that question's audio never reached the browser, so the script waited and the agent hung up after its "are you there" prompt; the engine held the payment (delay, CHECK_INCOMPLETE). | First live test of the voice path | 500 | 494.5 | 5.5 |
| 23 Oct 14:52 | **Live web call #2 (smoke, English)**, same scenario. Execution `b6818362-8118-49fd-8f76-146432254c27`, 78.1 s, completed. Full flow on the live voice path: code word → device-signal question → cover story ("nephew's college fees") → probe → admission ("a CBI officer is on a video call… safe custody account") → `coached_on_call` recorded → **blocked** (MULTIPLE_STRONG_SIGNS) → contact offer. Found: Bolna's English default filler plays when `pre_call_message` is empty, and the agent skipped the official truth line; both fixed in f0b135c. | Second smoke test | 494.5 | 486.25 | 8.25 |

