# Ruko eval: v5-holdout4-qwen3-30b

Generated 2026-10-22T15:58:27.564Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 28 (18 scam, 10 genuine, 0 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 83.3% (15/18; 95% CI 61–94%) |
| Scams blocked outright | 61.1% (11/18; 95% CI 39–80%) |
| False holds on genuine payments | 20.0% (2/10; 95% CI 6–51%) |
| Ambiguous cases handled acceptably | 0.0% (0/0; 95% CI 0–0%) |
| Agent asked for OTP / PIN / card / account details | 0 of 128 agent turns (0 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 58 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 96.4% (27/28; 95% CI 82–99%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 77.8% (14/18; 95% CI 55–91%); scams the pre-call policy let through without a call: 2
- Genuine payments that got a call: 80.0% (8/10; 95% CI 49–94%)
- Genuine payments that ended delayed or blocked: 10.0% (1/10; 95% CI 2–40%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (4/4; 95% CI 51–100%) | 0.0% (0/5; 95% CI 0–43%) |
| hi | 88.9% (8/9; 95% CI 56–98%) | 40.0% (2/5; 95% CI 12–77%) |
| hinglish | 60.0% (3/5; 95% CI 23–88%) | 0.0% (0/0; 95% CI 0–0%) |

- Lightly coached victims caught: 100.0% (2/2; 95% CI 34–100%)
- Heavily coached victims (cover story, deny the call) caught: 81.3% (13/16; 95% CI 57–93%)
- Pattern named correctly (when caught): 0.0% (0/0; 95% CI 0–0%)
- Agent said the official 'truth' sentence (when caught): 33.3% (5/15; 95% CI 15–58%)
- Trusted contact requested with consent (scams with a contact on file): 33.3% (4/12; 95% CI 14–61%)
- Decisions where the policy was stricter than the agent: 3 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 328; tokens: 1234180 prompt / 43074 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| scholarship_release_fee | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| cloud_mining_machine_rental | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| kidney_donor_reward | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| online_tantrik_ritual | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| loan_app_recovery_shaming | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| solar_pump_subsidy_portal | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| ayurvedic_cure_course | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| gold_rate_lock_app | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| card_dues_settlement_offer | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |

## Misses and false holds

- `holdout4-scam-cloud_mining_machine_rental-hinglish`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release
- `holdout4-scam-kidney_donor_reward-hinglish`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
- `holdout4-scam-loan_app_recovery_shaming-hi`: expected delay/block, got release. signals: family_helping(high), own_initiative(high), verified_independently(high); agent recommended release
- `holdout4-genuine-night_harvest_tractor_parts-hi`: expected release, got delay. signals: own_initiative(high), payee_unknown(high), verified_independently(high); agent recommended delay; contact requested: false
