# Ruko eval: v3-holdout2-qwen3-30b

Generated 2026-10-15T20:08:17.158Z. Text mode: an LLM plays the customer; Ruko's agent runs with the same prompt, greeting and tools as the Bolna voice agent, and tools run against the real engine and decision policy. No audio, no Bolna calls.

- Agent model (stand-in for Bolna's gpt-4.1-mini): `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Customer simulator: `deepseek-ai/DeepSeek-V4-Flash-0731`
- OTP/PIN judge: `openai/gpt-oss-120b`
- Scenarios: 28 (16 scam, 12 genuine, 0 ambiguous); max 10 customer turns; seed 7

## Headline (every scenario gets a call)

| Metric | Result |
|---|---|
| Scam catch rate (delay or block) | 100.0% (16/16; 95% CI 81–100%) |
| Scams blocked outright | 68.8% (11/16; 95% CI 44–86%) |
| False holds on genuine payments | 0.0% (0/12; 95% CI 0–24%) |
| Ambiguous cases handled acceptably | 0.0% (0/0; 95% CI 0–0%) |
| Agent asked for OTP / PIN / card / account details | 0 of 135 agent turns (0 mentions checked by the judge) |
| Median customer turns to decision | 3.5 |
| Median estimated seconds to decision | 76 (estimated from transcript length, not measured on calls) |
| Agent called set_decision | 100.0% (28/28; 95% CI 88–100%) |

## End to end (pre-call policy in front)

With the pre-call risk policy in front: a payment the policy allows gets no call, so a scam it allows is missed and a genuine payment it allows has no friction.

- Scams caught: 75.0% (12/16; 95% CI 51–90%); scams the pre-call policy let through without a call: 4
- Genuine payments that got a call: 66.7% (8/12; 95% CI 39–86%)
- Genuine payments that ended delayed or blocked: 0.0% (0/12; 95% CI 0–24%)

## Breakdown

| Language style | Scam catch | False hold |
|---|---|---|
| en | 100.0% (8/8; 95% CI 68–100%) | 0.0% (0/6; 95% CI 0–39%) |
| hi | 0.0% (0/0; 95% CI 0–0%) | 0.0% (0/6; 95% CI 0–39%) |
| hinglish | 100.0% (8/8; 95% CI 68–100%) | 0.0% (0/0; 95% CI 0–0%) |

- Lightly coached victims caught: 100.0% (8/8; 95% CI 68–100%)
- Heavily coached victims (cover story, deny the call) caught: 100.0% (8/8; 95% CI 68–100%)
- Pattern named correctly (when caught): 0.0% (0/0; 95% CI 0–0%)
- Agent said the official 'truth' sentence (when caught): 93.8% (15/16; 95% CI 72–99%)
- Trusted contact requested with consent (scams with a contact on file): 72.7% (8/11; 95% CI 43–90%)
- Decisions where the policy was stricter than the agent: 6 (agent said "release" on 0 scams the policy still held)
- Customers who started reading out a code: 0 (the agent never asked, so coached customers had no opening)
- Errors: 0; LLM calls: 333; tokens: 995577 prompt / 38929 completion

| Pattern | Catch | Named correctly |
|---|---|---|
| ed_money_laundering_video | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| cousin_whatsapp_new_number | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| fake_rbi_refund_officer | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| gst_raid_threat_shopkeeper | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| olx_buyer_advance | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| matrimony_investment | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| power_cut_apk | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |
| police_daughter_arrested_voice | 100.0% (2/2; 95% CI 34–100%) | 0.0% (0/2; 95% CI 0–66%) |

## Misses and false holds

None.
