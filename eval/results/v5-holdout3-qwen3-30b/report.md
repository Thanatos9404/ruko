# Ruko eval: v5-holdout3-qwen3-30b

Generated 2026-10-22T16:03:40.832Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 28 (16 scam, 12 genuine, 0 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 81.3% (13/16; 95% CI 57–93%) |
| Scams blocked outright | 56.3% (9/16; 95% CI 33–77%) |
| False holds on genuine payments | 8.3% (1/12; 95% CI 1–35%) |
| Ambiguous cases handled acceptably | 0.0% (0/0; 95% CI 0–0%) |
| Agent asked for OTP / PIN / card / account details | 0 of 142 agent turns (0 mentions checked by the judge) |
| Median customer turns to decision | 4 |
| Median estimated seconds to decision | 57.5 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 100.0% (28/28; 95% CI 88–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 68.8% (11/16; 95% CI 44–86%); scams the pre-call policy let through without a call: 4
- Genuine payments that got a call: 83.3% (10/12; 95% CI 55–95%)
- Genuine payments that ended delayed or blocked: 8.3% (1/12; 95% CI 1–35%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (8/8; 95% CI 68–100%) | 0.0% (0/6; 95% CI 0–39%) |
| hi | 75.0% (3/4; 95% CI 30–95%) | 16.7% (1/6; 95% CI 3–56%) |
| hinglish | 50.0% (2/4; 95% CI 15–85%) | 0.0% (0/0; 95% CI 0–0%) |

- Lightly coached victims caught: 100.0% (8/8; 95% CI 68–100%)
- Heavily coached victims (cover story, deny the call) caught: 62.5% (5/8; 95% CI 31–86%)
- Pattern named correctly (when caught): 0.0% (0/0; 95% CI 0–0%)
- Agent said the official 'truth' sentence (when caught): 38.5% (5/13; 95% CI 18–64%)
- Trusted contact requested with consent (scams with a contact on file): 50.0% (5/10; 95% CI 24–76%)
- Decisions where the policy was stricter than the agent: 3 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 362; tokens: 1262843 prompt / 44218 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| overseas_job_visa_fee | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| sextortion_video_call | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| card_upgrade_screen_share | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| fake_landlord_deposit | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| mobile_tower_lease | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| pilgrimage_helicopter_booking | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| medical_seat_quota | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| boss_whatsapp_vendor_advance | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |

## Misses and false holds

- `holdout3-scam-sextortion_video_call-hinglish`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release
- `holdout3-scam-fake_landlord_deposit-hinglish`: expected delay/block, got release. signals: knows_payee(high), own_initiative(high); agent recommended release
- `holdout3-scam-pilgrimage_helicopter_booking-hi`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
- `holdout3-genuine-advance_tax_ca_on_call-hi`: expected release, got block. signals: coached_on_call(high), own_initiative(high), knows_payee(high), purpose_consistent(high), urgency_pressure(medium); agent recommended delay; contact requested: false
