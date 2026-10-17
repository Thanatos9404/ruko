# Ruko eval: v3-dev-qwen3-30b

Generated 2026-10-15T20:02:43.845Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 96 (60 scam, 24 genuine, 12 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 96.7% (58/60; 95% CI 89–99%) |
| Scams blocked outright | 88.3% (53/60; 95% CI 78–94%) |
| False holds on genuine payments | 0.0% (0/24; 95% CI 0–14%) |
| Ambiguous cases handled acceptably | 83.3% (10/12; 95% CI 55–95%) |
| Agent asked for OTP / PIN / card / account details | 0 of 459 agent turns (10 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 74 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 94.8% (91/96; 95% CI 88–98%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 76.7% (46/60; 95% CI 65–86%); scams the pre-call policy let through without a call: 12
- Genuine payments that got a call: 75.0% (18/24; 95% CI 55–88%)
- Genuine payments that ended delayed or blocked: 0.0% (0/24; 95% CI 0–14%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 95.0% (19/20; 95% CI 76–99%) | 0.0% (0/8; 95% CI 0–32%) |
| hi | 95.0% (19/20; 95% CI 76–99%) | 0.0% (0/8; 95% CI 0–32%) |
| hinglish | 100.0% (20/20; 95% CI 84–100%) | 0.0% (0/8; 95% CI 0–32%) |

- Lightly coached victims caught: 100.0% (30/30; 95% CI 89–100%)
- Heavily coached victims (cover story, deny the call) caught: 93.3% (28/30; 95% CI 79–98%)
- Pattern named correctly (when caught): 84.5% (49/58; 95% CI 73–92%)
- Agent said the official 'truth' sentence (when caught): 84.5% (49/58; 95% CI 73–92%)
- Trusted contact requested with consent (scams with a contact on file): 57.5% (23/40; 95% CI 42–71%)
- Decisions where the policy was stricter than the agent: 22 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 1150; tokens: 3790075 prompt / 165879 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| digital_arrest | 83.3% (5/6; 95% CI 44–97%) | 80.0% (4/5; 95% CI 38–96%) |
| courier_parcel | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| kyc_block | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| investment_trading | 83.3% (5/6; 95% CI 44–97%) | 100.0% (5/5; 95% CI 57–100%) |
| task_job | 100.0% (6/6; 95% CI 61–100%) | 66.7% (4/6; 95% CI 30–90%) |
| fake_support_refund | 100.0% (6/6; 95% CI 61–100%) | 66.7% (4/6; 95% CI 30–90%) |
| relative_emergency | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| prize_lottery | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| electricity_disconnection | 100.0% (6/6; 95% CI 61–100%) | 50.0% (3/6; 95% CI 19–81%) |
| sim_disconnection | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |

## Misses and false holds

- `scam-digital_arrest-en-heavy`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release
- `scam-investment_trading-hi-heavy`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release
- `ambiguous-real_son_emergency_verified-en`: expected release/delay, got block. signals: relative_emergency(high), coached_on_call(high); agent recommended delay; contact requested: true
- `ambiguous-real_son_emergency_verified-hinglish`: expected release/delay, got block. signals: coached_on_call(high), relative_emergency(high), verified_independently(medium); agent recommended delay; contact requested: true
