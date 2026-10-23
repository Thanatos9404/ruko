# Ruko: pitch kit

Everything needed to submit Ruko to the Bolna × Y Combinator Symphony Buildathon (due 31 October 2026) and to pitch it.

| | |
|---|---|
| Pitch deck (PDF, 12 slides, 16:9) | [`deck/Ruko-pitch.pdf`](../deck/Ruko-pitch.pdf), built from [`deck/index.html`](../deck/index.html) |
| Live app | https://ruko-symphony.vercel.app (`/demo`, `/check`, `/console`) |
| Form answers | [SUBMISSION.md](SUBMISSION.md) |
| Demo video shot list | [DEMO_SCRIPT.md](../DEMO_SCRIPT.md), with the scene file [`deck/video/ruko-demo.yaml`](../deck/video/ruko-demo.yaml) (vidkit, Piper narration) |
| Sources | [CITATIONS.md](CITATIONS.md), [BUSINESS.md](BUSINESS.md), [`research/PRIOR_ART.md`](../research/PRIOR_ART.md), `eval/results/*/report.md` |

**Status, plainly.** No customers, no pilots. <!--r:live.note-->No live Bolna call has been measured yet; the demo video records the first one.<!--/r--> Results are text mode (<!--r:version-->v5<!--/r-->): an LLM plays the customer.

**Numbers in this file update themselves.** Values between `r:` comment markers are written by `node deck/tools/build.mjs` from [`deck/results.config.json`](../deck/results.config.json), the same run that fills the deck. It now reads the published v5 results (`public/eval/results.json`). After a live call or a new version, edit the config (run ids, the notes, `live_calls`) and run the build: the deck, this file, SUBMISSION.md, DEMO_SCRIPT.md and the video's results scene change together. See [Updating the deck](#updating-the-deck).

## Submission form

The exact form answers are in [SUBMISSION.md](SUBMISSION.md): team size "Just me", the recommended description and two alternatives, the live URL, and placeholders for the GitHub and Google Drive links.

## (a) Five 200-character descriptions

Counts are Python `len()` on the exact text, spaces and punctuation included.

| # | Description | Characters |
|---|---|---|
| 1 | Ruko holds a risky bank or UPI payment while a Bolna voice agent calls the customer in their language, names the scam and blocks the payment if needed. For Indian banks, UPI apps and NBFCs. | 189 |
| 2 | A voice check for risky payments: Ruko pauses the transfer, calls the customer in their language, names the scam and decides in about a minute. Built on Bolna for Indian banks and UPI apps. | 189 |
| 3 | Scam victims pay while a fraudster coaches them on another call. Ruko holds the payment and a Bolna agent calls them in Hindi or English to break the script. For Indian banks and NBFCs. | 185 |
| 4 | For banks and UPI apps: when a payment looks coached, Ruko holds it and a Bolna voice agent calls the customer with a code word, names the scam and decides by policy. Never asks for an OTP. | 189 |
| 5 | Ruko stops payment scams before the money leaves: a Bolna voice agent calls the customer within seconds of a risky payment and breaks the scammer's script. For banks, UPI apps and NBFCs. | 186 |

**Recommended: #1.** It answers the form's two questions in order: what it does (holds the payment, calls in the customer's language, names the scam, blocks if needed) and who it is for (Indian banks, UPI apps and NBFCs). It names Bolna, which the judges are looking for, and makes no claim the results don't support. #2 is the runner-up if you want the speed ("about a minute") in the description. Ruko's calls take about 67–83 s in full, with the decision at about 51–59 s, so we say "about a minute", never "60 seconds".

## (b) Demo video: script and shot list

The full plan is in [DEMO_SCRIPT.md](../DEMO_SCRIPT.md): the shot list, the scripted customer's lines, the narration, the render and splice commands, and fallbacks A–E. In short:

- **Length:** target 2:45, between 2:30 and 3:00. Narration around the call is 90 s, measured with Piper; the call runs 70–85 s.
- **Spine:** one real Bolna web call in the digital-arrest scenario, in English. The customer is a **scripted computer voice** ("Kamla", eight short WAV lines from [`deck/video/customer-lines.ps1`](../deck/video/customer-lines.ps1)), and the agent's side is live. The code word changes every session, so the script never says it.
- **Around it:** a cold open on /demo, the title, the problem, the hold, then after the call the console's decision and transcript, the results, the price and the ask, and the end card. All are rendered by vidkit from [`deck/video/ruko-demo.yaml`](../deck/video/ruko-demo.yaml). The browser scenes were rehearsed against production.
- **If the call fails:** fallback A renders the same video with the narrated recorded run in place of the call.
- **Disclosures:** fictional customer and bank; the customer is a scripted computer voice; text-mode results; synthetic narration and AI assistance.

## (c) 90-second live pitch (finale)

About 240 words: 90 seconds at about 160 words a minute, a normal pitch pace. Rehearse with a timer. Slide changes in brackets.

> **[1]** Kamla is sixty-eight. For forty-seven minutes, a man calling himself a CBI officer has kept her on a video call. Now she's sending one lakh ninety thousand rupees to a "safe custody account", and she types the OTP herself.
>
> **[2]** In 2024, Indians reported ₹22,845 crore lost to cyber fraud. Losses to digital arrest and related scams grew five point seven times in a year.
>
> **[3]** The victim is authenticating. The scammer is giving the orders. Only a voice breaks a voice.
>
> **[4]** Ruko is a voice check, built on Bolna, that decides in about a minute. The bank sends us the risky payment; we hold it, her app shows a code word, and a Bolna agent calls her in her language. It says the code word first, asks if anyone on another call is telling her what to do, says there's no digital arrest in Indian law, and with her yes, calls her son. A deterministic policy then decides. The model can make it stricter, never softer, and it never asks for an OTP.
>
> **[7]** In text-mode tests we caught <!--r:dev.catch-->60/60<!--/r--> scams on the set we tuned on, and <!--r:ho.catch-->15/18<!--/r--> on a held-out set frozen before any run. Closing that gap is the work.
>
> **[8]** From January, RBI's directions treat ignoring a bank's clear warning as customer negligence.
>
> **[12]** Banks pay ₹20 to 30 per completed check, nothing when the payment passes. We have no customers yet. We're asking for introductions to two or three Indian banks for shadow-mode pilots.

**If a live demo is allowed on stage:** open https://ruko-symphony.vercel.app/demo, pick the CBI scenario, press Pay, then "Watch the recorded run" (free, about 45 s, no credit used). Use a live call only with a tested headset and network; the recorded run is the fallback button on the same screen.

## (d) The 10 hardest YC interview questions

Short answers first; the numbers behind them are in [BUSINESS.md](BUSINESS.md) and the eval reports.

**1. "Isn't the market tiny?"**
In India, yes, and we say so. 12.6 lakh frauds above ₹10,000 a year (derived from 28 lakh reported in 2025) × 20–50 checks per real scam (assumption) × ₹25 is ₹63–158 crore, about $6.6–16.6M a year. Add the UK core, Australia and Singapore and scam checks are ₹139–538 crore, about $15–57M. India is the wedge because it is the cheapest place to learn: UPI volume, 756 banks live on UPI, and rupee voice pricing. The money is in markets where banks pay for scam losses, where a check is worth about £7–18 of avoided reimbursement, and in adjacent checks on the same engine: loan disbursal, payee changes, account recovery. Those we have not sized.

**2. "Indian banks don't bear the loss. Why would one pay?"**
Right: a bank's own payout is small and capped (85% of losses up to ₹50,000, at most ₹25,000, once per customer, with the RBI bearing most of it). Banks buy for three other reasons. RBI's 2026 directions cover payments made under coercion and treat ignoring the bank's "specific, directed and clear warnings" as customer negligence; a recorded call that names the scam is designed to be such a warning, though whether one qualifies is for the bank's counsel and the RBI. RBI's April discussion paper floats a payment delay and a trusted person, and Ruko is a targeted version of both. And complaints, ombudsman cases and trust cost money. In the UK, the saving is direct.

**3. "Bank sales take 18 months. How do you survive that?"**
We start where decisions are fastest: co-operative banks, small finance banks and NBFCs, which have lean fraud teams and no round-the-clock multilingual call-back desk (our assessment, unproven). The first step is shadow mode: the bank's risk engine sends Ruko the payments it already flags, Ruko scores and calls nothing until the bank opts in, and the bank keeps deciding. That needs one API call and no change customers see, so it can start before full procurement. We also plan to sell through the technology providers that run many co-operative banks at once. Honestly, we do not know our cycle yet; we have no pilots.

**4. "What stops BioCatch, Feedzai or Bolna from building this?"**
Nothing stops them trying, and every single piece has prior art (Westpac SaferPay, Revolut, Monzo, BioCatch, Second Voice). Our edge is not the model. It is the conversation design for coached customers, a policy that cannot be talked down, a cited library of official truth lines in Indian languages (72 patterns, 223 sources), an eval with frozen held-out sets, and, over time, labelled outcomes from pilots. Risk vendors score sessions but don't talk to the customer, so they are partners: Ruko consumes their flags. The moat today is thin; speed and pilot data are how it gets thicker.

**5. "How many genuine customers will you annoy?"**
We don't know yet, and that is the first thing a pilot measures. In text mode, false holds were <!--r:dev.fh-->2/24<!--/r--> on the development set and <!--r:ho.fh-->2/10<!--/r--> on the held-out set (95% CI <!--r:ho.fh_ci-->6–51%<!--/r-->): too high and too uncertain. <!--r:false_hold_note-->Both held-out false holds were delays, not blocks, and both in Hindi: a daughter guiding her father’s hospital payment, and a farmer buying tractor parts at night. That is the trade-off v5 chose: when risk is critical, it delays rather than release on a cover story.<!--/r--> The eval's genuine payments are deliberately hard look-alikes, so these are not real-world rates, and no bank or regulator publishes hold rates; the UK's own evaluation says firms did not provide them. Mitigations: only payments the bank already flags get a call; calls last about a minute; answers that explain the payment release it; an unreachable customer gets a delay, never a block.

**6. "Scammers will coach victims around your questions."**
They already do, and it is our weakest case: heavily coached customers caught were <!--r:dev.heavy-->30/30<!--/r--> on the development set and <!--r:ho.heavy-->13/16<!--/r--> on the held-out set. Three things don't depend on what the victim says: the bank's own device signal ("your app shows you were on a call"), a remote-access app (a hard hold), and the payee flags. The policy cannot be talked down, and the trusted contact is a second human. To stop scammers faking Ruko itself: the code word is shown only in the bank's app, the agent never asks for an OTP or PIN and never moves money, and a mismatch means "hang up and open your app". New scripts come into the library from official advisories and, later, from pilot calls.

**7. "What about DPDP, recording consent and TRAI's rules on AI calls?"**
The bank is the data fiduciary and Ruko its processor under contract. The customer gets notice and gives consent at enrolment, and every call opens by saying it is an automated assistant and that the call is recorded. Transcripts are kept only as long as the bank sets; OTPs and PINs are never collected, and evidence quotes are scrubbed of digit runs. The trusted contact is a separate data principal with their own notice and consent, and is called only after a warning sign and the customer's yes. Under TRAI PR 119/2026, each bank pre-declares these automated calls and their caller IDs; calls come from the bank's 1600xx numbers through its own telephony, which Bolna supports. The DPDP Rules' notice and consent duties apply from 13 May 2027. This is our reading, not legal advice.

**8. "You're wholly dependent on Bolna."**
For voice, yes; for the decision, no. The engine, policy, tools and eval talk plain HTTP and are provider-neutral, so the product survives a provider change. The real Bolna risks are pricing, its content rules (it disallows "scam or fraud-related behaviour"; our agents are a bank's payment safety check and are saved unrestricted today) and concurrency (paid accounts start at 10 concurrent calls). We would negotiate enterprise concurrency and fall back to in-app confirmation and the bank's own desk. Bolna is also why this is cheap and multilingual: ₹5.52 a minute for its preferred models, before telephony and platform fees.

**9. "You're a solo student founder. Why will a bank trust you?"**
Today it wouldn't, and I don't pretend otherwise. What I can show is speed and rigour: I built Ruko end to end since 16 October, from the engine and Bolna agents to an eval that publishes its misses, and I shipped LLMSlim, an open-source Python library on PyPI, before that. What I lack is bank sales and fraud-operations experience. The plan is a co-founder or advisor from a bank fraud team, design partners before revenue, and YC's network for the first introductions.

**10. "What will be true in 30 days?"**
Five things, by 22 November: measured live Bolna calls in English and Hindi with consenting volunteers (time to decision, completion, false holds); a fresh frozen held-out set for every agent version, published next to the development set; conversations with co-operative banks, small finance banks and NBFCs, with two shadow-mode agreements as the goal; native-speaker review of the Tamil, Bengali and Marathi truth lines; and a DPDP pack for banks (processor terms, consent and retention defaults, the trusted contact's notice).

## Fact sheet

Every number on the slides, with where it comes from. "Derived" is our arithmetic on a cited figure; "assumption" is ours.

| Number | Source |
|---|---|
| ₹22,845 crore reported lost to cyber fraud in 2024; 19,18,865 complaints | MHA, Lok Sabha USQ 344, 22 Jul 2025 |
| "Digital arrest" and related scams: ₹339.03 cr (2023) to ₹1,935.51 cr (2024), 5.7×; 1,23,672 incidents in 2024 | MHA, Rajya Sabha USQ 1505, 12 Mar 2025 |
| About 98.5% of reported fraud value, about 45% of cases, in payments above ₹10,000 | NCRP data in the RBI discussion paper, 9 Apr 2026 (undated split) |
| Scammers increasingly stay on a live call to guide victims | Business Today on BioCatch's India report, 28 Jul 2026 |
| RBI directions: coercion; ignoring "specific, directed and clear warnings" is negligence; from 1 Jan 2027; 85% up to ₹25,000 once | RBI/2026-27/167, 24 Jun 2026 |
| One-hour delay above ₹10,000; trusted person above ₹50,000 (options for comment) | RBI discussion paper, 9 Apr 2026 |
| Automated calls pre-declared with caller IDs; 1600xx not flagged as spam | TRAI PR 119/2026, 18 Sep 2026 |
| UK reimbursement from 7 Oct 2024, 50:50, up to £85,000; delay to D+4 | PSR PS25/5; Payment Services (Amendment) Regulations 2024 |
| Australia: most SPF duties from 31 Mar 2027 | ASIC |
| Bolna ₹5.52 ($0.06) a minute for preferred models, before telephony and platform fees | Bolna pricing |
| India TAM ₹63–158 cr; SAM ₹19–47 cr; year-3 about ₹2 cr ARR | BUSINESS.md §2.1 (derived and assumptions) |
| UK core £2.8–13.8M; Australia A$4.4–21.8M; Singapore S$1.6–8.1M; core total ₹139–538 cr | BUSINESS.md §2.2–2.7 |
| Price ₹20–30; cost ₹7–14 pay-as-you-go, ₹4–9 enterprise; margin 45–70% and 65–85%; human call-back ₹28–48 | BUSINESS.md §3 (estimates and assumptions; Inc42 for rates) |
| £7–18 of reimbursement avoided per check | BUSINESS.md §2.2 (derived) |
| 72 patterns (54 India, 18 global), 223 sources | `data/patterns/library.json`, `data/patterns/sources.json` |
| Development set <!--r:dev.catch-->60/60<!--/r--> caught (CI <!--r:dev.catch_ci-->94–100%<!--/r-->), <!--r:dev.fh-->2/24<!--/r--> false holds; held-out <!--r:ho.catch-->15/18<!--/r--> (CI <!--r:ho.catch_ci-->61–94%<!--/r-->), <!--r:ho.fh-->2/10<!--/r--> | `eval/results/<!--r:dev.run-->v5-dev-qwen3-30b<!--/r-->`, `eval/results/<!--r:ho.run-->v5-holdout4-qwen3-30b<!--/r-->` |
| OTP and PIN: <!--r:otp.summary-->v5 asked for an OTP, PIN, card or account number 0 times in 959 agent turns across all 5 sets. Across every version: 1 judge flag in 3,487 turns, v4's question about whether a code had already been shared, since reworded<!--/r--> | `public/eval/results.json` (`totals_current`, `totals`) |
| Held-out sets seen in earlier tuning (<!--r:seen.count-->3<!--/r-->): <!--r:seen.catch-->43/48<!--/r--> caught, <!--r:seen.fh-->4/36<!--/r--> false holds | `public/eval/results.json` |
| Median decision about a minute (<!--r:ho.median_s-->58<!--/r--> s fresh set, <!--r:dev.median_s-->59<!--/r--> s dev), estimated from transcript length | same |
| Tool latency p50 <!--r:lat.p50-->74<!--/r--> ms, p95 <!--r:lat.p95-->303<!--/r--> ms | `eval/results/tool-latency.json` (local dev server, 100 calls) |

## Updating the deck

```bash
# 1. Fresh screenshots (production, read-only; no Bolna calls)
../_videos/toolkit/.venv/Scripts/python.exe -I deck/tools/capture.py https://ruko-symphony.vercel.app "$TEMP/ruko-deck-shots" demo,console_eval_check
python deck/tools/prep_images.py "$TEMP/ruko-deck-shots"   # crops and compresses into deck/assets/img/
# 2. Results: edit deck/results.config.json (run ids, notes, live_calls), then
node deck/tools/build.mjs                 # fills the deck, this file, SUBMISSION.md, DEMO_SCRIPT.md and the video's results scene; prints the PDF
```

`build.mjs` stops if a marker names a value it doesn't know, so nothing is left stale. The deck's page 5 timings (+10.6 s to +32.1 s) describe the recorded run captured on 23 October (agent v5), and the slide says so. If you recapture, read the new times off `engine-outcome` and update that slide by hand. Open `deck/index.html` in a browser to view the deck at screen size.

## Issues found while building the pitch

These are for whoever owns each file; none of them is in the deck.

- **"Can't be spoofed".** README.md (line 16) and docs/MEMO.md (line 11) still say the code word means the call "can't be spoofed". The deck and these docs now say "hard to spoof". A screen-sharing scammer could read the code word, which is why a remote-access app is a hard hold.
- **"The public line collects new scripts".** docs/MEMO.md (risks) and docs/BUSINESS.md (§7, scammer adaptation) say this. The production checker is model-free and stores nothing the person types (anonymous counts only), so the claim should go or move to pilot data.
- **README links `SUBMISSION.md` at the repo root.** The file is `docs/SUBMISSION.md`.
- **Console overview on production** counts visitors' sandbox runs among its checks (for example "Held back ₹35,85,398"). The tiles are labelled "Demo tenant", but a judge could still read them as traction. Consider a "demo data" note on those tiles.
- **Fixed since 22 October:** the Hindi recorded run now reaches a decision on production; MEMO.md's TAM and results are corrected; the console's Evaluation page reads v5.
