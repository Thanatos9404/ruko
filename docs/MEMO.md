# Ruko: one-page memo

**Ruko** (Hindi for "wait") is a 60-second voice check, built on Bolna, that stops payment scams before the money leaves.

**Problem.** Indians reported losing ₹22,931 crore to cyber fraud in 2025, and payments above ₹10,000 carried 98.5% of it ([RBI](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810)). "Digital arrest" scams took ₹1,935.51 crore in 2024, 5.7 times the 2023 figure ([MHA](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf)). The victim makes the payment, often while the scammer coaches them on another call.

**Insight.** The victim is the one authenticating; only a voice breaks a voice. OTPs and PINs prove who pays, not who is giving orders. Pop-ups land on the phone the scammer is directing. A fraud officer's call works, but no bank can staff one within seconds, at UPI scale, in every language.

**Product.** When a payment looks risky (new payee, large amount, odd hour, active call, "safe account" payee), the bank calls Ruko's API. Ruko holds the payment, and a Bolna agent calls the customer in their language:

- It opens with a one-time code word shown in the app, so the call can't be spoofed.
- It asks "Is anyone on another call telling you what to do?", and uses the bank's own device signal ("your app shows you were on a call").
- It names the scam with an official line. With consent, it calls a trusted family contact.
- A deterministic, explained policy then releases, delays or blocks the payment.

The LLM can escalate, never de-escalate, and Ruko never asks for an OTP or PIN. A free public "Is this a scam?" line and a fraud-ops console come with it.

**Why now.**

- RBI liability directions take effect on 1 January 2027. They cover coerced payments and treat ignoring a bank's clear warning as customer negligence.
- RBI's April 2026 paper proposes a payment delay and a "trusted person". Ruko is a targeted version of both.
- TRAI protects bank calls from 1600xx numbers and now requires AI-voice calls to be declared in advance.
- Bolna's pay-as-you-go voice AI costs ₹5.52 a minute.

**Wedge and model.**

- **First:** co-operative banks, small finance banks and NBFCs. They have lean fraud teams.
- **Then:** UPI apps, and the UK, where banks must reimburse push-payment scam victims.
- **Pricing:** ₹20–30 per completed check, nothing for payments that pass. Cost is about ₹7–14 per check (estimate).
- **Market:** India TAM of ₹630–1,575 crore a year (estimate; assumptions in BUSINESS.md).

**Results so far.** We have no customers, no pilots and no measured live calls. Results are **text mode**: a Nebius-hosted Qwen3-30B stands in for Bolna's gpt-4.1-mini, with the same prompt and tools, against the real engine. Call times are estimated.

| v3 eval set | Scams caught | False holds |
|---|---|---|
| Dev | 58/60 | 0/24 |
| Fresh held-out, never tuned on | 16/16 | 0/12 |
| Held-out 1, seen while tuning | 15/16 | 1/12 |
| **Combined** | **89/92 (96.7%, 95% CI 91–99%)** | **1/48 (2.1%)** |

- 0 OTP or PIN requests across 372 conversations (1,752 agent turns).
- Tool latency (local dev): p50 74 ms, p95 303 ms.
- **Weakest area:** heavily coached customers who stick to a cover story. On v2's clean held-out set we caught 4 of 8; v3 added the device-signal probe.
- End to end, the pre-call policy lets small scams with no active call through uncalled (12 of 60 on the dev set).

**Competition.** Starling, Westpac and Barclays run in-app questions for their own customers. BioCatch and MuleHunter.AI score payments but don't talk. Convin claims outbound fraud calls. As of October 2026, we found no one selling Indian banks this full combination.

**Risks.**

- False holds: the policy needs evidence, and pilots start in shadow mode.
- Coached customers: the device signal and the trusted contact help.
- Bolna dependence: our engine is provider-neutral; concurrency and content rules are Bolna's.
- Data protection: DPDP consent covers recordings and trusted contacts.
- Scammer adaptation: the public line collects new scripts.

**The ask.** Introductions to two or three Indian banks or NBFCs for shadow-mode pilots, and help running the first measured live-call study.
