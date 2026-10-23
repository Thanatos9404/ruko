# Ruko: one-page memo

**Ruko** (Hindi for "wait") is a voice check of about a minute, built on Bolna, that stops payment scams before the money leaves.

**Problem.** Indians reported ₹22,845 crore lost to cyber fraud in 2024 ([MHA](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf)), and NCRP data cited by the RBI show payments above ₹10,000 carry about 98.5% of reported fraud value ([RBI](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810)). "Digital arrest" and related scams took ₹1,935.51 crore in 2024, 5.7 times the 2023 figure ([MHA](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf)). The victim makes the payment, often while the scammer coaches them on another call.

**Insight.** The victim is the one authenticating; only a voice breaks a voice. OTPs and PINs prove who pays, not who is giving orders. Pop-ups land on the phone the scammer is directing. A fraud officer's call works, but no bank can staff one within seconds, at UPI scale, in every language.

**Product.** When a payment looks risky (new payee, large amount, odd hour, active call, "safe account" payee), the bank calls Ruko's API. Ruko holds the payment, and a Bolna agent calls the customer in their language:

- It opens with a one-time code word shown in the app, so the call is hard to spoof.
- It asks "Is anyone on another call telling you what to do?", and uses the bank's own device signal ("your app shows you were on a call").
- It names the scam with an official line. With consent, it calls a trusted family contact.
- A deterministic, explained policy then releases, delays or blocks the payment.

The LLM can escalate, never de-escalate, and Ruko never asks for an OTP or PIN. A free public "Is this a scam?" line and a fraud-ops console come with it.

**Why now.**

- RBI's liability directions take effect on 1 January 2027. They cover payments made "under coercion or duress", and treat "not paying attention to specific, directed and clear warnings from the bank" as customer negligence ([RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0)).
- RBI's April 2026 discussion paper seeks views on a one-hour delay for payments above ₹10,000 and a "trusted person" who co-approves payments above ₹50,000 for vulnerable customers. Ruko is a targeted version of both.
- Banks must make service calls from 1600xx numbers, which networks may not flag as spam. TRAI now also requires automated calls, including artificial-voice calls, to be pre-declared to the operator with their caller IDs (PR 119/2026).
- Bolna's flat voice-AI rate is ₹5.52 ($0.06) a minute for its preferred models, before telephony and platform fees.

**Wedge and model.**

- **First:** co-operative banks, small finance banks and NBFCs. They have lean fraud teams.
- **Then:** UPI apps, and the UK, where banks must reimburse push-payment scam victims.
- **Pricing:** ₹20–30 per completed check, nothing for payments that pass. Cost is about ₹7–14 per check (estimate) = 1–1.5 min × ₹5.52/min of voice AI, plus telephony and platform fees (assumed).
- **Market (estimates; formulas and sources in BUSINESS.md):**
  - **India wedge:** ₹63–158 crore (about $7–17M) a year = 12.6 lakh frauds above ₹10,000 (28 lakh reported in 2025 × the ~45% NCRP share, RBI paper) × 20–50 checks per real scam (assumption) × ₹25.
  - **UK, where banks pay:** since 7 Oct 2024 sending and receiving banks split APP-scam refunds 50:50, up to £85,000 a claim (PSR). £2.8–13.8M a year = 68,935 personal non-purchase APP cases (UK Finance 2026) × 20–50 × £2–4 (below the £6.17 average UK inbound call, ContactBabel 2026).
  - **Australia:** A$2.18bn lost in 2025 (National Anti-Scam Centre); most Scams Prevention Framework duties start 31 Mar 2027 (ASIC). A$4.4–21.8M, assumption-based.
  - **Then:** adjacent checks on the same engine (loan disbursal, changed payees, device recovery, trusted-contact programmes, insurance payouts). Expansion, not sized.

**Results so far.** We have no customers, no pilots and no measured live calls. Results are **text mode**: a Nebius-hosted Qwen3-30B stands in for Bolna's gpt-4.1-mini, with the same prompt and tools, against the real engine. Call times are estimated.

| v5 eval set | Scams caught | False holds |
|---|---|---|
| **Fresh held-out 4** (frozen before v5 ran; mostly heavy coaching in Hindi/Hinglish) | **15/18** | **2/10** (delays) |
| Held-out 1–3 (previously seen) | 43/48 | 4/36 |
| Dev (tuned on) | 60/60 | 2/24 |

- 0 OTP or PIN requests in v5 (208 conversations, 959 agent turns).
- About a minute to a decision (median 51–59 s by set, estimated from transcripts); tool latency p50 74 ms locally.
- **Weakest area:** heavily coached customers who stick to a cover story: 13 of 16 caught on the fresh set. On critical-risk payments Ruko never releases on a cover story alone; it delays with a call-back and the fraud desk. That safe default costs a few delayed genuine payments, which we chose deliberately.
- End to end, the pre-call policy lets small scams with no active call through uncalled (12 of 60 on the dev set).

**Competition.** Starling, Westpac and Barclays run in-app questions for their own customers. BioCatch and RBIH's MuleHunter.AI flag risky sessions and mule accounts, but don't talk to the customer. Convin claims outbound fraud calls. As of October 2026, we found no one selling Indian banks this full combination.

**Risks.**

- False holds: the policy needs evidence, and pilots start in shadow mode.
- Coached customers: the device signal, cover-story probes, the safe default and the trusted contact help.
- Bolna dependence: our engine is provider-neutral; concurrency and content rules are Bolna's.
- Data protection: DPDP consent covers recordings and trusted contacts.
- Scammer adaptation: device signals don't depend on what the customer says, and new scripts reach the library through public advisories and bank partners' consented reports.

**The ask.** Introductions to two or three Indian banks or NBFCs for shadow-mode pilots, and help running the first measured live-call study.
