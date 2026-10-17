# Ruko eval: v2-dev-qwen3-30b

Generated 2026-10-15T19:54:22.611Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 96 (60 scam, 24 genuine, 12 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 95.0% (57/60; 95% CI 86–98%) |
| Scams blocked outright | 73.3% (44/60; 95% CI 61–83%) |
| False holds on genuine payments | 0.0% (0/24; 95% CI 0–14%) |
| Ambiguous cases handled acceptably | 100.0% (12/12; 95% CI 76–100%) |
| Agent asked for OTP / PIN / card / account details | 0 of 451 agent turns (14 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 75 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 99.0% (95/96; 95% CI 94–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 75.0% (45/60; 95% CI 63–84%); scams the pre-call policy let through without a call: 12
- Genuine payments that got a call: 75.0% (18/24; 95% CI 55–88%)
- Genuine payments that ended delayed or blocked: 0.0% (0/24; 95% CI 0–14%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 95.0% (19/20; 95% CI 76–99%) | 0.0% (0/8; 95% CI 0–32%) |
| hi | 100.0% (20/20; 95% CI 84–100%) | 0.0% (0/8; 95% CI 0–32%) |
| hinglish | 90.0% (18/20; 95% CI 70–97%) | 0.0% (0/8; 95% CI 0–32%) |

- Lightly coached victims caught: 100.0% (30/30; 95% CI 89–100%)
- Heavily coached victims (cover story, deny the call) caught: 90.0% (27/30; 95% CI 74–97%)
- Pattern named correctly (when caught): 91.2% (52/57; 95% CI 81–96%)
- Agent said the official 'truth' sentence (when caught): 82.5% (47/57; 95% CI 71–90%)
- Trusted contact requested with consent (scams with a contact on file): 77.5% (31/40; 95% CI 62–88%)
- Decisions where the policy was stricter than the agent: 21 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 1136; tokens: 3631032 prompt / 163332 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| digital_arrest | 83.3% (5/6; 95% CI 44–97%) | 100.0% (5/5; 95% CI 57–100%) |
| courier_parcel | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| kyc_block | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| investment_trading | 100.0% (6/6; 95% CI 61–100%) | 66.7% (4/6; 95% CI 30–90%) |
| task_job | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| fake_support_refund | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| relative_emergency | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| prize_lottery | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| electricity_disconnection | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| sim_disconnection | 66.7% (4/6; 95% CI 30–90%) | 100.0% (4/4; 95% CI 51–100%) |

## Misses and false holds

- `scam-digital_arrest-hinglish-heavy`: expected delay/block, got release. signals: own_initiative(high), verified_independently(high); agent recommended release
- `scam-sim_disconnection-en-heavy`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
- `scam-sim_disconnection-hinglish-heavy`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
