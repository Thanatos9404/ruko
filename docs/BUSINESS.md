# Ruko: business plan

Ruko sells banks and payment apps a 60-second voice check on risky payments. They pay per completed check, and nothing for payments that pass. India comes first, then the UK.

Status: 17 October 2026. Figures marked **(estimate)** or **(assumption)** are ours; [RESEARCH.md](RESEARCH.md) has the evidence.

## 1. Buyer and user

| Role | Who | What they get |
|---|---|---|
| **Buyer** | Head of fraud risk at a bank, NBFC or UPI app, with compliance | Fewer completed scams, an auditable record of each intervention, and a documented warning to the customer |
| **Integrator** | The payments or app team | One API call when a payment looks risky, a hold screen that shows the code word, and a webhook with the outcome |
| **User** | The customer, especially older and first-time digital payers | A calm call in their language that names the scam before the money moves |
| **Second user** | A trusted family contact | A call, with the customer's consent, only after a warning sign |
| **Operator** | The fraud-ops analyst | A console with the transcript, the signals and a plain-language reason for every decision |

The free public "Is this a scam?" line and text checker serve anyone, and bring in new scam scripts as they appear.

## 2. Market sizing (bottom-up)

The unit is one completed voice check.

**Step 1: scams worth a call.** About 28 lakh frauds were reported in 2025. Of these, 45% were above ₹10,000, and those carried 98.5% of the value ([RBI Discussion Paper, Apr 2026](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810)). That gives **about 12.6 lakh frauds a year above ₹10,000** (derived). Not all of them are push-payment scams that a call could stop, and many frauds are never reported. We assume the two roughly cancel out **(assumption)**.

**Step 2: checks per real scam.** A pre-payment policy holds many genuine payments for every scam it catches. We assume **20–50 checks per real scam (assumption)**. Our eval cannot measure this because it does not reflect real-world base rates. Design partners will.

**Step 3: price.** ₹25 per check, the midpoint of our ₹20–30 range.

| | Checks per year | Revenue per year | Basis |
|---|---|---|---|
| **TAM, India** | 2.5–6.3 crore | ₹630–1,575 crore (about $68–171M at ₹92/$) | Steps 1–3 |
| **SAM, India** | 0.75–1.9 crore | ₹190–470 crore | Assumes 30% of that volume sits with institutions that would buy an API rather than build: co-operative and small finance banks, NBFCs with payment products, mid-size private banks and UPI apps **(assumption)** |
| **SOM, end of year 3** | about 37.5 lakh | about ₹8 crore ARR (about $0.9M) | 15 smaller institutions at 50,000 checks each, plus 2 larger partners at 15 lakh each, at ₹22 average **(assumption)** |
| **UK, indicative** | 0.5–1.2 crore | £10–50M | 248,070 APP cases in 2025 ([UK Finance](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf)) × 20–50 checks × £2–4 **(assumption)** |

**Cross-check.** UPI handled about 24.07 billion payments in September 2026 ([NPCI](https://www.npci.org.in/product/upi/product-statistics)), or roughly 28,900 crore a year. The TAM implies a call on about 1 in 4,600 to 1 in 11,500 UPI payments. That is a small enough friction budget for a bank to accept.

## 3. Pricing and unit economics

### Pricing

- **₹20–30 per completed voice check.** No charge for API screening when the payment passes without a call, and none for unanswered attempts (retries are capped).
- The trusted-contact call is included.
- Volume tiers bring the price down.
- Design-partner pilots run at cost.

### Cost per check (estimate)

| Item | Basis | ₹ per check |
|---|---|---|
| Voice AI (speech-to-text, LLM, text-to-speech) | Bolna pay-as-you-go flat rate of ₹5.52/min ([Bolna](https://www.bolna.ai/docs/pricing/preferred-models)) × 1–1.5 min | 5.5–8.3 |
| Telephony | Carrier per-minute, billed in whole minutes ([Bolna](https://www.bolna.ai/docs/pricing/call-pricing)). Rate not published; we assume ₹0.5–1.5/min × 1–2 min | 0.5–3.0 |
| Bolna platform fee | Per minute ([Bolna](https://www.bolna.ai/docs/pricing/call-pricing)). Rate not in the docs we read; we assume ₹0.5–1/min | 0.5–2.0 |
| Trusted-contact call | Assume 10% of checks × ₹6 | about 0.6 |
| Hosting, tool calls, storage | Estimate | under 0.5 |
| **Total, pay-as-you-go** | | **about ₹7–14** |
| Total at an enterprise voice rate of ₹1.75–2/min ([Inc42](https://inc42.com/features/the-unit-economics-of-indias-voice-ai-boom/)) | | about ₹4–9 |

At ₹25 a check, gross margin is roughly 45–70% at pay-as-you-go rates and 65–85% at enterprise rates (estimate).

**Compared with a human call-back.** An Indian call-centre agent costs about ₹7–8 a minute before hiring, training and attrition ([Inc42](https://inc42.com/features/the-unit-economics-of-indias-voice-ai-boom/)). A fraud-desk call-back means looking up the case, dialling, talking and writing notes. At an assumed 4–6 minutes of agent time, that is ₹28–48 a call before overhead. It also cannot reliably happen within seconds, at 2 a.m., in the customer's language. Gartner put a live assisted contact at about $8.01 ([2019, global](https://www.gartner.com/en/newsroom/press-releases/2019-09-25-gartner-says-only-9--of-customers-report-solving-thei)).

### Illustrative ROI (assumptions labelled)

Consider an institution running 1,00,000 checks a year, which costs ₹25 lakh at ₹25 a check. We assume:

- **1 in 30 checks is a real scam (assumption).** That is 3,333 scams.
- **Ruko stops 70% of them (assumption).** That is deliberately below the 96.7% text-mode eval result, because real calls will do worse. That is 2,333 scams stopped.
- **The average loss avoided is ₹1 lakh (assumption).** That is below the 2024 averages: about ₹1.19 lakh per financial-fraud complaint, and about ₹1.57 lakh per digital-arrest complaint (derived from [LS USQ 344](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf) and [RS USQ 1505](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf)).

On these assumptions, customers keep about **₹23 crore a year, against ₹25 lakh of spend**.

That money mostly belongs to customers, and in India a bank's direct saving is smaller. We say so plainly.

- **The bank's share is capped.** RBI's 2026 directions, effective 1 January 2027, give compensation of 85% of the loss, up to ₹25,000, once per customer, on losses up to ₹50,000 ([RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0); [Moneylife](https://moneylife.in/article/rbi-notifies-digital-fraud-compensation-rules-gives-banks-more-time-delays-rollout/80882.html)). The cost is shared, and the customer's bank pays only part of it. A reported split of RBI 65%, sending bank 10% and receiving bank 10% is unverified.
- **What else the bank saves:** complaint and lien handling, ombudsman cases, and customer trust.
- **The warning clause helps the bank.** The same directions count ignoring "specific, directed and clear warnings from the bank" as customer negligence. A recorded call that names the scam aloud is designed to be such a warning. Whether a particular call qualifies is for the bank, its counsel and the RBI to decide. Ruko's purpose is to stop the payment, not to shift blame.

In the UK the saving is direct. The sending and receiving firms split reimbursement 50:50, up to £85,000 per claim ([PSR](https://www.psr.org.uk/news-and-updates/latest-news/news/psr-confirms-its-decision-on-app-scams-reimbursement/); [Pay.UK](https://www.wearepay.uk/wp-content/uploads/2025/08/Pay.UK-APPR-RCMS-Product-Outline.pdf)). The average APP loss was about £2,324 in 2025 (derived from UK Finance).

## 4. Go-to-market

**Phase 1, India, months 0–6: design partners.** We will sign two or three co-operative banks, small finance banks or NBFCs with payment products. They are the wedge for four reasons:

- They have lean fraud teams and no round-the-clock multilingual call-back desk (our assessment).
- Their customers include many older and first-time digital payers (assumption).
- They face the same RBI fraud directions as larger banks.
- They decide faster.

There is room to grow: 756 banks are live on UPI ([NPCI](https://www.npci.org.in/product/upi/product-statistics)), against 139 commercial banks at end-March 2025 ([RBI](https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=23639)), so most UPI banks are smaller ones (derived).

Each pilot runs in three stages:

1. **Shadow mode.** Ruko scores payments but the bank decides.
2. **Live on a slice.** For example, payments over ₹50,000 to new payees.
3. **Weekly review** of scams stopped, false holds, complaints and time to decision.

Calls come from the bank's own 1600xx number, through its own telephony provider, which Bolna supports ([Bolna](https://www.bolna.ai/docs/get-started/what-it-costs)).

**Phase 2, months 6–18: scale.** We will add UPI apps (TPAPs) and mid-size private banks, selling with risk-signal vendors (Ruko acts on their scores) and with technology providers that serve many co-operative banks at once.

**Phase 3, UK, months 12–24.** UK banks have three reasons to buy:

- Reimbursement is mandatory, which gives them a direct P&L case.
- Since October 2024, banks may delay a payment up to D+4 when they have reasonable grounds to suspect fraud, so they can contact the payer ([Payment Services (Amendment) Regulations 2024](https://www.regulationtomorrow.com/2024/10/the-payment-services-amendment-regulations-2024/)).
- The FCA's guidance on that delay ([FG24/6](https://fca.org.uk/publication/finalised-guidance/fg24-6.pdf)) points, in our reading, to a real-time route to a human. Ruko's design therefore documents a transfer to the bank's fraud desk through Bolna's [call transfer](https://www.bolna.ai/docs/tool-calling/transfer-calls). It is not built yet.

The first UK targets are challenger banks, building societies and e-money firms.

## 5. Competition

Three groups work near this problem. [RESEARCH.md](RESEARCH.md) section 5 has the full table.

1. **Large banks' own in-app question flows**: Starling, Westpac, Barclays and Revolut. They are good, but built in-house and not sold to others.
2. **Risk-signal vendors**: BioCatch, DoT FRI, MuleHunter.AI, Clari5, Bureau, Feedzai and FICO. They score payments but do not talk to the customer. They are partners more than competitors.
3. **Voice AI with fraud-alert workflows**: Convin and Lorikeet. They are the closest.

As of October 2026, we found no one selling Indian banks the full combination: a hold, a code-word-verified call in the customer's language, questions for coached customers, a consented trusted contact, and a deterministic decision.

**Our edge is not the model.** It is:

- the conversation design for coached customers;
- the policy that cannot be talked down;
- an official-source truth library in Indian languages;
- an eval harness;
- over time, labelled conversations and new scripts from the public line.

## 6. Why now

- **Regulation is moving toward this.**
  - The RBI's 2026 liability directions, effective 1 January 2027, cover coerced payments and define what counts as a bank warning.
  - The RBI's April 2026 paper floats a one-hour delay and a "trusted person". Ruko is a targeted version of both.
- **Bank AI calls now have a legitimate channel.** BFSI calls must come from the 1600xx series, which cannot be tagged as spam ([SCC Online](https://www.scconline.com/blog/?p=390749)). TRAI's PR 119/2026 sets rules for declaring calls made with an artificial voice ([TRAI](https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf)).
- **The cost works.** Voice AI costs ₹5.52/min pay-as-you-go and ₹1.75–2/min at enterprise volume.
- **Losses are large and rising.**
  - Reported losses were ₹22,931 crore in 2025.
  - Digital-arrest losses grew 5.7 times from 2023 to 2024.
  - The Supreme Court ordered a CBI probe in December 2025 ([Tribune](https://www.tribuneindia.com/news/india/digital-arrest-scam-sc-orders-pan-india-cbi-probe-issues-sweeping-directions-to-states-agencies)).

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **False holds annoy genuine customers** | Only flagged payments get a call, and calls take 60–90 seconds. The policy releases a payment when the answers explain it. Established payees and pre-declared payments lower the score. If the customer can't be reached, the hold lasts 30 minutes or until they confirm in the app. The eval found 1 false hold in 48 genuine payments (text mode). Real calls are unmeasured, so pilots start in shadow mode. |
| **The model misses a coached customer** | The LLM can escalate a decision but never de-escalate it. The agent uses the bank's device signal ("your app shows you were on a call"). The trusted contact can raise a concern. This is still our weakest area: v2 caught 4 of 8 heavily coached customers on a clean held-out set. |
| **Small scams with no call never reach Ruko** | The pre-call policy let 12 of 60 dev-set scams through without a call. Ruko acts on the bank's risk signals and does not replace them. |
| **Scammers spoof Ruko** | The code word appears only in the bank's app, and calls come from 1600xx numbers. The agent never asks for an OTP or PIN and never moves money. On a mismatch, the customer is told to hang up and open the app. Residual risk: screen-sharing would expose the code word, so a running remote-access app is a hard hold, and the agent asks about it. |
| **Scammers adapt their scripts** | Device signals don't depend on what the customer says. The public line collects new scripts, and the pattern library is updated. The policy cannot be talked down. |
| **Dependence on Bolna** | The engine, policy, tools and eval are provider-neutral HTTP. Risks are pricing changes, content-safety restriction and burst concurrency (paid accounts start at 10 concurrent calls). We will negotiate enterprise concurrency, and fall back to in-app confirmation and the bank's desk. |
| **Regulation** | A mandated one-hour lag or trusted person would fit Ruko's design. See section 8. |

## 8. Regulatory notes

### India

- **RBI Master Directions on Fraud Risk Management (15 Jul 2024)** set expectations for real-time transaction monitoring and handling mule accounts ([RBI](https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx?id=12702)). Ruko adds a documented, explained intervention.
- **RBI customer-liability directions (RBI/2026-27/167; effective 1 Jan 2027):**
  - they cover coerced transactions and set the compensation described above;
  - a five-day reporting window applies ([Moneylife](https://moneylife.in/article/rbi-notifies-digital-fraud-compensation-rules-gives-banks-more-time-delays-rollout/80882.html));
  - they include the warnings clause.
  The draft came in [March 2026](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62340) and the final version in [June 2026](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63011).
- **RBI Discussion Paper (9 Apr 2026)** sets out two options. The design matches it:

  | RBI option | Ruko's design |
  |---|---|
  | A one-hour delay on APP payments over ₹10,000 | Hold flagged payments only, and resolve most within 90 seconds |
  | A "trusted person" as an extra approver above ₹50,000, mandatory for customers over 70 and persons with disabilities, with 24 hours' cooling before the person can be changed | A trusted contact, called only after a warning sign. We will adopt the 24-hour cooling period for changes |

  Sources: [paper](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810), [press release](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62535).
- **DPDP Act 2023 and Rules 2025** (notified 13 Nov 2025; notice and consent duties apply from 13 May 2027) ([SCC Online](https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/)):
  - **Roles.** The bank is the data fiduciary and Ruko is its processor under contract.
  - **Notice and consent.** The customer gets notice and gives consent for calls, recording and transcripts at enrolment, and a short notice at the start of each call.
  - **Retention.** Transcripts are kept only for the period the bank sets, then deleted. OTPs and PINs are never collected, and evidence quotes exclude any numbers read out.
  - **The trusted contact.** The contact is a separate data principal. The bank must give them notice and get their own consent at enrolment, for example through a confirmation SMS. For data minimisation, the engine calls the contact only after a recorded warning sign and the customer's yes on the call. The contact hears only the amount, the payee and the concern.
- **TRAI:**
  - BFSI service and transaction calls go on 1600xx, which cannot be tagged or blocked ([RBI circular](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12770&Mode=0); [deadlines](https://www.outlookbusiness.com/news/trai-sets-firm-deadlines-for-bfsi-entities-to-adopt-1600-series-for-service-transactional-calls)).
  - **PR 119/2026 (18 Sep 2026) requires calls using a pre-recorded or artificial voice to be declared in advance, with their caller IDs, to the operator.** Each bank must declare its Ruko caller IDs.
  - Open item: the current greeting says "payment safety assistant". Before any live deployment, it should also say the assistant is automated and that the call is recorded.

### UK

- **Reimbursement:** the PSR rule from 7 October 2024, with the £85,000 cap and the 50:50 split.
- **Delay:** up to D+4 under the 2024 amendment regulations, with the FCA's FG24/6 guidance.
- **Regulator change:** the PSR is being folded into the FCA ([Bratby](https://bratby.law/psr-to-fca-streamlined-payment-systems-consultation/)).
- **Data protection:** UK GDPR applies, including data residency.
