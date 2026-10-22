# Ruko: research notes

Ruko holds a risky payment for about a minute while a Bolna voice agent asks the customer what a fraud team would ask. This document is the evidence behind that design. Status: 17 October 2026.

Labels: **Official** (government, regulator or NPCI), **Media** (news report of an official figure we could not open in the original), **Vendor** (a company's claim about itself), **Derived** (our arithmetic on cited figures), **Our reading** (our interpretation).

## 1. The problem in numbers

### Headline figures

| What | Figure | Source |
|---|---|---|
| Financial-fraud complaints on NCRP, 2024 | 19,18,865 complaints; ₹22,845.73 crore reported | Official: [MHA, Lok Sabha USQ 344, 22 Jul 2025](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf) |
| Same, 2023 | 13,10,354 complaints; ₹7,465.18 crore | Same answer |
| Same, 2025 | about 28 lakh frauds; ₹22,931 crore | Official: [RBI Discussion Paper, 9 Apr 2026](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810) |
| "Digital arrest" scams, 2024 | 1,23,672 incidents; ₹1,935.51 crore | Official: [MHA, Rajya Sabha USQ 1505, 12 Mar 2025](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf) |
| Digital arrest, earlier years | 2022: 39,925 / ₹91.14 crore. 2023: 60,676 / ₹339.03 crore. 2025 to 28 Feb: 17,718 / ₹210.21 crore | Same answer |
| Where the money goes | Payments above ₹10,000 are 45% of fraud cases but 98.5% of fraud value; about 92% of value is in payments above ₹50,000 | Official: [RBI Discussion Paper](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810) |
| 2021 to 2025, cumulative | 65,89,201 complaints; over ₹55,050 crore reported; over ₹8,189 crore marked as lien | Official: [MHA, Lok Sabha USQ 251, 21 Jul 2026](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2026-pdfs/LS21072026/251.pdf) |
| Recovered through the 1930 system | Over ₹11,158 crore saved across 32.80 lakh complaints, to 30 Jun 2026 | Same answer |
| Senior citizens, 2025 | 1,03,488 complaints; ₹4,005.12 crore | Media: [The CSR Journal](https://thecsrjournal.in/over-1-lakh-senior-citizens-4-63-lakh-women-reported-financial-cyber-fraud-complaints-2025/), reporting a Rajya Sabha written reply of 5 Aug 2026 |
| UPI scale, September 2026 | 24,068.38 million transactions; ₹29,37,396.67 crore; 756 banks live | Official: [NPCI product statistics](https://www.npci.org.in/product/upi/product-statistics) |

### What the numbers mean (derived)

- **Digital arrest is a high-loss scam.** In 2024 the average was about ₹1.57 lakh per incident (₹1,935.51 crore ÷ 1,23,672). The average across all financial-fraud complaints was about ₹1.19 lakh (₹22,845.73 crore ÷ 19,18,865).
- **It grew fast.** Digital-arrest value rose about 5.7 times from 2023 to 2024, while incidents roughly doubled.
- **Older people lose more per complaint.** Senior citizens averaged about ₹3.87 lakh per complaint in 2025. That uses media-reported inputs, so treat it as indicative.
- **Volume.** 2024 works out to about 5,240 financial-fraud complaints a day.
- **A small slice of payments carries the risk.** The average UPI payment in September 2026 was about ₹1,220. A check aimed at large payments to new payees therefore covers almost all fraud value while touching a small share of payments. We have not found a published split of UPI volume by ticket size, so we cannot say how small that share is.

### Citizen reports to Chakshu

Chakshu reports are suspected fraud calls and messages that citizens flag. They are not confirmed frauds or losses. Their category trends show which scripts are spreading ([PIB, 5 Feb 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223779), Official):

| Chakshu category | 2024 | 2025 |
|---|---|---|
| KYC or payment-related | 21,281 | 1,06,483 |
| Job, lottery, gift or loan offers | 23,634 | 58,560 |
| Sextortion | 10,901 | 21,189 |
| Impersonating a relative | 258 | 19,564 |
| Impersonating DoT or TRAI | 217 | 15,595 |

Reports of relatives being impersonated rose about 76 times in a year. Ruko has a pattern for each of these categories.

### Where sources conflict, and what we chose

| Item | Values seen | We use | Why |
|---|---|---|---|
| 2024 total | ₹22,845.73 crore (MHA) vs ₹22,848 crore (RBI paper) | ₹22,845.73 crore | Exact figure from a parliamentary answer. The gap is 0.01%. |
| 2025 total | ₹22,931 crore (RBI) vs ₹22,495 crore ([ThePrint](https://theprint.in/india/cybercrime-saw-24-spike-in-2025-indians-lost-rs-22495-crore-mainly-in-investment-scams/2859930/), Media) | Not used as a headline (disputed); the headline everywhere is the 2024 MHA figure | Official, and the same paper gives the value split by ticket size. ThePrint's breakdown (investment scams more than 75% of value) is used only as context. |
| Digital arrest, 2025 | 58,239, 58,249 and 17,264 complaints in different secondary reports of I4C's status report to the Supreme Court | None | We cite the official 2024 figure and the official count to 28 Feb 2025 only. |
| Chakshu reporting window | 7 days vs 30 days in different descriptions | Not used | It does not affect any number we rely on. |

Two caveats apply to all of these:

- **"Reported" means reported, not lost.** NCRP gives the amount victims reported. Some of it is frozen or recovered: the lien and "saved" lines above.
- **Bank fraud statistics undercount this.** An RBI table note says the July 2024 fraud directions changed what banks report. Our reading is that customer-authorised scams largely drop out, so falling bank-reported fraud is partly an artefact ([RBI Trend and Progress, Table IV.13, note 7](https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=23639)). NCRP is the better measure of authorised push-payment (APP) scams.

## 2. How coached scams work, and why OTPs and pop-ups fail

### How the scam runs

I4C's advisory describes how a digital arrest unfolds ([TAU/ADV/003, 6 Mar 2025](https://i4c.mha.gov.in/theme/resources/advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf), Official):

1. **Spoofed contact.** A spoofed call from someone posing as police, CBI, narcotics, RBI, the telecom department or ED; a courier parcel is often the accusation.
2. **Intimidation.** The victim is told they are linked to a crime.
3. **Digital confinement.** The victim is forced to stay on a video call until the demands are met.
4. **Money demand.** Criminals demand money to "settle the issue". TRAI's advisory also mentions transfers under the pretext of "bail, fines, or verification" ([PIB 2153153](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2153153)).

The MHA describes cross-border syndicates running the same scripts for courier, digital-arrest and relative-in-custody scams ([PIB, 14 May 2024](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2020570), Official).

### Why OTPs and pop-ups don't stop it

The defining feature is that **the customer makes the payment themselves**. Their OTP, UPI PIN, device binding and biometrics all work correctly. Those controls prove who is paying. They do not show who is telling them to pay.

- **Scammers coach victims live.** BioCatch's 2026 India report found fraudsters increasingly relied on live phone calls to guide victims through transactions. The same report found fraud-related calls got 31% shorter and the median attempted transfer per session rose 1.7 times ([Business Today, 28 Jul 2026](https://www.businesstoday.in/industry/banks/story/what-a-new-report-says-about-indias-digital-banking-frauds-545803-2026-07-28), Vendor via Media). BioCatch now sells "an active phone call during an online banking session" as a risk signal ([BioCatch, Scams360](https://www.biocatch.com/press-release/biocatch-delivers-scams360), Vendor).
- **Phone-led scams cost more in the UK too.** APP cases enabled by telecommunications are 17% of cases but 28% of losses (based on a subset of APP case data) ([UK Finance Annual Fraud Report 2026](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf), industry data).
- **The regulator has named this case.** The RBI's 2026 customer-liability directions treat a transaction the customer approved under coercion as fraudulent ([RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0), Official). The RBI's April 2026 paper proposes an answer from outside the coached channel: a one-hour delay on APP payments above ₹10,000, or a "trusted person" who must also approve payments above ₹50,000 ([RBI Discussion Paper](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810), Official).

**Our reading.** SMS warnings and pop-ups arrive on the same phone while the scammer is talking, and the scammer can say "you'll see a warning, just tap continue". Static text cannot react to a cover story. A live question can. "Is anyone on another call telling you what to do?" is hard to answer smoothly. "Your app shows you were on a call while paying" is harder still, because it turns the bank's own device signal against the cover story.

Banks already use conversation as a control. Westpac's real-time AI assists staff on customer calls and, the bank says, can tell when a customer is being coached ([Westpac, 29 May 2025](https://www.westpac.com.au/about-westpac/media/media-releases/2025/29-may/), Vendor). Barclays asks three questions on flagged payments ([Which?](https://www.which.co.uk/news/article/barclays-to-intervene-in-suspected-fraud-transfers-aHl4O2w3YhEf), Media). The bottleneck in India is reaching the customer within seconds, at UPI scale, in their language, at any hour. A voice agent can fill that gap.

### Why the call needs a code word

Scammers impersonate banks, so "this is your bank" proves nothing. Ruko shows a one-time code word (for example "DIYA 42") on the app's hold screen, and the agent says it first, so a scammer calling separately cannot fake the call. Numbering helps too: the RBI has told banks to use the 1600xx series for service and transaction calls ([RBI/2024-25/105](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12770&Mode=0), Official), and TRAI says those numbers must not be tagged as spam ([TRAI PR 119/2026, 18 Sep 2026](https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf), Official).

## 3. The official advice and "truth lines" Ruko uses

When the agent records a warning sign, the engine returns one short "truth" sentence for the matching pattern and the agent says it as written, so it never improvises official advice (`shared/patterns.ts`, `shared/sources.ts`).

| Pattern | Ruko says (English, shortened) | Official basis |
|---|---|---|
| Digital arrest | There's no 'digital arrest' in Indian law. Police or CBI never question anyone on a video call. | I4C: "There is no concept of Digital Arrest under any Indian Laws." ([TAU/ADV/003](https://i4c.mha.gov.in/theme/resources/advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf)). Agencies don't arrest people on video calls ([I4C via PTI](https://www.tribuneindia.com/news/india/cbi-ed-police-dont-arrest-people-through-video-calls-indian-cyber-crime-coordination-centre/amp)); also [RBI Kehta Hai](https://rbikehtahai.rbi.org.in/rbi-digital-arrest.html). |
| Courier or parcel | Paying on a call to close a parcel 'case' is a scam the government warns about. | MHA alert: "A demand for money is made to compromise the 'case'" ([PIB 2020570](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2020570)). |
| Fake KYC or account block | Threats to block your account on a call are a scam tactic, and your bank never asks for your OTP or PIN. | RBI on account-block threats ([2024](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244)); share PINs and OTPs "not even with bank officials" ([2022](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=53185)). |
| Investment or trading app | Guaranteed share-market returns are a scam. A fee to unlock your withdrawal is a classic sign. | SEBI: "There is no provision for an 'Institutional Account' in trading" ([PR 4/2024](https://www.sebi.gov.in/media-and-notifications/press-releases/feb-2024/sebi-issues-advisory-against-fraudulent-trading-schemes-claiming-to-be-offered-to-indian-residents-by-fpis_81733.html)). Guaranteed returns are a scam ([SEBI sheet](https://investor.sebi.gov.in/pdf/Fake%20trading%20app%20scam%20Landscape.pdf)). |
| Part-time job or task | A genuine company offering a job will never ask you for money. | RBI BE(A)WARE: a genuine company offering a job "will never ask for money" ([RBI, 2022](https://rbidocs.rbi.org.in/rdocs/content/pdfs/BEAWARE07032022.pdf)). [MHA on task fraud](https://pib.gov.in/PressReleaseIframePage.aspx?PRID=1982936). |
| Fake customer care or refund | You never need a UPI PIN to receive money. | NPCI: "UPI PIN is NOT required for receiving money" ([NPCI](https://www.npci.org.in/safety-feature)). The PIN is for sending only ([DoT](https://sancharsaathi.gov.in/SancharSaathiDocuments/KeepYourselfAwareDocuments/UPIFraudAlert.pdf)); [I4C on fake helplines](https://i4c.mha.gov.in/theme/resources/advisories/CybercriminalsusingFakeCustomerCareNumberstodefraudcitizens.pdf). |
| Screen-sharing takeover | Never install a screen-sharing app for someone who calls you. | CERT-In: never install remote-access software for anyone (CIAD-2024-0050); BE(A)WARE covers screen-sharing fraud. |
| Electricity disconnection | Don't call the number in that message. Pay only on your electricity company's official app or site. | [I4C on fake bill SMS](https://i4c.mha.gov.in/theme/resources/advisories/FakeSMSsrelatedtounpaidElectricityBilltodupecitizens.pdf). No official line says discoms never SMS, so Ruko gives advice, not a claimed fact. |
| Relative in trouble | Hang up and call your relative on their usual number to check where they are. | CERT-In: "Verify requests for urgent money transfers by calling directly your relatives/friends." ([CIAD-2026-0020](https://www.cert-in.org.in/s2cMainServlet?VLCODE=CIAD-2026-0020&pageid=PUBVLNOTES02)) |
| Prize or lottery | You can't win a lottery you never entered, and real prizes never ask for fees. | RBI: "Nobody from RBI calls up people about lottery winnings" ([RBI](https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=44392)). [I4C on KBC fraud](https://i4c.mha.gov.in/theme/resources/advisories/CybercrimeInformation-132.pdf). |
| SIM disconnection | The telecom department never calls to threaten disconnection, and no regulator collects payments over a call. | DoT: "The DoT does not make calls to citizens threatening disconnection." ([PIB 1976274](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1976274)). No regulator collects payments by call or video ([TRAI](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2153153)). |
| Video-call blackmail | Don't pay. Stop replying, keep the evidence and report it on 1930 or cybercrime.gov.in. | Ruko's own phrasing of CERT-In's advice to keep evidence and report ([Mahila Suraksha](https://www.cert-in.org.in/PDF/Mahila_Suraksha_Booklet25.pdf)); [MHA release listing sextortion among major cybercrime methods of 2023 (3 Jan 2024)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1992949). |

### Official Hindi wording

- **Mann Ki Baat 115 (27 Oct 2024):** "digital arrest जैसी कोई व्यवस्था कानून में नहीं है, ये सिर्फ fraud है" ([Hindi](https://www.pmindia.gov.in/hi/news_updates/%E0%A4%AE%E0%A4%A8-%E0%A4%95%E0%A5%80-%E0%A4%AC%E0%A4%BE%E0%A4%A4-%E0%A4%95%E0%A5%80-115%E0%A4%B5%E0%A5%80%E0%A4%82-%E0%A4%95%E0%A4%A1%E0%A4%BC%E0%A5%80-%E0%A4%AE%E0%A5%87%E0%A4%82-%E0%A4%AA-2/), [English](https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-115th-episode-of-mann-ki-baat/)). Ruko's Hindi digital-arrest line follows it.
- **RBI Kehta Hai:** "डिजिटल अरेस्ट जैसी कोई चीज़ नहीं होती" ([RBI Hindi page](https://rbikehtahai.rbi.org.in/hindi/rbi-digital-arrest.html)).
- **The PM's Mann Ki Baat mantra** "रुको, सोचो और एक्शन लो", as quoted in an MHA release ([PIB 2068700](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2068700)). Ruko is named after it.

Hindi releases also exist for the DoT ([PIB 1976315](https://pib.gov.in/PressReleasePage.aspx?PRID=1976315)) and TRAI ([PIB 2153234](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2153234)) advisories. Ruko's other Hindi lines are our translations. Tamil, Bengali and Marathi lines exist for four patterns, labelled as drafts awaiting native-speaker review.

Every blocked or delayed call points to **1930** (formerly 155260, [RS USQ 3908](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2022-pdfs/RS06042022/3908.pdf)) and [cybercrime.gov.in](https://cybercrime.gov.in/) for money lost, and to [Chakshu](https://sancharsaathi.gov.in/sfc/) for suspicious calls and messages.

## 4. Bolna platform research

### What Ruko uses, and why

| Bolna feature | How Ruko uses it | Docs |
|---|---|---|
| Flat-rate "preferred models": $0.06/min (₹5.52/min) covers speech-to-text, LLM and text-to-speech. Telephony and a platform fee are extra. | The agents use only bundled models (gpt-4.1-mini; nova-3 and saaras:v3 for speech recognition; eleven_turbo_v2_5 and bulbul:v3 for voices), so cost per call is predictable. | [preferred-models](https://www.bolna.ai/docs/pricing/preferred-models), [call-pricing](https://www.bolna.ai/docs/pricing/call-pricing) |
| Custom functions (tool calls to our API during the call) | `get_check_context`, `record_signal`, `call_trusted_contact`, `check_trusted_contact` and `set_decision`. Signals are recorded while the call is still live, so the decision is ready when it ends. | [custom-function-calls](https://www.bolna.ai/docs/tool-calling/custom-function-calls) |
| Multilingual agents with mid-call switching | Each language has its own prompt, speech recognition and voice. A customer can move from English to Hindi or Hinglish mid-call. | [multilingual-config-reference](https://www.bolna.ai/docs/customizations/multilingual-config-reference) |
| Web Call SDK `@bolna/web-call` v3 | The demo runs calls in the browser. Our server mints a single-use session that expires in about 120 seconds, so the API key never reaches the browser and the demo has no telephony cost. | [web-call](https://www.bolna.ai/docs/developer-resources/sdks/web-call) |
| Webhooks from fixed IPs (13.203.39.153, 13.126.9.249, 13.202.133.53) | Optional IP allowlist, plus a secret URL token. For final statuses Ruko re-reads the execution from Bolna's API, so a forged body cannot change a decision. | [webhooks](https://www.bolna.ai/docs/post-call/polling-call-status-webhooks) |
| Transfer to a human (phone number or SIP) | Not built yet. Designed for a bank's fraud desk, which matters for the UK (see BUSINESS.md). | [transfer-calls](https://www.bolna.ai/docs/tool-calling/transfer-calls) |
| Batch calling from CSV; Extractions | Not built yet. Planned for next-day follow-ups on delayed payments, and for a post-call structured record that can be checked against the live signals. | [batches](https://www.bolna.ai/docs/api-reference/batches/create), [extractions](https://www.bolna.ai/docs/migrating-to-extractions/overview) |

### Gotchas we hit, and how Ruko handles them

1. **The webhook fires several times per call**, once per status change ([webhooks](https://www.bolna.ai/docs/post-call/polling-call-status-webhooks)). `call-disconnected` arrives before `completed`, while duration, cost and transcript are still empty ([AGENTS.md](https://www.bolna.ai/docs/agents-md)). Ruko de-duplicates by execution and status and waits for `completed` (or another terminal status) before reading the transcript.
2. **Tool parameters are `%(name)s` templates.** Bolna fills the request body by Python-style substitution ([custom-function-schema](https://www.bolna.ai/docs/tool-calling/custom-function-schema)), so an optional parameter the LLM leaves out can break the call. Every Ruko tool parameter is required; fields that may not apply take an explicit value such as `pattern_hint: "none"`.
3. **The welcome message is one string** ([agent-tab](https://www.bolna.ai/docs/agent-setup/agent-tab)), but the greeting must be in the customer's language and carry their code word. The welcome message is just `{greeting}`, filled per call from `user_data`. We also pass `agent_language`, which Bolna's September 2026 release uses to start the call in that language ([changelog](https://www.bolna.ai/docs/changelog/september-2026)).
4. **Content-safety checks restrict "scam or fraud-related behavior"**, and a flagged agent is marked restricted ([FAQ](https://www.bolna.ai/docs/frequently-asked-questions)). An anti-scam agent must talk about scams, so the prompts say what the agent is: a bank's payment safety check protecting its own customer. They never ask for secrets, move money or pressure anyone. Scam scripts stay out of the prompts, and truth lines arrive through tool responses. All three agents saved unrestricted.
5. **Trial limits.** Trial accounts get two concurrent calls, to verified numbers only; paid accounts start at 10 and scale with usage ([concurrency](https://www.bolna.ai/docs/pricing/outbound-calling-concurrency)). The demo therefore uses web calls. A bank would need burst concurrency agreed with Bolna (see BUSINESS.md).
6. **Budget.** The hackathon account holds $5.00 in total. Every paid call passes a gate (access code, daily and per-visitor caps, and a wallet floor read from the free `GET /user/me`); see `server/engine/gate.ts` and `docs/BOLNA_SPEND.md`. The eval never uses Bolna.

Smaller ones: `toolchain.pipelines` is an array of arrays, and `POST /v2/agent` returns 201 ([AGENTS.md](https://www.bolna.ai/docs/agents-md)).

## 5. Competitive landscape

| Who | What it does | Holds the payment? | Talks to the customer by voice? | Trusted contact? | Sold to other banks? |
|---|---|---|---|---|---|
| Starling Scam Intelligence v2 (UK, Jun 2026) | In-app assistant asks targeted questions before a payment; opt-in, voice or text; the customer decides. [The Paypers](https://thepaypers.com/fraud-and-fincrime/news/starling-bank-adds-ai-agent-to-detect-romance-and-investment-fraud) | No, it advises | Yes, in-app and opt-in | No | No |
| Westpac SaferPay (AU, 2024) | In-app questions on high-risk payments; likely scams are not processed. [Westpac](https://www.westpac.com.au/about-westpac/media/media-releases/2024/26-March/) | Yes | No | No | No |
| Westpac AI call assistant (AU, 2025) | Assists staff on inbound calls; flags coaching. [Westpac](https://www.westpac.com.au/news/making-news/2025/05/westpac-deploys-real-time-AI-to-take-on-scammers/) | n/a | Human staff | No | No |
| Revolut, Barclays (UK) | In-app questionnaires on flagged payments. [UKTN](https://www.uktech.news/fintech/revolut-ai-scam-detection-20240215) | Yes | No | No | No |
| Monzo, Nationwide, CommBank call checkers | Show whether a call is really from the bank. [Nationwide](https://www.nationwide.co.uk/media/news/nationwide-launches-new-call-checker-as-brits-lose-confidence-due-to-scam-calls) | No | No | No | No |
| PhonePe Protect (India, Nov 2025) | Checks the payee against DoT's Financial Fraud Risk Indicator (FRI); declines very high risk, warns on medium. [PhonePe](https://www.phonepe.com/press/phonepe-rolls-out-phonepe-protect-to-safeguard-users-from-fraudulent-transactions/) | Declines | No | No | No |
| Google (India) | GPay warnings, Pixel scam detection, in-call screen-sharing protection piloted with financial apps in India. [Google](https://blog.google/security/android-expands-pilot-in-call-scam-protection-financial-apps/) | Warns | No | No | Platform feature |
| Truecaller (India) | Caller ID and call screening (the Assistant). [GSMArena](https://www.gsmarena.com/truecaller_assistant_india_launch_price_details-news-59245.php) | No | Screens incoming calls | No | Consumer app |
| Risk signals: DoT FRI, RBIH MuleHunter.AI (26 banks), NPCI FRM, BioCatch, Clari5, Bureau, Signzy, FICO, Feedzai | Scores for payees, devices, behaviour. [MuleHunter](https://taxguru.in/rbi/ai-tool-launched-to-detect-mule-accounts-used-in-cyber-fraud.html), [FRI adopters](https://www.outlookbusiness.com/news/rbi-advises-banks-to-integrate-dots-financial-fraud-technology) | The bank decides | No | No | Yes |
| Convin (India) | Outbound calls on fraud triggers plus a freeze, in English, Hindi, Hinglish (vendor claims). [Convin](https://convin.ai/blog/fraud-call-prevent-bfsi) | Claims freeze | Yes | Not stated | Yes |
| Lorikeet | Outbound fraud-alert workflows for fintechs. [Lorikeet](https://www.lorikeetcx.ai/articles/proactive-fraud-notification-ai-fintech) | Not stated | Yes | No | Yes |
| Apate.ai with CBA (AU) | AI agents talk to scammers for intelligence, not to customers. [TechCrunch](https://techcrunch.com/2026/10/14/apate-sends-ai-agents-undercover-to-get-scammed-so-they-can-gather-fraud-intelligence) | No | To scammers | No | Yes |

**What we found no one selling (as of Oct 2026):** an API for Indian banks and payment apps that combines a payment hold, an outbound voice call within seconds in the customer's language, an anti-spoof code word, questions aimed at coached customers using the bank's own device signals, a consented trusted-contact call, and a deterministic, explained release, delay or block decision. Convin is the closest by description, and we could not verify its claims. UK banks such as Starling are building parts of this in their own apps, for their own customers.

**How Ruko fits (our reading).** Ruko is the step that acts after a risk score, not a replacement for one. It takes signals the bank already has (an active call from BioCatch-style device data, payee risk from FRI or MuleHunter, new-payee and amount rules) and turns them into a conversation and a decision a person can read.

## 6. Sources

**Government and regulators (India)**

- MHA: [RS USQ 1505](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf); [LS USQ 344](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf); [LS USQ 251](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2026-pdfs/LS21072026/251.pdf); [RS USQ 3908](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2022-pdfs/RS06042022/3908.pdf)
- MHA and PIB releases: [alert, 14 May 2024](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2020570); [task fraud](https://pib.gov.in/PressReleaseIframePage.aspx?PRID=1982936); [2023 cybercrime methods, incl. sextortion](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1992949); [slogan](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2068700); [Chakshu data](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223779)
- I4C: [digital arrest](https://i4c.mha.gov.in/theme/resources/advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf); [fake customer care](https://i4c.mha.gov.in/theme/resources/advisories/CybercriminalsusingFakeCustomerCareNumberstodefraudcitizens.pdf); [electricity SMS](https://i4c.mha.gov.in/theme/resources/advisories/FakeSMSsrelatedtounpaidElectricityBilltodupecitizens.pdf); [KBC lottery](https://i4c.mha.gov.in/theme/resources/advisories/CybercrimeInformation-132.pdf); [NCRP](https://cybercrime.gov.in/)
- PMO: [Mann Ki Baat 115](https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-115th-episode-of-mann-ki-baat/)
- RBI:
  - [Discussion Paper, Apr 2026](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810)
  - [Liability directions RBI/2026-27/167](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0)
  - [Trend and Progress](https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=23639)
  - Cautions: [KYC](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244); [PIN and OTP](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=53185); [lottery](https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=44392)
  - [BE(A)WARE](https://rbidocs.rbi.org.in/rdocs/content/pdfs/BEAWARE07032022.pdf); [RBI Kehta Hai](https://rbikehtahai.rbi.org.in/rbi-digital-arrest.html); [1600xx circular](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12770&Mode=0)
- CERT-In: [CIAD-2024-0050](https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=CIAD-2024-0050); [CIAD-2026-0020](https://www.cert-in.org.in/s2cMainServlet?VLCODE=CIAD-2026-0020&pageid=PUBVLNOTES02); [Mahila Suraksha](https://www.cert-in.org.in/PDF/Mahila_Suraksha_Booklet25.pdf)
- DoT and TRAI: [SIM disconnection](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1976274); [international calls](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087644); [UPI alert](https://sancharsaathi.gov.in/SancharSaathiDocuments/KeepYourselfAwareDocuments/UPIFraudAlert.pdf); [TRAI caution](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2153153); [TRAI PR 119/2026](https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf)
- SEBI: [PR 4/2024](https://www.sebi.gov.in/media-and-notifications/press-releases/feb-2024/sebi-issues-advisory-against-fraudulent-trading-schemes-claiming-to-be-offered-to-indian-residents-by-fpis_81733.html); [fake trading apps](https://investor.sebi.gov.in/pdf/Fake%20trading%20app%20scam%20Landscape.pdf)
- NPCI: [UPI statistics](https://www.npci.org.in/product/upi/product-statistics); [safety](https://www.npci.org.in/safety-feature)

**Industry, media and vendors**

- [UK Finance 2026](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf)
- [Business Today on BioCatch](https://www.businesstoday.in/industry/banks/story/what-a-new-report-says-about-indias-digital-banking-frauds-545803-2026-07-28)
- [ThePrint](https://theprint.in/india/cybercrime-saw-24-spike-in-2025-indians-lost-rs-22495-crore-mainly-in-investment-scams/2859930/)
- [The CSR Journal](https://thecsrjournal.in/over-1-lakh-senior-citizens-4-63-lakh-women-reported-financial-cyber-fraud-complaints-2025/)
- [Tribune (PTI)](https://www.tribuneindia.com/news/india/cbi-ed-police-dont-arrest-people-through-video-calls-indian-cyber-crime-coordination-centre/amp)
- The competitor links in section 5

**Bolna (docs index [llms.txt](https://www.bolna.ai/docs/llms.txt), read Oct 2026)**

- [preferred models](https://www.bolna.ai/docs/pricing/preferred-models); [call pricing](https://www.bolna.ai/docs/pricing/call-pricing); [concurrency](https://www.bolna.ai/docs/pricing/outbound-calling-concurrency)
- [custom functions](https://www.bolna.ai/docs/tool-calling/custom-function-calls); [function schema](https://www.bolna.ai/docs/tool-calling/custom-function-schema); [transfer calls](https://www.bolna.ai/docs/tool-calling/transfer-calls)
- [multilingual](https://www.bolna.ai/docs/customizations/multilingual-config-reference); [web call SDK](https://www.bolna.ai/docs/developer-resources/sdks/web-call); [webhooks](https://www.bolna.ai/docs/post-call/polling-call-status-webhooks)
- [AGENTS.md](https://www.bolna.ai/docs/agents-md); [FAQ](https://www.bolna.ai/docs/frequently-asked-questions); [agent tab](https://www.bolna.ai/docs/agent-setup/agent-tab); [Sept 2026 changelog](https://www.bolna.ai/docs/changelog/september-2026)
