# Ruko eval: v4-dev-qwen3-30b

Generated 2026-10-17T18:21:44.053Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 96 (60 scam, 24 genuine, 12 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 100.0% (60/60; 95% CI 94–100%) |
| Scams blocked outright | 96.7% (58/60; 95% CI 89–99%) |
| False holds on genuine payments | 4.2% (1/24; 95% CI 1–20%) |
| Ambiguous cases handled acceptably | 66.7% (8/12; 95% CI 39–86%) |
| Agent asked for OTP / PIN / card / account details | 0 of 418 agent turns (5 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 57 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 99.0% (95/96; 95% CI 94–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 80.0% (48/60; 95% CI 68–88%); scams the pre-call policy let through without a call: 12
- Genuine payments that got a call: 75.0% (18/24; 95% CI 55–88%)
- Genuine payments that ended delayed or blocked: 4.2% (1/24; 95% CI 1–20%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (20/20; 95% CI 84–100%) | 12.5% (1/8; 95% CI 2–47%) |
| hi | 100.0% (20/20; 95% CI 84–100%) | 0.0% (0/8; 95% CI 0–32%) |
| hinglish | 100.0% (20/20; 95% CI 84–100%) | 0.0% (0/8; 95% CI 0–32%) |

- Lightly coached victims caught: 100.0% (30/30; 95% CI 89–100%)
- Heavily coached victims (cover story, deny the call) caught: 100.0% (30/30; 95% CI 89–100%)
- Pattern named correctly (when caught): 88.3% (53/60; 95% CI 78–94%)
- Agent said the official 'truth' sentence (when caught): 73.3% (44/60; 95% CI 61–83%)
- Trusted contact requested with consent (scams with a contact on file): 80.0% (32/40; 95% CI 65–90%)
- Decisions where the policy was stricter than the agent: 1 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 1053; tokens: 3216370 prompt / 148076 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| digital_arrest | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| courier_parcel | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| kyc_block | 100.0% (6/6; 95% CI 61–100%) | 66.7% (4/6; 95% CI 30–90%) |
| investment_trading | 100.0% (6/6; 95% CI 61–100%) | 50.0% (3/6; 95% CI 19–81%) |
| task_job | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| fake_support_refund | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| relative_emergency | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| prize_lottery | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| electricity_disconnection | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| sim_disconnection | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |

## Misses and false holds

- `genuine-hospital-en`: expected release, got delay. signals: coached_on_call(high), family_helping(high), own_initiative(high), purpose_consistent(high); agent recommended delay; contact requested: true
- `ambiguous-family_helping_on_call-hinglish`: expected release/delay, got block. signals: codeword_mismatch(high); agent recommended block; contact requested: false
- `ambiguous-friend_urgent_whatsapp-hinglish`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release; contact requested: false
- `ambiguous-real_son_emergency_verified-en`: expected release/delay, got block. signals: relative_emergency(high), coached_on_call(high); agent recommended delay; contact requested: true
- `ambiguous-real_son_emergency_verified-hinglish`: expected release/delay, got block. signals: relative_emergency(high), urgency_pressure(high); agent recommended block; contact requested: false
