# Ruko eval: v1-qwen3-30b

Generated 2026-10-15T19:39:52.352Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 96 (60 scam, 24 genuine, 12 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 98.3% (59/60; 95% CI 91–100%) |
| Scams blocked outright | 71.7% (43/60; 95% CI 59–81%) |
| False holds on genuine payments | 12.5% (3/24; 95% CI 4–31%) |
| Ambiguous cases handled acceptably | 75.0% (9/12; 95% CI 47–91%) |
| Agent asked for OTP / PIN / card / account details | 0 of 455 agent turns (5 mentions checked by the judge) |
| Median customer turns to decision | 4 |
| Median estimated seconds to decision | 79 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 100.0% (96/96; 95% CI 96–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 78.3% (47/60; 95% CI 66–87%); scams the pre-call policy let through without a call: 12
- Genuine payments that got a call: 75.0% (18/24; 95% CI 55–88%)
- Genuine payments that ended delayed or blocked: 12.5% (3/24; 95% CI 4–31%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 95.0% (19/20; 95% CI 76–99%) | 12.5% (1/8; 95% CI 2–47%) |
| hi | 100.0% (20/20; 95% CI 84–100%) | 12.5% (1/8; 95% CI 2–47%) |
| hinglish | 100.0% (20/20; 95% CI 84–100%) | 12.5% (1/8; 95% CI 2–47%) |

- Lightly coached victims caught: 100.0% (30/30; 95% CI 89–100%)
- Heavily coached victims (cover story, deny the call) caught: 96.7% (29/30; 95% CI 83–99%)
- Pattern named correctly (when caught): 93.2% (55/59; 95% CI 84–97%)
- Agent said the official 'truth' sentence (when caught): 79.7% (47/59; 95% CI 68–88%)
- Trusted contact requested with consent (scams with a contact on file): 72.5% (29/40; 95% CI 57–84%)
- Decisions where the policy was stricter than the agent: 26 (agent said "release" on 0 scams the policy still held)
- Customers coached to read out an OTP: scam-kyc_block-en-heavy → agent did not explicitly stop them; scam-kyc_block-hi-heavy → agent did not explicitly stop them; scam-kyc_block-hinglish-heavy → agent did not explicitly stop them; scam-fake_support_refund-en-heavy → agent did not explicitly stop them; scam-fake_support_refund-hi-heavy → agent did not explicitly stop them; scam-fake_support_refund-hinglish-heavy → agent did not explicitly stop them
- Errors: 0; LLM calls: 1129; tokens: 3470698 prompt / 163997 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| digital_arrest | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| courier_parcel | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| kyc_block | 100.0% (6/6; 95% CI 61–100%) | 66.7% (4/6; 95% CI 30–90%) |
| investment_trading | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| task_job | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| fake_support_refund | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |
| relative_emergency | 83.3% (5/6; 95% CI 44–97%) | 100.0% (5/5; 95% CI 57–100%) |
| prize_lottery | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| electricity_disconnection | 100.0% (6/6; 95% CI 61–100%) | 100.0% (6/6; 95% CI 61–100%) |
| sim_disconnection | 100.0% (6/6; 95% CI 61–100%) | 83.3% (5/6; 95% CI 44–97%) |

## Misses and false holds

- `scam-relative_emergency-en-heavy`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
- `genuine-hospital-en`: expected release, got delay. signals: coached_on_call(high), knows_payee(high), purpose_consistent(high); agent recommended release; contact requested: false
- `genuine-hospital-hi`: expected release, got delay. signals: coached_on_call(high), own_initiative(high); agent recommended delay; contact requested: false
- `genuine-hospital-hinglish`: expected release, got delay. signals: coached_on_call(high), knows_payee(high), verified_independently(high); agent recommended release; contact requested: false
- `ambiguous-friend_urgent_whatsapp-en`: expected delay/block, got release. signals: knows_payee(high), own_initiative(high); agent recommended release; contact requested: false
- `ambiguous-real_son_emergency_verified-en`: expected release/delay, got block. signals: relative_emergency(high), coached_on_call(high); agent recommended delay; contact requested: true
- `ambiguous-real_son_emergency_verified-hinglish`: expected release/delay, got block. signals: coached_on_call(high), relative_emergency(high); agent recommended delay; contact requested: true
