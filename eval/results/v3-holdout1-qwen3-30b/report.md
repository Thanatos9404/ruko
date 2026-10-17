# Ruko eval: v3-holdout1-qwen3-30b

Generated 2026-10-15T20:10:26.820Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 28 (16 scam, 12 genuine, 0 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 93.8% (15/16; 95% CI 72–99%) |
| Scams blocked outright | 68.8% (11/16; 95% CI 44–86%) |
| False holds on genuine payments | 8.3% (1/12; 95% CI 1–35%) |
| Ambiguous cases handled acceptably | 0.0% (0/0; 95% CI 0–0%) |
| Agent asked for OTP / PIN / card / account details | 0 of 129 agent turns (5 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 66 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 100.0% (28/28; 95% CI 88–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 68.8% (11/16; 95% CI 44–86%); scams the pre-call policy let through without a call: 4
- Genuine payments that got a call: 66.7% (8/12; 95% CI 39–86%)
- Genuine payments that ended delayed or blocked: 8.3% (1/12; 95% CI 1–35%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (8/8; 95% CI 68–100%) | 0.0% (0/6; 95% CI 0–39%) |
| hi | 0.0% (0/0; 95% CI 0–0%) | 16.7% (1/6; 95% CI 3–56%) |
| hinglish | 87.5% (7/8; 95% CI 53–98%) | 0.0% (0/0; 95% CI 0–0%) |

- Lightly coached victims caught: 100.0% (8/8; 95% CI 68–100%)
- Heavily coached victims (cover story, deny the call) caught: 87.5% (7/8; 95% CI 53–98%)
- Pattern named correctly (when caught): 0.0% (0/0; 95% CI 0–0%)
- Agent said the official 'truth' sentence (when caught): 86.7% (13/15; 95% CI 62–96%)
- Trusted contact requested with consent (scams with a contact on file): 54.5% (6/11; 95% CI 28–79%)
- Decisions where the policy was stricter than the agent: 4 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 323; tokens: 992142 prompt / 41521 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| fake_bank_safe_account | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| wrong_transfer_refund | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| loan_processing_fee | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| crypto_recovery | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| army_buyer_qr | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| romance_customs_gift | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| fake_traffic_challan | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| insurance_lapse_bonus | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |

## Misses and false holds

- `holdout-scam-wrong_transfer_refund-hinglish`: expected delay/block, got release. signals: family_helping(high), own_initiative(high); agent recommended release
- `holdout-genuine-son_abroad-hi`: expected release, got delay. signals: coached_on_call(high), knows_payee(high); agent recommended delay; contact requested: false
