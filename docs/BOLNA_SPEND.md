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
| Development smoke tests (a handful of short calls) | ≈ 100 |
| Recording the demo video | ≈ 150 |
| Judges and shortlist interview | ≈ 250 |

## Log

| When (IST) | What | Why | Wallet before | Wallet after | Cost |
|---|---|---|---|---|---|
| 16 Oct 00:30 | `GET /user/me`, voice catalogue, agent create/update ×6 | Setup | 500 | 500 | 0 (free) |
