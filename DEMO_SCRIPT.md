# Ruko demo video: what it shows, scene by scene

**Live:** https://ruko-symphony.vercel.app · **Code:** https://github.com/Thanatos9404/ruko · **Demo video (2:49):** https://drive.google.com/file/d/1f2OE-d3mbBMDU0lZkZFAH0jkTYVZXan4/view?usp=sharing · **Deck (PDF):** https://drive.google.com/file/d/1ZaWkebC4p3mi0jBwqFbbyIPVRdyTgppH/view?usp=sharing

This describes the submitted video **as rendered**: `ruko-demo.mp4`, 2:49, 1920×1080. The video file and the call audio are kept outside this repo. It was rendered from [`deck/video/ruko-demo.yaml`](deck/video/ruko-demo.yaml) with the vidkit toolkit and a Ruko scene driver; both of those are outside the repo too.

The video is built around the **live Bolna web calls of 23 October 2026**. On each of them the customer was a scripted text-to-speech voice, not a real person; the agent's side was live. <!--r:live.note-->Five live Bolna web calls on 23 Oct (4 English, 1 Hindi; 41.25¢ in all), each with a scripted text-to-speech customer, not a real person. Two ran the full flow and blocked the payment, including the first live Hindi call, where the policy was stricter than the agent; three ended on a safe hold after test set-up faults.<!--/r--> The details are in [`docs/BOLNA_SPEND.md`](docs/BOLNA_SPEND.md).

Two of those calls are used:
- **English call #2** (execution `b6818362`) is played from **Bolna's own recording**. Bolna records the customer and the agent on separate channels and removes each side's silences separately, so the two channels drift apart. Played as they are, the voices overlap. So each utterance is cut out unchanged from its own channel, and the utterances are laid end to end **in the order of Bolna's transcript**, with a short gap. The on-screen note says "silences removed by Bolna; turns in transcript order". The site's player uses the same cuts ([`scripts/splice-call.mjs`](scripts/splice-call.mjs)).
  - **Bolna's recording ends** after the customer says she must move her savings to a safe custody account. The agent's next line, which stops the payment and offers to call her son, is in Bolna's transcript but **not in its recording**. The video says so in narration and shows that line as text marked "not in its recording". It is never presented as audio.
- **Hindi call #5** (execution `9f893617`), the first live Hindi call, is shown **as transcript lines over a still of its console page**. None of its audio is used, because its scripted customer is the Piper `hi_IN-pratham` voice, which is licensed CC BY-NC-SA.

**Narration** uses the Piper voice `en_US-ljspeech-high`, trained on the public-domain LJSpeech data. The research-only `en_US-lessac-high` voice is not used.

## Chapters

| Time | Chapter |
|---|---|
| 0:00 | Payment paused |
| 0:18 | The problem |
| 0:34 | Hold |
| 0:46 | A live Bolna call |
| 1:43 | A live call in Hindi |
| 1:55 | Decide |
| 2:09 | Results |
| 2:29 | The ask |

## Scene by scene

| Time | Scene (`ruko-demo.yaml`) | Picture | Sound | On screen |
|---|---|---|---|---|
| 0:00–0:15 | `cold` | The production sandbox at /demo with the CBI scenario. A ring on "On a phone call", then Pay is pressed and the coral **"Payment paused"** screen is up within about 3 s; a ring on the code word | Narration 1 | label "Sandbox bank · fictional customer"; any server wait over 1.8 s is shown sped up and labelled |
| 0:15–0:18 | `title` | Title card: Ruko | Narration 2 | |
| 0:18–0:34 | `problem` | Card: the problem, with sourced figures | Narration 3 | |
| 0:34–0:46 | `hold` | The same held payment: the pre-payment risk card with a reason for every point ("On a call while paying", "Payee looks like a 'safe account'"), then "Answer the call" | Narration 4 | label "Sandbox bank · fictional customer" |
| 0:46–0:52 | `call-intro` | The call picture: Kamla's ₹1,90,000 to "Safe Custody Account RBI", two voice lanes (Ruko, live Bolna agent; Customer, scripted text-to-speech) and the engine's audit trail | Narration 5 | "Audio: Bolna's own recording (silences removed by Bolna; turns in transcript order) · Captions: Bolna's transcript" |
| 0:52–1:35 | `call-en` | The same picture, live: each lane's waveform as its side speaks; the engine's audit-trail events appear at their times | **The call's own audio** (no narration, no music), turns in transcript order | captions from Bolna's transcript, slips included ("acbi officer"); label "Live Bolna web call · customer: scripted text-to-speech · Ruko: live Bolna agent" |
| 1:35–1:43 | `call-outro` | The picture holds; a panel appears: "Bolna's transcript continues · not in its recording", with the agent's last line as text | Narration 6 | |
| 1:43–1:55 | `call-hi` | Hindi transcript lines with English glosses over a still of the call's console page, then the still with the outcome highlighted | Narration 7 (no call audio) | "Live Bolna web call · Hindi · 23 Oct 2026 · execution 9f893617"; label "First live Hindi call · shown as transcript" |
| 1:55–2:09 | `decide` | Console check `chk_YEEMZU2H8H` (an eval replay): the deterministic policy, the reason code MULTIPLE_STRONG_SIGNS, then the transcript's highlighted evidence next to the signals it backs | Narration 8 | label "Eval replay · synthetic customer" |
| 2:09–2:29 | `results` | Card: text-mode results on the dev and held-out sets, and the live calls | Narration 9 | |
| 2:29–2:43 | `ask` | Card: price, no customers or pilots yet, the ask | Narration 10 | |
| 2:43–2:49 | `end` | End card: "Only a voice breaks a *voice.*", ruko-symphony.vercel.app and github.com/Thanatos9404/ruko | Narration 11 | disclosures (below) |

## Narration, as spoken

Captions keep the written forms; the scene file's `pronounce` table says "₹1,90,000" as "one lakh ninety thousand rupees" and "CBI" as "C B I".

1. Kamla is sixty-eight. A man claiming to be a CBI officer has kept her on a video call for forty-seven minutes, and she is sending ₹1,90,000 to a safe custody account. Ruko paused it.
2. This is Ruko. It's Hindi for wait.
3. In 2024, Indians reported ₹22,845 crore lost to cyber fraud. The victim makes the payment, coached on another call, so OTPs don't help. Only a voice breaks a voice.
4. Her bank sends the payment to Ruko's API. It is held, with a plain reason for every point of risk, and her app shows a one-time code word. Then a Bolna voice agent calls her.
5. Here is a live Bolna call, with a scripted computer voice playing the customer.
6. That is where Bolna's recording ends. Its transcript has the rest: the payment is stopped, and Ruko offers to call her son.
7. Next, our first live call in Hindi: Bolna understood the scripted customer, and Ruko answered in Hindi. The agent recommended a delay; the policy, reading the evidence, blocked the payment.
8. A deterministic policy decides from the recorded evidence. The agent can make the outcome stricter, never softer, and it never asks for an OTP. The fraud team sees every quote, signal and reason.
9. In our text-mode evaluation, Ruko caught 60 of 60 scams on the set we tuned it on, and 15 of 18 on a held-out set frozen before any run, with 2 false holds in 10 genuine payments. In five live Bolna calls with a scripted customer voice, both full runs blocked the scam.
10. We plan to charge ₹20 to ₹30 per completed check, and nothing when the payment passes. We have no customers or pilots yet. We're asking for introductions to Indian banks for shadow-mode pilots.
11. Ruko. Built on Bolna.

## The English call, line by line

Bolna's transcript, in the order played (captions are exactly this text). The video and the site's player use the same cut windows.

| Speaker | Caption |
|---|---|
| Ruko | Hi Kamla, Ruko here, Demo Bank's automated safety line, on a recorded call. |
| Ruko | Your code word is BADAL 84. Does it match your app? |
| Customer | yes |
| Ruko | Okay. Your app shows you were on a call while paying. |
| Ruko | What's this payment for, and who were you speaking with? |
| Customer | it's for my nephew's college fees |
| Ruko | Just give me a moment, I'll be back with you. |
| Ruko | Has someone said RBI is holding money, a prize or a payout for you? |
| Customer | actually |
| Customer | acbi officer is on a video call with me |
| Ruko | Just give me a moment, I'll be back with you. |
| Customer | and i must move my savings to a safe custody account |
| *Ruko, not in the recording* | *For your safety, this payment is stopped. Your money is safe in your account. Shall I call Ravi, your son, so you can talk it over?* |

"Just give me a moment, I'll be back with you." is Bolna's default filler line, which this call still had; it has since been replaced. The transcript's slips (for example "acbi officer") are left as they came back, because they show it is the real transcript.

## Disclosures in the video

On the end card, and in labels where they apply:
- Kamla, Ravi and Demo Bank are fictional. Eval results are text mode: an LLM plays the customer. No customers or pilots yet.
- Live calls: real Bolna web calls on 23 Oct 2026; the customer is a scripted text-to-speech voice. The Hindi call is shown as transcript only.
- The narration is a synthetic voice (Piper `en_US-ljspeech-high`, public-domain LJSpeech), and the video was built with AI assistance.

## Re-rendering

`deck/video/ruko-demo.yaml` is the spec the video was rendered from. It needs, outside this repo:
- `<toolkit>`: the vidkit toolkit, with the Piper voice `en_US-ljspeech-high` in its `voices` folder.
- `<scenes>/ruko/build.py`: the scene driver that adds the brand cards, the two live-call scenes and the single loudness-normalised mix. Plain vidkit can parse the spec but cannot build the call scenes.
- The call recording and execution JSON in this repo's git-ignored `.data/live/` (fetched by the owner with `scripts/bolna-execution.ts`).

```bat
<toolkit>\.venv\Scripts\python.exe <scenes>\ruko\build.py deck\video\ruko-demo.yaml --tts-only          :: narration timings
<toolkit>\.venv\Scripts\python.exe <scenes>\ruko\build.py deck\video\ruko-demo.yaml                     :: TTS, record, assemble
<toolkit>\.venv\Scripts\python.exe <scenes>\ruko\build.py deck\video\ruko-demo.yaml --reuse-recording   :: re-assemble only
```

Each browser recording presses Pay twice in the production sandbox (a warm-up and the take). That is free and calls nobody, but it leaves sandbox holds in the sandbox tenant (not in the demo bank's console view). Every TTS line in the log must say `(piper)`: if the model is missing, vidkit falls back to a Windows voice, and that take must not be used.

If a new live take is ever wanted: record the customer's lines in your own voice (not a third-party TTS voice), log the spend in `docs/BOLNA_SPEND.md`, update `live_calls` in `deck/results.config.json`, and run `node deck/tools/build.mjs`.
