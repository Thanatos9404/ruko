# Ruko: business plan

Ruko sells banks and payment apps a 60-second voice check on risky payments. They pay per completed check, and nothing for payments that pass. India comes first, then markets where banks pay for scam losses, starting with the UK.

Status: 22 October 2026. Every web source in this document was accessed in October 2026. Figures marked **(derived)** are our arithmetic on a cited figure. Figures marked **(assumption)** or **(estimate)** are ours. [RESEARCH.md](RESEARCH.md) has the wider evidence and [CITATIONS.md](CITATIONS.md) the audit.

**Exchange rates.** We convert with the ECB euro reference rates for 22 October 2026 ([ECB](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)): €1 = ₹106.249, $1.1205, £0.8377, A$1.598 and S$1.4315. The cross rates are **₹94.8 per $, ₹126.8 per £, ₹66.5 per A$ and ₹74.2 per S$ (derived)**. Bolna's price page implies ₹92 per $, so Bolna costs below use that rate.

## 1. Buyer and user

| Role | Who | What they get |
|---|---|---|
| **Buyer** | Head of fraud risk at a bank, NBFC or UPI app, with compliance | Fewer completed scams, an auditable record of each intervention, and a documented warning to the customer |
| **Integrator** | The payments or app team | One API call when a payment looks risky, a hold screen that shows the code word, and a webhook with the outcome |
| **User** | The customer, especially older and first-time digital payers | A calm call in their language that names the scam before the money moves |
| **Second user** | A trusted family contact | A call, with the customer's consent, only after a warning sign |
| **Operator** | The fraud-ops analyst | A console with the transcript, the signals and a plain-language reason for every decision |

The free public "Is this a scam?" line and text checker serve anyone, and bring in new scam scripts as they appear.

## 2. Market

The unit is one completed voice check. Each market is sized the same way:

> **checks a year = scams a call could stop × checks per real scam**
> **revenue pool = checks a year × price per check**

**The one assumption every market shares: 20–50 checks per real scam (assumption).** A pre-payment policy holds many genuine payments for every scam it catches. Nobody publishes this ratio. The UK's independent evaluation of its reimbursement rules says so directly: firms "did not provide comparable data on average transaction times, payment-hold rates, false positive rates or the number of legitimate payments delayed" ([Frontier Economics for the PSR, 1 Jul 2026, section 7.4.1](https://www.frontier-economics.com/media/bcxpzalg/app-scams-evaluation-final-technical-report-26-06-26.pdf)). Our own eval cannot measure it either, because it does not reflect real-world base rates. Design partners will.

The order is: **India as the wedge, then markets where banks pay for scam losses (UK first, then Australia), then adjacent checks on the same engine.**

### 2.1 India: the wedge

**Step 1: scams worth a call.** About 28 lakh frauds were reported in 2025 ([RBI Discussion Paper, Apr 2026](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810), table: "2025 28 lakh 22,931"). NCRP data in the same paper show payments above ₹10,000 are about 45% of reported fraud cases and about 98.5% of value. Applying that split to 2025 gives **about 12.6 lakh frauds above ₹10,000 (derived; assumption)**. The split is undated, so applying it to 2025 is our step. Not all of these frauds are push-payment scams that a call could stop, and many frauds are never reported. We assume the two roughly cancel out **(assumption)**.

**Step 2: checks per real scam.** 20–50 (assumption, above).

**Step 3: price.** ₹25 per check, the midpoint of our ₹20–30 range.

| | Checks a year | Revenue a year | Basis |
|---|---|---|---|
| **TAM, India** | 2.5–6.3 crore | **₹63–158 crore** (about $6.6–16.6M) | 12.6 lakh × 20–50 × ₹25 |
| **SAM, India** | 0.75–1.9 crore | **₹19–47 crore** | 30% of TAM volume sits with institutions that would buy an API rather than build: co-operative and small finance banks, NBFCs with payment products, mid-size private banks and UPI apps **(assumption)** |
| **SOM, India, end of year 3** | about 9 lakh | about **₹2 crore ARR** (about $0.2M) | 8 smaller institutions at 50,000 checks each, plus 1 mid-size partner at 5 lakh, at ₹22 average **(assumption)**. That is 5–12% of SAM. |

An earlier version of this table said ₹630–1,575 crore. That was an arithmetic error, 10 times too high. The earlier SOM of ₹8 crore was 20–50% of the corrected SAM, which is not credible for year 3, so we cut it.

**Cross-check.** UPI handled 24,068 million payments in September 2026 ([NPCI](https://www.npci.org.in/product/upi/product-statistics)), or about 28,900 crore a year (derived). The TAM implies a call on about 1 in 4,600 to 1 in 11,500 UPI payments (derived). That is a small enough friction budget for a bank to accept.

**Why India is the wedge, not the prize.**

- **Scale for learning.** UPI's volume and 756 live banks ([NPCI](https://www.npci.org.in/product/upi/product-statistics)) give us many scripts, languages and design partners quickly.
- **Lowest cost per check.** Our voice layer, Bolna, publishes rupee pricing ([Bolna](https://www.bolna.ai/docs/pricing/preferred-models)). Our cost is about ₹7–14 a check (estimate, section 3).
- **Regulation is moving.** RBI's 2026 directions cover payments made "under coercion or duress" and treat "not paying attention to specific, directed and clear warnings from the bank" as customer negligence. They apply to transactions from 1 January 2027 ([RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0)). RBI's April 2026 discussion paper seeks views on a one-hour delay for payments above ₹10,000 and a "trusted person" who co-approves payments above ₹50,000 for vulnerable customers ([RBI](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810)).
- **The limit.** In dollars, India is a $7–17M a year pool. Indian banks also carry little of the loss directly (section 3). The bank's reasons to buy here are regulatory and reputational more than P&L. That is why the next markets are ones where banks pay for scam losses.

### 2.2 UK: the first expansion

**The trigger.** Since 7 October 2024, UK payment firms must reimburse most victims of authorised push payment (APP) scams on Faster Payments and CHAPS. The PSR's consolidated policy statement says: "Receiving PSPs must ... pay sending PSPs 50% of the reimbursement that the sending PSP paid to the consumer". The maximum is £85,000 per claim, the sending firm may apply an excess of up to £100, and it must normally reimburse within five business days ([PSR PS25/5, May 2025](https://www.psr.org.uk/media/rhelv4op/ps25-5-app-scams-reimbursement-consolidated-policy-statement-may-2025.pdf); [PSR, 25 Sep 2024](https://www.psr.org.uk/news-and-updates/latest-news/news/psr-confirms-its-decision-on-app-scams-reimbursement/)).

**What has happened since.**

- From 7 October 2024 to 31 March 2026, consumers reported about 438,300 claims, of which 301,500 were in scope. Firms reimbursed 88% of the money lost, or £316m ([PSR dashboard, updated 30 Jul 2026](https://www.psr.org.uk/information-for-consumers/app-scams-reimbursement-dashboard/)). That is **about £1,050 reimbursed per in-scope claim (derived: £316m ÷ 301,500)**.
- The PSR's independent evaluation found in-scope losses fell by about £73m a year and nearly 35,000 fewer scams, and that the policy raised firms' costs by £44m–£56m a year ([PSR, 1 Jul 2026](https://www.psr.org.uk/news-and-updates/latest-news/news/payment-fraud-falls-by-73m-following-psr-reimbursement-scheme/); [Frontier Economics](https://www.frontier-economics.com/uk/en/news-and-insights/news/news-article-i22383-app-payment-scam-policies-reducing-fraud/)).
- Banks already do by hand what Ruko automates. About 12 firms reported more direct contact with customers, including specialist teams doing "labour-intensive direct customer engagement aimed at interrupting the scam". Eight reported new holds or pauses on high-risk payments (Frontier, section 5.1.1).
- Since October 2024, banks may also delay a payment up to D+4 when they suspect fraud ([Payment Services (Amendment) Regulations 2024](https://www.regulationtomorrow.com/2024/10/the-payment-services-amendment-regulations-2024/); [FCA FG24/6](https://fca.org.uk/publication/finalised-guidance/fg24-6.pdf)).

**The scams.** From the [UK Finance Annual Fraud Report 2026](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf) (2025 data):

| Measure | Figure | Page |
|---|---|---|
| APP cases, all accounts | 248,070; losses £576.4m | 33 |
| APP cases, personal accounts | 240,566; losses £500.8m | 33 |
| Purchase scams, personal accounts | 171,631 cases; £106.8m | 37 |
| Purchase scams, share of all APP cases | 71% | 37 |
| Investment scams, share of all APP losses | 38% (£221.5m) | 38 |
| Impersonation of police or bank staff | 6,016 cases; £55.5m | 43 |
| Cases enabled by telecommunications | 17% of cases, 28% of losses (from a subset of APP case data) | 34 |

Purchase scams are fake goods bought online. A voice check fits them least: the victim is not usually being coached on a call. So we size a **core** without them:

- **Core cases: 240,566 − 171,631 = 68,935 personal APP cases a year (derived).** They are 29% of personal cases but 79% of personal losses (£394.0m), an average of about £5,700 each (derived).
- We found no published count of payments UK banks hold or call about (see the Frontier quote above). So we use cases × 20–50.

**Price: £2–4 per check (assumption), derived from the alternatives.**

- **A human call.** The average inbound UK contact-centre call costs £6.17 ([ContactBabel, UK Contact Centre Decision-Makers' Guide 2026](https://www.contactbabel.com/the-uk-contact-centre-decision-makers-guide/)). A fraud call-back is outbound, needs a trained agent and a case lookup, and runs longer than a typical service call, so £6.17 is a floor (our reading). £2–4 is a third to two-thirds of that floor.
- **Reimbursement avoided.** If 1 check in 20–50 is a real scam and Ruko stops 70% of them (assumption), the sending bank avoids £1,050 × 50% × 70% ÷ 20–50 = **£7–18 of reimbursement per check (derived)**. Counting both banks' shares, it is £15–37. This uses the PSR's all-claims average. The core scams average about £5,700, so it understates the core.

| UK | Checks a year | Revenue a year | Basis |
|---|---|---|---|
| **Core** | 1.4–3.4 million | **£2.8–13.8M (₹35–175 crore)** | 68,935 × 20–50 × £2–4 |
| **Upper bound**, all personal APP | 4.8–12.0 million | £9.6–48M (₹122–610 crore) | 240,566 × 20–50 × £2–4, if banks also route purchase-scam flags to a call |
| **Year 3 illustration** | 100,000 | £0.3M (₹3.8 crore) | 2 customers at 50,000 checks each, at £3 **(assumption)**. That is 3–7% of the core. |

The upper bound replaces the earlier "£10–50M" line, which used all 248,070 cases, including business accounts. As a cross-check, the PSR's in-scope count is about 201,000 claims a year (derived: 301,500 over 18 months), the same order as UK Finance's cases.

### 2.3 Australia

**The trigger.** The Scams Prevention Framework Act 2025 (No. 15, 2025; [Federal Register of Legislation](https://www.legislation.gov.au/C2025A00015/asmade/text), 20 Feb 2025) requires banks, telecoms providers and digital platforms "to take action to prevent, detect, disrupt, report, and respond to scams", plus governance duties ([ASIC](https://www.asic.gov.au/regulatory-resources/scams/scams-prevention-framework/)). Dates:

- 28 May 2026: the government designated banking, telecommunications and key digital platforms as the first sectors, and released draft rules and sector codes. Consultation closed 25 June 2026 ([Treasury ministers](https://ministers.treasury.gov.au/ministers/daniel-mulino-2025/media-releases/albanese-government-steps-industry-protections-stop)).
- 1 September 2026: regulated firms had to join AFCA, the complaints scheme for SPF disputes ([ASIC](https://www.asic.gov.au/regulatory-resources/scams/scams-prevention-framework/)).
- **31 March 2027: most SPF obligations commence.** More follow by the end of 2027 ([ASIC](https://www.asic.gov.au/regulatory-resources/scams/scams-prevention-framework/)).
- Not settled: the government's view that "scam victims with verified losses below $3,000 be automatically reimbursed" is out for consultation ([Treasury ministers](https://ministers.treasury.gov.au/ministers/daniel-mulino-2025/media-releases/albanese-government-steps-industry-protections-stop)). We did not find final, registered codes as of October 2026.

So Australia sets enforceable duties, with complaints going to AFCA. A UK-style reimbursement rule is not in force: the A$3,000 proposal is still a consultation. A recorded call that detects and disrupts a scam is evidence a bank met those duties (our reading).

**Losses** ([National Anti-Scam Centre, Targeting Scams Report 2025](https://www.nasc.gov.au/system/files/targeting-scams-report-2025.pdf), 30 Mar 2026):

- **A$2.18 billion lost in 2025**, across 481,523 reports, of which 274,577 involved a loss.
- Reports to banks through the Australian Financial Crimes Exchange (AFCX): 202,943 reports, **199,666 with a loss**, A$842.3m. The report warns that AFCX data may contain overlapping entries.
- Investment scams were the largest type, at A$837.7m.

**Sizing (assumption-based range).** The AFCX gives losses by scam type but not counts by type. So we apply the UK core share of 28.7% (assumption): 199,666 × 28.7% = **about 57,200 core cases (assumption)** × 20–50 = **1.1–2.9 million checks**. At the UK price of £2–4 (A$3.8–7.6), the pool is **A$4.4–21.8M a year (₹29–145 crore)**. If every bank-reported scam were in scope, the upper bound is 4.0–10.0 million checks and A$15–76M. We have no Australian source for the price; it is the UK price converted **(assumption)**.

### 2.4 Singapore

**The trigger is weak for Ruko.** The MAS and IMDA Shared Responsibility Framework took effect on 16 December 2024 ([MAS, 24 Oct 2024](https://www.mas.gov.sg/news/media-releases/2024/mas-and-imda-announce-implementation-of-shared-responsibility-framework-from-16-december-2024)). It covers "phishing scams which are perpetrated through the impersonation of a legitimate business or government entity, where account credentials were revealed on a fake digital platform (e.g., website, application), leading to unauthorised transactions being performed". MAS and IMDA kept that scope rather than "a broader category of fraudulent payments beyond phishing (some of which may arise from scams involving authorised transactions)". The SRF also excludes malware scams and phishing by phone call ([MAS–IMDA response to consultation, 24 Oct 2024, paras 3.1–3.5](https://www.mas.gov.sg/-/media/mas-media-library/publications/consultations/pd/2023/srf/mas-imda-response-to-consultation-on-shared-responsibility-framework.pdf)).

In plain terms, the SRF covers payments made by a scammer with stolen credentials. It does not cover payments a coached customer makes themselves, which is what Ruko checks.

**Losses** ([SPF Annual Scam and Cybercrime Brief 2025](https://www.police.gov.sg/-/media/SPF/Advisories/Scams/Annual-Scam-and-Cybercrime-Brief-2025.pdf)):

- **S$913.1M lost to scams in 2025** across 37,308 cases, down from S$1,112.4M and 51,501 cases in 2024.
- **81.8% of scam cases involved self-effected transfers**, where scammers "manipulated them into performing monetary transactions". These are out of the SRF's scope.
- Government-official impersonation scams: 3,363 cases and S$242.9M. E-commerce scams: 6,703 cases.
- The same brief reports that, working with MAS, banks "will also be implementing cooling periods for high-risk activities and in-app notifications to verify legitimate bank calls".

**Sizing (assumption-based range).** Self-effected cases: 37,308 × 81.8% = 30,518. Removing e-commerce, as we removed purchase scams in the UK, leaves **about 23,800 core cases (derived; assumes every e-commerce case was self-effected)** × 20–50 = **0.5–1.2 million checks**. At £2–4 (S$3.4–6.8; assumption), the pool is **S$1.6–8.1M a year (₹12–60 crore)**. Without a liability rule for coached payments, Singapore is a later market.

### 2.5 European Union

**Status: agreed politically, not yet law.**

- 27 November 2025: the Council and Parliament reached a provisional agreement on a new Payment Services Regulation (PSR) and PSD3. It targets "spoofing fraud", where "fraudsters impersonate a customer's payment service provider (PSP)" (Council press release 1001/25, [copy hosted by dirittobancario.it](https://www.dirittobancario.it/wp-content/uploads/2025/11/Comunicato-stampa-Consiglio-UE-27-novembre-2025.pdf); the [Council's own page](https://www.consilium.europa.eu/en/press/press-releases/2025/11/27/payment-services-council-and-parliament-agree-to-step-up-the-fight-against-fraud-and-increase-transparency/) served us a browser check, which we did not bypass).
- 5 May 2026: Parliament's ECON committee approved the agreed text. Parliament's tracker shows the file as "Awaiting Council's 1st reading position", with an indicative plenary date of 14 December 2026 ([Legislative Observatory, 2023/0210(COD)](https://oeil.secure.europarl.europa.eu/oeil/en/procedure-file?reference=2023/0210(COD))).

**The refund rule (Article 59 of the agreed text).** Where a consumer "was manipulated by a third party pretending to be the consumer's payment service provider" through channels attributed to that PSP, the PSP must refund the full amount, if the consumer notified the PSP and reported the fraud to the police. The PSP must refund, or justify a refusal, within 15 business days. The rule does not apply where the consumer acted fraudulently or with gross negligence ([ECON provisional agreement, PE787.675, 5 May 2026](https://www.europarl.europa.eu/RegData/commissions/econ/inag/2026/05-05/ECON_AG(2026)787675_EN.pdf)).

**Timing.** The regulation would apply 21 months after it enters into force, with some provisions at 27 months (Article 112). If it is published in early 2027, most rules would apply in late 2028 (our estimate).

**Scale.** Payment fraud in the EEA was €4.2 billion in 2024, and fraudulent credit transfers were €2.5 billion. "Manipulation of the payer accounted for more than half" of the credit-transfer fraud value, and users bore about 85% of credit-transfer fraud losses ([EBA–ECB joint report, Dec 2025](https://www.ecb.europa.eu/press/intro/publications/pdf/ecb.ebaecb202512.en.pdf)). The refund covers only bank impersonation, and we found no EU count of such cases, so **we do not size the EU**.

### 2.6 Adjacent checks on the same engine (EXPANSION, not current)

These use the same hold, code-word call, questions and deterministic policy. They are plausible extensions, not products, and we have no sourced market numbers for them.

| Check | Why a voice call adds something |
|---|---|
| **Loan disbursal confirmation** | It confirms the borrower asked for the loan themselves and is not being coached to pass the money on, in their own language. |
| **New or changed high-risk payee** | A spoken question can ask why the payee changed, which a warning screen cannot follow up. |
| **New-device account recovery** | An outbound call to the registered number, with the code word shown only in the app, checks that the account holder is the one asking, and is not being talked through it. |
| **Bank-run "trusted contact" programmes for older customers** | A call explains the concern to the trusted person in plain words, rather than a notification they may ignore. Singapore's CPF Board launched a Trusted Contact notification service in February 2026 ([SPF brief 2025](https://www.police.gov.sg/-/media/SPF/Advisories/Scams/Annual-Scam-and-Cybercrime-Brief-2025.pdf)), and RBI's discussion paper floats a "trusted person". |
| **Insurance claim payout confirmation** | It confirms the claimant and the receiving account before money leaves, which catches redirected payouts. |

### 2.7 Summary

| Market | Trigger | Checks a year (formula) | Price | Revenue pool a year | Status |
|---|---|---|---|---|---|
| **India (wedge)** | RBI liability directions, effective 1 Jan 2027; RBI discussion paper, Apr 2026 | 12.6 lakh × 20–50 = 2.5–6.3 crore | ₹25 | **₹63–158 crore** ($6.6–16.6M) | Fraud count sourced; 2025 split, ratio and price are assumptions |
| **UK, core** | PSR reimbursement since 7 Oct 2024: 50:50, up to £85,000 | 68,935 × 20–50 = 1.4–3.4 million | £2–4 | **£2.8–13.8M** (₹35–175 crore) | Cases sourced; ratio and price are assumptions; price anchored to a sourced £6.17 call cost |
| UK, upper bound | Same | 240,566 × 20–50 = 4.8–12.0 million | £2–4 | £9.6–48M (₹122–610 crore) | As above |
| **Australia** | SPF Act 2025; most obligations from 31 Mar 2027 | 199,666 × 28.7% × 20–50 = 1.1–2.9 million | A$3.8–7.6 | **A$4.4–21.8M** (₹29–145 crore) | Reports sourced; core share, ratio and price are assumptions |
| **Singapore** | No liability rule for coached payments; SRF covers phishing only | (37,308 × 81.8% − 6,703) × 20–50 = 0.5–1.2 million | S$3.4–6.8 | **S$1.6–8.1M** (₹12–60 crore) | Cases sourced; ratio and price are assumptions |
| **EU** | PSR Article 59: refunds for bank-impersonation fraud; not yet adopted | Not sized | – | Not sized | Status and text sourced; no case count |
| **Core total** (India, UK core, Australia, Singapore) | | | | **₹139–538 crore (about $15–57M)** | Derived |

The honest reading: scam checks alone are a pool of tens of millions of dollars a year across these four markets. That is enough to build a company on, but not a large one. The case for scale rests on the UK and Australia paying more per check, and on the adjacent checks in 2.6.

### 2.8 What we could not source

- **Checks per real scam (20–50).** No bank or regulator publishes hold or false-positive rates.
- **Ruko's stop rate (70%)**, used for the reimbursement-avoided figure and the ROI below.
- **The cost of a UK fraud call-back specifically.** We have only the general inbound-call average (£6.17).
- **Prices for Australia and Singapore.** They are the UK price converted.
- **Australia's core share.** We borrowed the UK's 28.7% because AFCX gives no counts by scam type.
- **Singapore's e-commerce adjustment.** We assumed every e-commerce case was a self-effected transfer.
- **India:** the share of frauds that are push-payment scams, the share never reported, the 30% SAM share and the SOM customer counts.
- **The EU adoption date.** The 14 December 2026 plenary date is indicative.

## 3. Pricing and unit economics

### Pricing

- **India: ₹20–30 per completed voice check.** No charge for API screening when the payment passes without a call, and none for unanswered attempts (retries are capped).
- **UK: £2–4 per completed check (assumption)**, derived in section 2.2.
- The trusted-contact call is included.
- Volume tiers bring the price down.
- Design-partner pilots run at cost.

### Cost per check, India (estimate)

| Item | Basis | ₹ per check |
|---|---|---|
| Voice AI (speech-to-text, LLM, text-to-speech) | Bolna's flat voice-AI rate is ₹5.52 ($0.06) a minute for its preferred models, before telephony and platform fees ([Bolna](https://www.bolna.ai/docs/pricing/preferred-models)) × 1–1.5 min | 5.5–8.3 |
| Telephony | Carrier per-minute, billed in whole minutes ([Bolna](https://www.bolna.ai/docs/pricing/call-pricing)). Rate not published; we assume ₹0.5–1.5/min × 1–2 min | 0.5–3.0 |
| Bolna platform fee | Per minute ([Bolna](https://www.bolna.ai/docs/pricing/call-pricing)). Rate not in the docs we read; we assume ₹0.5–1/min | 0.5–2.0 |
| Trusted-contact call | Assume 10% of checks × ₹6 | about 0.6 |
| Hosting, tool calls, storage | Estimate | under 0.5 |
| **Total, pay-as-you-go** | | **about ₹7–14** |
| Total at an enterprise voice rate of ₹1.75–2/min ([Inc42](https://inc42.com/features/the-unit-economics-of-indias-voice-ai-boom/)) | | about ₹4–9 |

At ₹25 a check, gross margin is roughly 45–70% at pay-as-you-go rates and 65–85% at enterprise rates (estimate). We have not yet priced UK telephony, so we do not state a UK margin.

**Compared with a human call-back in India.** An Indian call-centre agent costs about ₹7–8 a minute before hiring, training and attrition ([Inc42](https://inc42.com/features/the-unit-economics-of-indias-voice-ai-boom/)). A fraud-desk call-back means looking up the case, dialling, talking and writing notes. At an assumed 4–6 minutes of agent time, that is ₹28–48 a call before overhead. It also cannot reliably happen within seconds, at 2 a.m., in the customer's language. Gartner put a live assisted contact at about $8.01 ([2019, global](https://www.gartner.com/en/newsroom/press-releases/2019-09-25-gartner-says-only-9--of-customers-report-solving-thei)).

### Illustrative ROI (assumptions labelled)

Consider an institution running 1,00,000 checks a year, which costs ₹25 lakh at ₹25 a check. We assume:

- **1 in 30 checks is a real scam (assumption).** That is 3,333 scams.
- **Ruko stops 70% of them (assumption).** That is deliberately below the 96.7% text-mode eval result, because real calls will do worse. That is 2,333 scams stopped.
- **The average loss avoided is ₹1 lakh (assumption).** That is below the 2024 averages: about ₹1.19 lakh per financial-fraud complaint, and about ₹1.57 lakh per complaint of "digital arrest" and related scams (derived from [LS USQ 344](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf) and [RS USQ 1505](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf)).

On these assumptions, customers keep about **₹23 crore a year, against ₹25 lakh of spend**.

That money mostly belongs to customers, and in India a bank's direct saving is smaller. We say so plainly.

- **The bank's share is capped.** RBI's 2026 directions, effective 1 January 2027, compensate 85% of the net loss, up to ₹25,000, once in a customer's lifetime, on losses up to ₹50,000 reported within five calendar days ([RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0); [Moneylife](https://moneylife.in/article/rbi-notifies-digital-fraud-compensation-rules-gives-banks-more-time-delays-rollout/80882.html)). The directions split each payout (para 76T(2)). On losses below ₹29,412, the RBI bears 65 points of the 85% and the customer's and beneficiary banks 10 each. On ₹29,412–50,000, the ₹25,000 is split ₹19,118 / ₹2,941 / ₹2,941 (domestic frauds).
- **What else the bank saves:** complaint and lien handling, ombudsman cases, and customer trust.
- **The warning clause helps the bank.** The same directions treat "not paying attention to specific, directed and clear warnings from the bank" as customer negligence. A recorded call that names the scam aloud is designed to be such a warning. Whether a particular call qualifies is for the bank, its counsel and the RBI to decide. Ruko's purpose is to stop the payment, not to shift blame.

**In the UK the saving is direct.** The sending bank pays the victim and recovers 50% from the receiving bank, up to £85,000 per claim ([PSR PS25/5](https://www.psr.org.uk/media/rhelv4op/ps25-5-app-scams-reimbursement-consolidated-policy-statement-may-2025.pdf)). The average APP loss was about £2,324 in 2025 (derived: £576.4m ÷ 248,070, [UK Finance](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf)). The average reimbursed per in-scope claim was about £1,050 (derived, PSR dashboard). On our assumptions, each check saves the sending bank £7–18 of reimbursement (section 2.2).

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

- Reimbursement is mandatory, which gives them a direct P&L case (section 2.2).
- Since October 2024, banks may delay a payment up to D+4 when they have reasonable grounds to suspect fraud, so they can contact the payer ([Payment Services (Amendment) Regulations 2024](https://www.regulationtomorrow.com/2024/10/the-payment-services-amendment-regulations-2024/)).
- The FCA's guidance on that delay ([FG24/6](https://fca.org.uk/publication/finalised-guidance/fg24-6.pdf)) points, in our reading, to a real-time route to a human. Ruko's design therefore documents a transfer to the bank's fraud desk through Bolna's [call transfer](https://www.bolna.ai/docs/tool-calling/transfer-calls). It is not built yet.

The first UK targets are challenger banks, building societies and e-money firms.

**Phase 4, Australia, from 2027.** Most SPF obligations start on 31 March 2027, so we expect Australian banks to be choosing tools during 2026 and 2027 (our reading). Singapore and the EU follow if their rules move toward coached payments.

## 5. Competition

Three groups work near this problem. [RESEARCH.md](RESEARCH.md) section 5 has the full table.

1. **Large banks' own in-app question flows**: Starling, Westpac, Barclays and Revolut. They are good, but built in-house and not sold to others.
2. **Risk-signal vendors**: BioCatch, DoT FRI, MuleHunter.AI, Clari5, Bureau, Feedzai and FICO. They score payments or flag mule accounts but do not talk to the customer. They are partners more than competitors.
3. **Voice AI with fraud-alert workflows**: Convin and Lorikeet. They are the closest.

As of October 2026, we found no one selling Indian banks the full combination: a hold, a code-word-verified call in the customer's language, questions for coached customers, a consented trusted contact, and a deterministic decision.

**Our edge is not the model.** It is:

- the conversation design for coached customers;
- the policy that cannot be talked down;
- an official-source truth library in Indian languages;
- an eval harness;
- over time, labelled conversations from consenting bank partners, and new scripts from public advisories.

## 6. Why now

- **Regulation is moving toward this.**
  - The RBI's 2026 liability directions, effective 1 January 2027, cover payments made "under coercion or duress" and define ignoring a bank's warning as customer negligence.
  - The RBI's April 2026 discussion paper seeks views on a one-hour delay and a "trusted person". Ruko is a targeted version of both.
  - The UK's mandatory reimbursement has run since October 2024, and Australia's scam obligations start in March 2027 (section 2).
- **Bank AI calls now have a legitimate channel.** Banks must make service calls from 1600xx numbers, which networks may not flag as spam. TRAI now also requires automated calls, including artificial-voice calls, to be pre-declared to the operator with their caller IDs ([TRAI PR 119/2026](https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf)).
- **The cost works.** Bolna's flat voice-AI rate is ₹5.52 ($0.06) a minute for its preferred models, before telephony and platform fees. Enterprise voice AI runs at ₹1.75–2 a minute ([Inc42](https://inc42.com/features/the-unit-economics-of-indias-voice-ai-boom/)).
- **Losses are large and rising.**
  - In 2024, Indians reported ₹22,845 crore lost to cyber fraud on the national cybercrime portal ([MHA, Lok Sabha, 22 Jul 2025](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf)).
  - Losses to "digital arrest" and related scams grew 5.7 times from 2023 to 2024 ([MHA, Rajya Sabha](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf)).
  - The Supreme Court ordered a CBI probe in December 2025 ([Tribune](https://www.tribuneindia.com/news/india/digital-arrest-scam-sc-orders-pan-india-cbi-probe-issues-sweeping-directions-to-states-agencies)).

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **False holds annoy genuine customers** | Only flagged payments get a call, and calls take 60–90 seconds. The policy releases a payment when the answers explain it. Established payees and pre-declared payments lower the score. If the customer can't be reached, the hold lasts 30 minutes or until they confirm in the app. The eval found 1 false hold in 48 genuine payments (text mode). Real calls are unmeasured, so pilots start in shadow mode. |
| **The model misses a coached customer** | The LLM can escalate a decision but never de-escalate it. The agent uses the bank's device signal ("your app shows you were on a call"). The trusted contact can raise a concern. This is still our weakest area: v2 caught 4 of 8 heavily coached customers on a clean held-out set. |
| **Small scams with no call never reach Ruko** | The pre-call policy let 12 of 60 dev-set scams through without a call. Ruko acts on the bank's risk signals and does not replace them. |
| **Scammers spoof Ruko** | The code word appears only in the bank's app, and calls come from 1600xx numbers. The agent never asks for an OTP or PIN and never moves money. On a mismatch, the customer is told to hang up and open the app. Residual risk: screen-sharing would expose the code word, so a running remote-access app is a hard hold, and the agent asks about it. |
| **Scammers adapt their scripts** | Device signals don't depend on what the customer says. New scripts reach the pattern library through public advisories and bank partners' consented reports (the public checker stores nothing). The policy cannot be talked down. |
| **The market for scam checks alone is modest** | About $15–57M a year across India, the UK core, Australia and Singapore (section 2.7). We plan for higher-priced markets and adjacent checks, and we say so. |
| **Dependence on Bolna** | The engine, policy, tools and eval are provider-neutral HTTP. Risks are pricing changes, content-safety restriction and burst concurrency (paid accounts start at 10 concurrent calls). We will negotiate enterprise concurrency, and fall back to in-app confirmation and the bank's desk. |
| **Regulation** | A mandated one-hour lag or trusted person would fit Ruko's design. See section 8. |

## 8. Regulatory notes

### India

- **RBI Master Directions on Fraud Risk Management (15 Jul 2024)** set expectations for real-time transaction monitoring and handling mule accounts ([RBI](https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx?id=12702)). Ruko adds a documented, explained intervention.
- **RBI customer-liability directions (RBI/2026-27/167; effective 1 Jan 2027):**
  - they cover coerced transactions and set the compensation and payout split described in section 3;
  - a five-day reporting window applies ([Moneylife](https://moneylife.in/article/rbi-notifies-digital-fraud-compensation-rules-gives-banks-more-time-delays-rollout/80882.html));
  - they include the warnings clause.
  The draft came in [March 2026](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62340) and the final version in [June 2026](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63011).
- **RBI Discussion Paper (9 Apr 2026)** sets out four options and asks for views. Two of them match the design:

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
  - BFSI service and transaction calls go on 1600xx, which networks may not flag as suspected spam and call-blocking apps may not blanket-block or tag (TRAI PR 119/2026). Individual users can still block them. TRAI's onboarding deadlines were 1 Jan 2026 for commercial banks, 1 Feb 2026 for large NBFCs, payments banks and SFBs, and 1 Mar 2026 for co-operative banks, RRBs and other NBFCs (PTI via [Outlook Business](https://www.outlookbusiness.com/news/trai-sets-firm-deadlines-for-bfsi-entities-to-adopt-1600-series-for-service-transactional-calls)). The RBI told banks to use 1600xx for service calls ([RBI circular](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12770&Mode=0)).
  - **PR 119/2026 (18 Sep 2026) requires every entity making application-to-person calls, which include pre-recorded and artificial-voice calls, to pre-declare them to its operator with the caller IDs it will use.** Undeclared calls are treated as unsolicited commercial communication ([TRAI](https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf)). Each bank must declare its Ruko caller IDs.
  - Open item: the current greeting says "payment safety assistant". Before any live deployment, it should also say the assistant is automated and that the call is recorded. This is our policy and part of the DPDP notice; PR 119/2026 itself does not require in-call disclosure.

### UK

- **Reimbursement:** the PSR rule from 7 October 2024, with the £85,000 cap, the £100 maximum excess and the 50:50 split ([PSR PS25/5](https://www.psr.org.uk/media/rhelv4op/ps25-5-app-scams-reimbursement-consolidated-policy-statement-may-2025.pdf)).
- **Delay:** up to D+4 under the 2024 amendment regulations, with the FCA's FG24/6 guidance.
- **Regulator change:** the PSR is being folded into the FCA ([Bratby](https://bratby.law/psr-to-fca-streamlined-payment-systems-consultation/)).
- **Data protection:** UK GDPR applies, including data residency.

### Australia, Singapore and the EU

See sections 2.3 to 2.5. In short: Australia's SPF obligations start on 31 March 2027; Singapore's SRF does not cover coached payments; the EU's bank-impersonation refund is agreed but not yet law.
