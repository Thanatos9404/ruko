# Ruko demo video: script and shot list

**Live:** https://ruko-symphony.vercel.app · **Code:** https://github.com/Thanatos9404/ruko · **Demo video:** [link to add]

The video should run about 2:30 to 2:45 and must stay under 3:00. It is built around the **live Bolna web calls of 23 October 2026**. On each call the customer was a scripted text-to-speech voice, not a real person; the agent's side was live. <!--r:live.note-->Five live Bolna web calls on 23 Oct (4 English, 1 Hindi; 41.25¢ in all), each with a scripted text-to-speech customer, not a real person. Two ran the full flow and blocked the payment, including the first live Hindi call, where the policy was stricter than the agent; three ended on a safe hold after test set-up faults.<!--/r--> The details are in [`docs/BOLNA_SPEND.md`](docs/BOLNA_SPEND.md).

Two of those calls are used, in different ways:
- **English call #2** (execution `b6818362`) **plays as recorded**. This is Bolna's own recording, with silences removed, about 32 s. Kamla admits a "CBI officer" is on a video call, and Ruko stops the payment and offers to call her son.
- **Hindi call #5** (execution `9f893617`), the first live Hindi call, appears **as transcript lines only**. Its audio must not be used, because its scripted customer is the Piper `hi_IN-pratham` voice, which is CC BY-NC-SA. On that call the agent recommended a delay, and the policy, reading the evidence, blocked the payment.

**Narration** uses the Piper voice **`en_US-ljspeech-high`**, trained on the public-domain LJSpeech data. Do not use `en_US-lessac-high`, which is research-only. The narration is rendered by vidkit from [`deck/video/ruko-demo.yaml`](deck/video/ruko-demo.yaml). You can also read the same lines yourself.

The results line in the narration is filled in by `node deck/tools/build.mjs` (the values between `r:` comment markers), so it always matches the deck. It currently reads <!--r:version-->v5<!--/r--> results.

## The plan in one table

Times are estimates. Run `--tts-only` once the ljspeech voice is installed, then adjust.

| # | Time | Scene (`ruko-demo.yaml`) | Picture | Sound | On screen |
|---|---|---|---|---|---|
| 1 | 0:00–0:12 | `cold` | /demo with the CBI scenario selected; a ring on the payee, then on "On a phone call · 47 min" | Narration 1 | label "Sandbox bank · fictional customer" |
| 2 | 0:12–0:17 | `title` | Title card: Ruko, "Stop the scam before the money *leaves.*" | Narration 2 | |
| 3 | 0:17–0:32 | `problem` | Section card with three sourced bullets | Narration 3 | |
| 4 | 0:32–0:44 | `hold` | Press Pay; the risk card fills in with a reason for every point; a ring on the code word | Narration 4 | |
| 5 | 0:44–1:21 | **`call-en`** (spliced) | Still: the live call's console page, "Sandbox · live web call", Blocked, decided 58 s after the hold | **The call's own audio**: the live agent and the scripted customer. No narration, no music | lower third "Live Bolna web call · 23 Oct 2026 · customer: a scripted text-to-speech voice"; captions from Bolna's transcript |
| 6 | 1:21–1:39 | `call-hi` | Section card: the same scam, live in Hindi, three transcript lines with English, and the outcome | Narration 5 (no call audio) | label "Live Bolna call #5 · transcript only" |
| 7 | 1:39–1:52 | `decide` | Console check: the decision card, then a Hindi transcript with the evidence highlighted | Narration 6 | label "Eval replay · synthetic customer" |
| 8 | 1:52–2:14 | `results` | Section card: dev and held-out results, and the live calls | Narration 7 | |
| 9 | 2:14–2:26 | `ask` | Section card: price, no customers yet, the ask | Narration 8 | |
| 10 | 2:26–2:32 | `end` | End card: "Only a voice breaks a *voice.*", code and live links, disclosures | Narration 9 | synthetic-voice and AI-assistance disclosure (vidkit adds it) |

## Narration

This is the same text as the scene file. The `pronounce` table there says "₹1,90,000" as "one lakh ninety thousand rupees" and "CBI" as "C B I"; captions keep the written form.

1. Kamla is sixty-eight. A man calling himself a CBI officer has kept her on a video call for forty-seven minutes. Now she is sending ₹1,90,000 to a safe custody account.
2. This is Ruko. It's Hindi for wait.
3. Indians reported ₹22,845 crore lost to cyber fraud in 2024. The victim makes the payment, often coached on another call, so OTPs and pop-up warnings don't help. Only a voice breaks a voice.
4. Her bank sends the payment to Ruko's API. It is held, with a plain reason for every point of risk, and her app shows a one-time code word. Then a Bolna voice agent calls her.
5. Then our first live call in Hindi. Bolna's Hindi speech-to-text understood the scripted customer, and Ruko answered in Hindi. The agent recommended a delay. The policy, reading the recorded evidence, blocked the payment.
6. A deterministic policy decides from the recorded evidence. The agent can make the outcome stricter, never softer, and it never asks for an OTP. The fraud team sees every quote, signal and reason.
7. In text-mode tests, Ruko caught <!--r:dev.catch-->60/60<!--/r--> scams on the set we tuned on, and <!--r:ho.catch-->15/18<!--/r--> on a held-out set we froze before any run, with <!--r:ho.fh-->2/10<!--/r--> false holds on genuine payments. The held-out number is the one we are improving. We have also made five live Bolna calls, with a scripted computer voice as the customer. Both calls that ran the full flow blocked the scam.
8. Banks pay ₹20 to ₹30 per completed check, and nothing when the payment passes. We have no customers or pilots yet. We are asking for introductions to Indian banks for shadow-mode pilots.
9. Ruko. Built on Bolna.

## Building it

Run everything from the repo root. Three placeholders stand for paths on your machine:
- `<toolkit>` is the vidkit folder.
- `<ffmpeg>` is an ffmpeg binary.
- `<videos>` is a folder **outside the repo**. Videos and call audio never go into git.

### 1. The narration voice (once)

```bat
curl -sSL -o <toolkit>\voices\en_US-ljspeech-high.onnx      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/high/en_US-ljspeech-high.onnx
curl -sSL -o <toolkit>\voices\en_US-ljspeech-high.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/high/en_US-ljspeech-high.onnx.json
<toolkit>\.venv\Scripts\python.exe <toolkit>\render.py deck\video\ruko-demo.yaml --tts-only
```

Every TTS line in the log must say `(piper)`. If the model is missing, vidkit falls back to a Windows voice, and that take must not be used.

### 2. The narrated parts

```bat
<toolkit>\.venv\Scripts\python.exe <toolkit>\render.py deck\video\ruko-demo.yaml --only cold,title,problem,hold --output <videos>\ruko-part-a.mp4
<toolkit>\.venv\Scripts\python.exe <toolkit>\render.py deck\video\ruko-demo.yaml --only call-hi,decide,results,ask,end --output <videos>\ruko-part-b.mp4
```

### 3. The English call (`call-en`)

**Inputs:**
- **Audio:** the call's recording, `<videos>\live-en.wav`. This is Bolna's recording of execution `b6818362`, fetched by the owner with `scripts/bolna-execution.ts`.
- **Captions:** the timed transcript in `public/calls/hero.json`, written by `scripts/build-call.mjs`. Keep that file out of git if the recordings stay out.
- **Still:** a 1920×1080 screenshot of the live call's console page, https://ruko-symphony.vercel.app/console/checks/chk_B3RQU9A6M6?tenant=sandbox. Take it with `deck/tools/capture.py … console_live` or a browser, and crop to the header and decision.

Write the captions as SRT, shifted 3 s for a lead-in on the still:

```bat
node -e "const d=require('./public/calls/hero.json'),f=s=>{const t=Math.round((s+3)*1000),p=(n,w=2)=>String(n).padStart(w,'0');return p(Math.floor(t/3600000))+':'+p(Math.floor(t/60000)%60)+':'+p(Math.floor(t/1000)%60)+','+p(t%1000,3)};console.log(d.turns.map((c,i)=>(i+1)+'\n'+f(c.start)+' --> '+f(c.end)+'\n'+(c.role==='agent'?'Ruko: ':'Customer: ')+c.text+'\n').join('\n'))" > <videos>\call-en.srt
```

Build the clip. It holds the still for 3 s, plays the call, then holds 2 s more:

```bat
<ffmpeg> -loop 1 -framerate 30 -i <videos>\call-en-still.png -i <videos>\live-en.wav -filter_complex "[0:v]scale=1920:1080,format=yuv420p,subtitles=<videos>/call-en.srt:force_style='FontName=Inter,FontSize=22',setsar=1[v];[1:a]adelay=3000|3000,apad=pad_dur=2,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]" -map "[v]" -map "[a]" -shortest -ac 2 -c:v libx264 -crf 18 -c:a aac -b:a 192k <videos>\ruko-call-en.mp4
```

The captions show Bolna's transcript as it came back, including its slips (for example "acbi officer"). Don't correct them: they show it is the real transcript. The recording leaves out silences, so caption timing is approximate.

### 4. Join

```bat
<ffmpeg> -i <videos>\ruko-part-a.mp4 -i <videos>\ruko-call-en.mp4 -i <videos>\ruko-part-b.mp4 -filter_complex "[0:v]setsar=1[v0];[1:v]setsar=1[v1];[2:v]setsar=1[v2];[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];[2:a]aresample=48000[a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k -movflags +faststart <videos>\ruko-demo.mp4
```

**Rehearsal.** The browser scenes (`cold`, `hold`, `call-recorded`, `decide`) were rehearsed against production with `--record-only --keep-going`, and every action found its element. `decide` opens console check `chk_YEEMZU2H8H`: Hindi, ₹2,40,000 to "Safe Custody Account RBI", blocked, from the v5 seed. If the seed is rebuilt, use any blocked digital-arrest eval replay.

## Fallbacks

| If | Then |
|---|---|
| **A.** The English call clip can't be used | Render one pass with `--only cold,title,problem,hold,call-recorded,call-hi,decide,results,ask,end --output <videos>\ruko-demo.mp4`. `call-recorded` plays the narrated recorded run on /demo, labelled "Recorded run: text mode, no audio". `call-hi` still shows the live Hindi call as a transcript. |
| **B.** The video runs past 3:00 | Drop `title` (about 5 s), then cut narration 3 to its last sentence. Don't trim inside the call. |
| **C.** The video runs under 2:30 | Hold the still in `call-en` longer before and after the audio, and keep the console's decision on screen in `decide` a few seconds more. Don't stretch the call itself. |
| **D.** The ljspeech voice is unavailable | Record the nine lines yourself, then re-assemble with `--reuse-recording`. Don't fall back to lessac or a Windows voice. |
| **E.** A new live take is wanted | Record the customer's lines in your own voice (not a third-party TTS voice), log the spend in `docs/BOLNA_SPEND.md`, update `live_calls` in `deck/results.config.json`, and run `node deck/tools/build.mjs`. |

## Disclosures that stay in the video

- Kamla, Ravi and Demo Bank are fictional.
- **On the live calls the customer is a scripted text-to-speech voice**, and the agent is live Bolna.
- The Hindi call is shown as transcript only.
- Eval results are text mode: an LLM plays the customer.
- The narration is a synthetic voice, and the video was built with AI assistance (vidkit's end card adds this).
