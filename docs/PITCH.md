# Ruko: pitch kit

Everything needed to submit Ruko to the Bolna × Y Combinator Symphony Buildathon (due 31 October 2026) and to pitch it.

| | |
|---|---|
| Pitch deck (PDF, 12 slides, 16:9) | [`deck/Ruko-pitch.pdf`](../deck/Ruko-pitch.pdf), built from [`deck/index.html`](../deck/index.html) |
| Live app | https://ruko-symphony.vercel.app (`/demo`, `/check`, `/console`) |
| Video scene file | [`deck/video/ruko-demo.yaml`](../deck/video/ruko-demo.yaml) (vidkit, Piper narration) |
| Sources | [CITATIONS.md](CITATIONS.md), [BUSINESS.md](BUSINESS.md), [`research/PRIOR_ART.md`](../research/PRIOR_ART.md), `eval/results/*/report.md` |

**Status, plainly.** No customers, no pilots. <!--r:live.note-->No live Bolna call has been measured yet; the demo video records the first one.<!--/r--> Results are text mode (<!--r:version-->v4<!--/r-->): an LLM plays the customer.

**Numbers in this file update themselves.** Values between `r:` comment markers are written by `node deck/tools/build.mjs` from [`deck/results.config.json`](../deck/results.config.json), the same run that fills the deck. When v5 lands on its fresh held-out set, edit the config (run ids, the three notes, `live_calls`), run the build, and the deck, this file and the video's results scene all change together. See [Updating the deck](#updating-the-deck).

## Submission form

| Field | Answer |
|---|---|
| Team size | 1 |
| Name | Yashvardhan Thanvi |
| Email | the address you registered with |
| Project description (max 200 characters) | Recommended pick below (189 characters) |
| Submission link | https://ruko-symphony.vercel.app. Add the GitHub repository too once it is public; this repo has no remote yet. |
| Pitch deck or video link | Upload `deck/Ruko-pitch.pdf` and the video to Google Drive, set sharing to "Anyone with the link can view", and paste the link. Open it in a private window first to check it works. |

## (a) Five 200-character descriptions

Counts are Python `len()` on the exact text, spaces and punctuation included.

| # | Description | Characters |
|---|---|---|
| 1 | Ruko holds a risky bank or UPI payment while a Bolna voice agent calls the customer in their language, names the scam and blocks the payment if needed. For Indian banks, UPI apps and NBFCs. | 189 |
| 2 | A 60-second voice check for risky payments: Ruko pauses the transfer, calls the customer in their language, names the scam, then releases, delays or blocks. Built on Bolna for Indian banks. | 189 |
| 3 | Scam victims pay while a fraudster coaches them on another call. Ruko holds the payment and a Bolna agent calls them in Hindi or English to break the script. For Indian banks and NBFCs. | 185 |
| 4 | For banks and UPI apps: when a payment looks coached, Ruko holds it and a Bolna voice agent calls the customer with a code word, names the scam and decides by policy. Never asks for an OTP. | 189 |
| 5 | Ruko stops payment scams before the money leaves: a Bolna voice agent calls the customer within seconds of a risky payment and breaks the scammer's script. For banks, UPI apps and NBFCs. | 186 |

**Recommended: #1.** It answers the form's two questions in order: what it does (holds the payment, calls in the customer's language, names the scam, blocks if needed) and who it is for (Indian banks, UPI apps and NBFCs). It names Bolna, which the judges are looking for, and makes no claim the results don't support. #2 is the runner-up if you want "60-second" in the first words.

## (b) Demo video: script and shot list

**Target 2:40, hard limit 3:00.** The spine is one real Bolna web call in the digital-arrest scenario. Everything around it is narrated by Piper through vidkit ([`deck/video/ruko-demo.yaml`](../deck/video/ruko-demo.yaml)), or by you reading the same lines.

Narration timing, measured with `render.py --tts-only` (Piper `en_US-lessac-high`, 170 words a minute): cold open 12.2 s, title 4.5 s, problem 15.5 s, hold 12.0 s, decide 13.0 s, results 14.6 s, ask 12.4 s, end 6.0 s. That is 90 s around the call, so **the call clip can run 70 to 85 seconds**. The browser scenes were rehearsed against production on 22 October with `--record-only --keep-going`: every action found its element.

### Recording the call (build agent)

- **Scenario:** /demo, "A 'CBI officer' on video call", ₹1,90,000 to "Safe Custody Account RBI". English is safest for judges; if you record in Hindi, burn English captions from the Bolna transcript (below).
- **Setup:** a headset, a wired or hotspot connection (add `?relay=1` if the network blocks UDP), the access code, the browser in the foreground. Record the screen *and* system audio (OBS or Xbox Game Bar), 1080p, 30 fps.
- **The person playing Kamla** gets a role brief, not lines: "You are 68. A 'CBI officer' has kept you on a video call for 47 minutes and told you to move your savings to a safe custody account for 'verification'. At first you say it's for verification. Answer honestly when asked directly whether someone is on another call. If asked, you agree to them calling your son Ravi." Then let the agent run. Do not re-take until the answer comes out "right": one honest take is the point.
- **Keep for the edit:** the code word said first, the "another call" question, Kamla admitting the officer, the truth line, the offer to call Ravi, and the engine panel turning to Blocked with "decided by policy, not by the LLM". If Ravi's call rings in the contact tab, a five-second cut-in of it is enough.
- **Log the spend** in `docs/BOLNA_SPEND.md` (wallet before and after), then set `live_calls.made` and `live_calls.note` in `deck/results.config.json` and rebuild.

### Shot list (live-call version)

| # | Time | Scene id | Picture | Sound | On screen |
|---|---|---|---|---|---|
| 1 | 0:00–0:12 | `cold` | /demo, CBI scenario selected; ring on the payee, then on "On a phone call · 47 min" | VO 1 | label "Sandbox bank · fictional customer" |
| 2 | 0:12–0:17 | `title` | Title card: Ruko, "Stop the scam before the money *leaves.*" | VO 2 | |
| 3 | 0:17–0:32 | `problem` | Section card, three bullets | VO 3 | sources in the bullets (MHA) |
| 4 | 0:32–0:44 | `hold` | Press Pay; risk card fills in; ring on the code word | VO 4 | |
| 5 | 0:44–1:58 | (call clip) | **The real Bolna web call**: phone and engine panel side by side, tool calls landing live | Call audio only, no VO, no music | lower third "Live Bolna web call · recorded [date] · customer played by a person"; English captions |
| 6 | 1:58–2:11 | `decide` | Console check: decision card, then the transcript with evidence highlighted | VO 5 | label "Eval replay · synthetic customer" |
| 7 | 2:11–2:26 | `results` | Section card with the results bullets | VO 6 | |
| 8 | 2:26–2:38 | `ask` | Section card: price, no customers yet, the ask | VO 7 | |
| 9 | 2:38–2:44 | `end` | End card: "Only a voice breaks a *voice.*", link, disclosures | VO 8 | synthetic voice and AI-assistance disclosure (automatic) |

### Narration (Piper-ready; the same text is in the scene file)

1. Kamla is sixty-eight. A man calling himself a CBI officer has kept her on a video call for forty-seven minutes. Now she is sending ₹1,90,000 to a safe custody account.
2. This is Ruko. It's Hindi for wait.
3. Indians reported ₹22,845 crore lost to cyber fraud in 2024. The victim makes the payment, often coached on another call, so OTPs and pop-up warnings don't help. Only a voice breaks a voice.
4. Her bank sends the payment to Ruko's API. It is held, with a plain reason for every point of risk, and her app shows a one-time code word. Then a Bolna voice agent calls her.
5. A deterministic policy decides from the recorded evidence. The agent can make the outcome stricter, never softer, and it never asks for an OTP. The fraud team sees every quote, signal and reason.
6. In text-mode tests, Ruko caught <!--r:dev.catch-->58/60<!--/r--> scams on the set we tuned on, and <!--r:ho.catch-->12/16<!--/r--> on a held-out set we froze before any run, with <!--r:ho.fh-->2/12<!--/r--> false holds on genuine payments. The held-out number is the one we are improving.
7. Banks pay ₹20 to ₹30 per completed check, and nothing when the payment passes. We have no customers or pilots yet. We are asking for introductions to Indian banks for shadow-mode pilots.
8. Ruko. Built on Bolna.

The scene file's `pronounce` table turns "₹1,90,000" into "one lakh ninety thousand rupees", "CBI" into "C B I" and so on; captions keep the written form. Line 6 is regenerated by the build script.

### Rendering and the splice

Run from the repo root. vidkit writes to its own `build/` folder; the videos go to `..\_videos`, outside git.

```bat
set PY=C:\Desktop\COLLEGE\Coding\Hackathon\_videos\toolkit\.venv\Scripts\python.exe
set R=C:\Desktop\COLLEGE\Coding\Hackathon\_videos\toolkit\render.py
set FF=C:\Users\yashv\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe

%PY% %R% deck\video\ruko-demo.yaml --only cold,title,problem,hold --output ..\_videos\ruko-part-a.mp4
%PY% %R% deck\video\ruko-demo.yaml --only decide,results,ask,end --output ..\_videos\ruko-part-b.mp4

rem Normalise the call recording to vidkit's format (1080p30, AAC 48 kHz, -16 LUFS).
%FF% -i ..\_videos\ruko-call-raw.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b111c,fps=30,format=yuv420p,setsar=1" -af "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000" -ac 2 -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k ..\_videos\ruko-call.mp4

rem Join: part A, the call, part B.
%FF% -i ..\_videos\ruko-part-a.mp4 -i ..\_videos\ruko-call.mp4 -i ..\_videos\ruko-part-b.mp4 -filter_complex "[0:v]setsar=1[v0];[1:v]setsar=1[v1];[2:v]setsar=1[v2];[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];[2:a]aresample=48000[a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k -movflags +faststart ..\_videos\ruko-demo.mp4
```

Trim the call first if it runs long: `-ss 00:00:03 -to 00:01:22` on the normalise step. Cut dead air only at the start and end; inside the call, mark any cut with a one-second "cut" title rather than hiding it, and never reorder answers.

**Captions for the call.** Fetch the execution transcript from Bolna (`GET /executions/{id}`, free), write it as `ruko-call.srt` with the call's timings, and add `,subtitles=ruko-call.srt:force_style='FontName=Inter,FontSize=22'` to the normalise step's `-vf`. For a Hindi call the captions are English translations; say so in the lower third.

### Fallbacks

| If | Then |
|---|---|
| **A. The live call fails or the audio is unusable** | Render the fallback cut in one pass: `--only cold,title,problem,hold,call-recorded,decide,results,ask,end`. Scene `call-recorded` plays the recorded run on /demo (a text-mode conversation replayed through the live engine) under the label "Recorded run: text mode, no audio", with its own narration. Rehearsed: it reaches Blocked in about 44 s. Change the end card's disclosure line, which mentions the live call. |
| **B. The call is good but drops before the decision** | Keep the clip up to the drop, then a one-second card "Call dropped; same scenario, recorded run", then the last 15 s of `call-recorded`. Do not present the recorded run's decision as the live call's. |
| **C. The call runs past 90 s** | Trim the greeting and the goodbye, not the middle. If it is still long, drop the `title` scene (4.5 s) and shorten narration 3 to its last sentence. |
| **D. The agent misbehaves on the call** (wrong pattern, odd phrasing, a decision you disagree with) | Use it anyway if the decision path is visible, and say in narration 5 what the policy did. An honest imperfect call is worth more than a polished replay. If it is unusable, use A. |
| **E. Piper is unavailable** | vidkit falls back to the Windows voice; or record the eight lines yourself (they are written to be read aloud) and drop the WAVs in with `--reuse-recording`. |

**Disclosures that must stay in the video:** fictional customer and bank; customer on the call played by a person; text-mode results; synthetic narration and AI assistance (vidkit's end card adds this automatically).

## (c) 90-second live pitch (finale)

About 240 words: 90 seconds at about 160 words a minute, a normal pitch pace. Rehearse with a timer. Slide changes in brackets.

> **[1]** Kamla is sixty-eight. For forty-seven minutes, a man calling himself a CBI officer has kept her on a video call. Now she's sending one lakh ninety thousand rupees to a "safe custody account", and she types the OTP herself.
>
> **[2]** In 2024, Indians reported ₹22,845 crore lost to cyber fraud. Losses to digital arrest and related scams grew five point seven times in a year.
>
> **[3]** The victim is authenticating. The scammer is giving the orders. Only a voice breaks a voice.
>
> **[4]** Ruko is a sixty-second voice check built on Bolna. The bank sends us the risky payment; we hold it, her app shows a code word, and a Bolna agent calls her in her language. It says the code word first, asks if anyone on another call is telling her what to do, says there's no digital arrest in Indian law, and with her yes, calls her son. A deterministic policy then decides. The model can make it stricter, never softer, and it never asks for an OTP.
>
> **[7]** In text-mode tests we caught <!--r:dev.catch-->58/60<!--/r--> scams on the set we tuned on, and <!--r:ho.catch-->12/16<!--/r--> on a held-out set frozen before any run. Closing that gap is the work.
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
We don't know yet, and that is the first thing a pilot measures. In text mode, false holds were <!--r:dev.fh-->1/24<!--/r--> on the development set and <!--r:ho.fh-->2/12<!--/r--> on the held-out set (95% CI <!--r:ho.fh_ci-->5–45%<!--/r-->): too high and too uncertain. <!--r:false_hold_note-->Both held-out false holds were Hindi: a tax payment made while on a call with an accountant, and a son guiding his mother to pay a hospital.<!--/r--> The eval's genuine payments are deliberately hard look-alikes, so these are not real-world rates, and no bank or regulator publishes hold rates; the UK's own evaluation says firms did not provide them. Mitigations: only payments the bank already flags get a call; calls last about a minute; answers that explain the payment release it; an unreachable customer gets a delay, never a block.

**6. "Scammers will coach victims around your questions."**
They already do, and it is our weakest case: heavily coached customers caught were <!--r:dev.heavy-->28/30<!--/r--> on the development set and <!--r:ho.heavy-->4/8<!--/r--> on the held-out set. Three things don't depend on what the victim says: the bank's own device signal ("your app shows you were on a call"), a remote-access app (a hard hold), and the payee flags. The policy cannot be talked down, and the trusted contact is a second human. To stop scammers faking Ruko itself: the code word is shown only in the bank's app, the agent never asks for an OTP or PIN and never moves money, and a mismatch means "hang up and open your app". New scripts come into the library from official advisories and, later, from pilot calls.

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
| Development set <!--r:dev.catch-->58/60<!--/r--> caught (CI <!--r:dev.catch_ci-->89–99%<!--/r-->), <!--r:dev.fh-->1/24<!--/r--> false holds; held-out <!--r:ho.catch-->12/16<!--/r--> (CI <!--r:ho.catch_ci-->51–90%<!--/r-->), <!--r:ho.fh-->2/12<!--/r--> | `eval/results/<!--r:dev.run-->v4-dev-qwen3-30b<!--/r-->`, `eval/results/<!--r:ho.run-->v4-holdout3-qwen3-30b<!--/r-->` |
| OTP and PIN: development <!--r:dev.otp-->1 of 408<!--/r--> agent turns flagged; held-out <!--r:ho.otp-->0 of 123<!--/r--> | same reports. The v4 development flag was a question about whether the customer had already shared an OTP with the caller, not a request for it. |
| Tool latency p50 <!--r:lat.p50-->74<!--/r--> ms, p95 <!--r:lat.p95-->303<!--/r--> ms | `eval/results/tool-latency.json` (local dev server, 100 calls) |

## Updating the deck

```bash
# 1. Fresh screenshots (production, read-only; no Bolna calls)
../_videos/toolkit/.venv/Scripts/python.exe -I deck/tools/capture.py https://ruko-symphony.vercel.app "$TEMP/ruko-deck-shots" demo,console_eval_check
python deck/tools/prep_images.py "$TEMP/ruko-deck-shots"   # crops and compresses into deck/assets/img/
# 2. Results: edit deck/results.config.json (run ids, notes, live_calls), then
node deck/tools/build.mjs                 # fills deck/index.html, this file and the video's results scene; prints the PDF
```

`build.mjs` stops if a marker names a value it doesn't know, so nothing is left stale. The deck's page 5 timings (+14.0 s and so on) describe the screenshots captured on 22 October; if you recapture, read the new times off `engine-outcome` and update that slide by hand. Open `deck/index.html` in a browser to view the deck at screen size.

## Issues found while building the pitch

For whoever owns each file; none of these is in the deck.

- **Hindi recorded run stalls on production.** /demo, CBI scenario, हिंदी, "रिकॉर्ड… रन देखें": the replay stops after the agent asks to call Ravi and never decides (still replaying at 175 s; check `chk_HWX775S85F`). The English run completes. Also, the Hindi agent line mixes in English ("Ravi, son को कॉल करवाऊँ").
- **`docs/MEMO.md` is stale.** It still has the TAM that CITATIONS.md found was 10 times too high (₹630–1,575 crore; correct is ₹63–158 crore), the v3 results table, and the "98.5% of ₹22,931 crore" wording that CITATIONS item 6 corrected. Judges reading the repo will see it.
- **Public checker wording.** MEMO.md and BUSINESS.md say the public line "collects new scripts". The checker in production is model-free and stores nothing the person types (anonymous counts only), so that claim should go or move to pilot data.
- **Console Evaluation page** still shows v3 (published 17 Oct): it reads `public/eval/results.json`. Re-run `eval/publish.ts` for the current version so the console matches the deck.
- **Console overview on production** counts sandbox runs from visitors among its checks (for example "Held back ₹35,85,398"). It is labelled "Demo tenant", but a judge could read it as traction; consider a "demo data" note on those tiles.
