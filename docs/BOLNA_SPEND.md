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
- **Short calls.** `call_terminate` is set to 90 s and prompts aim for under 80 s, but call #5 below ran 145.5 s, so we don't rely on `call_terminate` to cap a web call's cost. Only
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
| 23 Oct 15:14 | **Live web call #3 (hero take, English).** Execution `152e968b-2386-46d8-8dc5-3fddaff8ae1f`, 80.1 s. Code word → cover story ("nephew's college fees") → probe "Has anyone told you what to say to the bank?" → admission → the agent produced the official truth line ("There's no 'digital arrest' in Indian law…"), but Bolna's recording holds only about 2 s of agent speech at that point, so the scripted customer's next lines most likely cut it off → the scripted customer ran out of lines while the agent asked a follow-up, so the call ended on silence and the engine held the payment for 24 h (CRITICAL_SIGN). The scripted customer also cut into the agent's first question. (A first attempt a few minutes earlier never connected: no session was minted and nothing was spent.) | Hero take for the video | 486.25 | 478 | 8.25 |
| 23 Oct 20:20 | **Live web call #4 (hero take 2, English).** Execution `2bfbdec6-4bab-440b-be19-8fbb9a7d4a37`, 36.1 s. The customer's cover-story line was never heard by Bolna's speech-to-text (only "yes" was), so the agent asked "are you there?" and hung up; the engine held the payment (delay, CHECK_INCOMPLETE). The scripted-customer driver now repeats a line the agent didn't react to. | Hero take for the video (user-approved) | 478 | 472.5 | 5.5 |
| 23 Oct 20:26 | **Live web call #5 (hero take, Hinglish).** Execution `9f893617-24cd-4d04-a693-5ae88ee06554`, 145.5 s. **First live Hindi call:** started in Hindi via `user_data.agent_language`, Sarvam saaras:v3 heard the Piper (`hi_IN-pratham-medium`) customer accurately, the agent spoke Hindi with bulbul:v3: code word, device-signal question, cover story ("भतीजे की कॉलेज फीस"), the probe "क्या किसी ने आपको बताया है कि इस भुगतान के बारे में बैंक को क्या कहना है?", the admission (`authority_threat`), then the customer asked to stop: **blocked** (CUSTOMER_CANCELLED; the policy was stricter than the agent's "delay"), and the trusted contact rang in the browser. **Why it ran 145.5 s although `call_terminate` is 90 s:** Bolna reports a normal hangup, and the 90 s limit did not end this web call. We have not confirmed why. It may not apply to web calls, or it may not carry into the Hindi language configuration. The 12 s silence hang-up never fired, because the scripted customer kept talking over the agent. The full 145.5 s was billed (13.75¢). The cost guards we rely on are the access code, the daily and per-code caps and the wallet floor, not `call_terminate`. The scripted customer talked over the agent's truth line several times (the driver's turn-taking, not Ruko). | Hinglish hero take (user-approved) | 472.5 | 458.75 | 13.75 |

**Total live spend: 41.25 cents over 5 live web calls on 23 Oct, all with a scripted text-to-speech customer (no real person). Wallet 458.75; the 150-cent finale reserve is untouched.** Two calls ran the full flow and blocked a coached digital-arrest victim: #2 in English and #5, the first live Hindi call.

