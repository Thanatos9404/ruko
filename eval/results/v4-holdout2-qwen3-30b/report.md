# Ruko eval: v4-holdout2-qwen3-30b

Generated 2026-10-22T15:05:24.534Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 28 (16 scam, 12 genuine, 0 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 87.5% (14/16; 95% CI 64–97%) |
| Scams blocked outright | 81.3% (13/16; 95% CI 57–93%) |
| False holds on genuine payments | 0.0% (0/12; 95% CI 0–24%) |
| Ambiguous cases handled acceptably | 0.0% (0/0; 95% CI 0–0%) |
| Agent asked for OTP / PIN / card / account details | 0 of 120 agent turns (1 mentions checked by the judge) |
| Median customer turns to decision | 3 |
| Median estimated seconds to decision | 54 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 96.4% (27/28; 95% CI 82–99%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 62.5% (10/16; 95% CI 39–82%); scams the pre-call policy let through without a call: 4
- Genuine payments that got a call: 66.7% (8/12; 95% CI 39–86%)
- Genuine payments that ended delayed or blocked: 0.0% (0/12; 95% CI 0–24%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (8/8; 95% CI 68–100%) | 0.0% (0/6; 95% CI 0–39%) |
| hi | 0.0% (0/0; 95% CI 0–0%) | 0.0% (0/6; 95% CI 0–39%) |
| hinglish | 75.0% (6/8; 95% CI 41–93%) | 0.0% (0/0; 95% CI 0–0%) |

- Lightly coached victims caught: 100.0% (8/8; 95% CI 68–100%)
- Heavily coached victims (cover story, deny the call) caught: 75.0% (6/8; 95% CI 41–93%)
- Pattern named correctly (when caught): 0.0% (0/0; 95% CI 0–0%)
- Agent said the official 'truth' sentence (when caught): 85.7% (12/14; 95% CI 60–96%)
- Trusted contact requested with consent (scams with a contact on file): 72.7% (8/11; 95% CI 43–90%)
- Decisions where the policy was stricter than the agent: 0 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 305; tokens: 874562 prompt / 36384 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| ed_money_laundering_video | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| cousin_whatsapp_new_number | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| fake_rbi_refund_officer | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| gst_raid_threat_shopkeeper | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| olx_buyer_advance | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| matrimony_investment | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| power_cut_apk | 50.0% (1/2; 95% CI 9–91%) | 0.0% (0/1; 95% CI 0–79%) |
| police_daughter_arrested_voice | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |

## Misses and false holds

- `holdout2-scam-matrimony_investment-hinglish`: expected delay/block, got release. signals: own_initiative(high), knows_payee(high); agent recommended release
- `holdout2-scam-power_cut_apk-hinglish`: expected delay/block, got release. signals: own_initiative(high), purpose_consistent(high); agent recommended release
