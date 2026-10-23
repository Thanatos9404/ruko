# Ruko demo video: script and shot list

**Length:** target 2:45, between 2:30 and 3:00.
**Spine:** one real Bolna web call in the digital-arrest scenario. The customer is a **scripted computer voice** and the agent's side is live.
**Around the call:** Piper narration rendered by vidkit from [`deck/video/ruko-demo.yaml`](deck/video/ruko-demo.yaml). You can also read the narration yourself.
**Context:** the deck is [`deck/Ruko-pitch.pdf`](deck/Ruko-pitch.pdf) and the wider pitch kit is [`docs/PITCH.md`](docs/PITCH.md).

The results line in the narration is filled in by `node deck/tools/build.mjs` (the values between `r:` comment markers), so it always matches the deck. It currently reads <!--r:version-->v5<!--/r--> results.

## The plan in one table

Narration timings were measured with `render.py --tts-only` (Piper `en_US-lessac-high`, about 170 words a minute). The call itself should run 70 to 85 seconds: full calls take about 67–83 s, and the decision lands at about 51–59 s.

| # | Time | Scene (`ruko-demo.yaml`) | Picture | Sound | On screen |
|---|---|---|---|---|---|
| 1 | 0:00–0:12 | `cold` | /demo with the CBI scenario selected. A ring on the payee, then on "On a phone call · 47 min" | Narration 1 | label "Sandbox bank · fictional customer" |
| 2 | 0:12–0:17 | `title` | Title card: Ruko, "Stop the scam before the money *leaves.*" | Narration 2 | |
| 3 | 0:17–0:32 | `problem` | Section card with three sourced bullets | Narration 3 | |
| 4 | 0:32–0:44 | `hold` | Press Pay. The risk card fills in with a reason for every point; a ring lands on the code word | Narration 4 | |
| 5 | 0:44–2:02 | **the live call** (spliced in) | Screen recording of /demo: the phone on the left, the engine panel on the right, tool calls landing live, ending on **Blocked** with "decided by policy, not by the LLM" | Call audio only: the live agent and the scripted customer. No narration, no music | lower third "Live Bolna web call · recorded [date] · customer: scripted computer voice"; English captions |
| 6 | 2:02–2:15 | `decide` | Console check: the decision card, then the Hindi transcript with the evidence highlighted | Narration 5 | label "Eval replay · synthetic customer" |
| 7 | 2:15–2:30 | `results` | Section card with the results bullets | Narration 6 | |
| 8 | 2:30–2:42 | `ask` | Section card: the price, no customers yet, the ask | Narration 7 | |
| 9 | 2:42–2:48 | `end` | End card: "Only a voice breaks a *voice.*", the link, and disclosures | Narration 8 | the synthetic-voice and AI-assistance disclosure (vidkit adds it) |

## The live call

### Setup (build agent)

- **Scenario.** On https://ruko-symphony.vercel.app/demo, choose "A 'CBI officer' on video call" in **English**, then Pay ₹1,90,000 and Answer the call with the access code.
- **Customer voice.** Generate the lines once:

  ```bat
  powershell -NoProfile -ExecutionPolicy Bypass -File deck\video\customer-lines.ps1
  ```

  This writes WAV files to `..\_videos\ruko-call-lines\`, using the installed Windows voice "Microsoft Zira Desktop". That keeps the customer audibly different from the Piper narrator. `-Voice` picks another installed voice.
- **Routing the voice into the call.** Either:
  - play the WAVs through a virtual audio cable set as the browser's microphone (cleanest), or
  - play them from a speaker beside the laptop microphone with the agent on headphones.

  Either way, record desktop audio and the microphone in OBS, at 1080p and 30 fps.
- **Network.** Use a wired connection or a phone hotspot. Add `?relay=1` if UDP is blocked. Keep the tab in the foreground.
- **Log the spend.** Record the wallet before and after in `docs/BOLNA_SPEND.md`. Then set `live_calls` in `deck/results.config.json` and run `node deck/tools/build.mjs`, so the deck stops saying no live call has been measured.

### The customer's script

Play each line only after the agent has finished speaking. The code word changes every session, so line 1 never says it.

| Play when the agent… | Line | File |
|---|---|---|
| says the code word and asks if it matches | "Yes, the code word matches my app." | `1-code-word-matches.wav` |
| asks what the payment is for, or who she was speaking with (expected: "Your app shows you were on a call while paying…") | "It's for some verification. But there is a CBI officer on the other call right now. He told me not to tell anyone." | `2-cover-then-admit.wav` |
| says there is no digital arrest and asks whether they claimed to be police or CBI, or kept her on video | "Yes. He said he is from the CBI, and he told me to stay on the video call until the money is moved." | `3-yes-cbi-video.wav` |
| offers to call her trusted contact, or says the payment is stopped | "Yes, please call my son Ravi. I don't want to pay anything now." | `4-call-ravi.wav` |
| closes the call | "Thank you. Thank you so much." | `5-thank-you.wav` |

**Spares:**
- `x-repeat.wav`: "Sorry, can you say that again?"
- `x-no-otp.wav`: "No, nobody asked me for a code."
- `x-just-verification.wav`: "It's just for verification. They said it's a safe account."

The last one is for an agent that asks twice. It tests whether Ruko holds on a cover story.

**Rules for the take**
- One honest take. If the agent goes off the expected path, answer with the closest line or a spare, and keep going.
- Do not re-record until the outcome "looks right". A different but explainable decision is still a real result; see fallback D.
- Keep these beats in the edit: the code word said first, the "on a call while paying" question, the admission, the truth line, the trusted-contact offer, and the engine panel turning to Blocked.

### Captions

Fetch the execution's transcript from Bolna (`GET /executions/{id}`, free) and write `ruko-call.srt` with the call's timings. Then burn it in during the normalise step (below) by adding this to `-vf`:

```
,subtitles=ruko-call.srt:force_style='FontName=Inter,FontSize=22'
```

## Narration

This is the same text as the scene file. The `pronounce` table there says "₹1,90,000" as "one lakh ninety thousand rupees" and "CBI" as "C B I"; captions keep the written form.

1. Kamla is sixty-eight. A man calling himself a CBI officer has kept her on a video call for forty-seven minutes. Now she is sending ₹1,90,000 to a safe custody account.
2. This is Ruko. It's Hindi for wait.
3. Indians reported ₹22,845 crore lost to cyber fraud in 2024. The victim makes the payment, often coached on another call, so OTPs and pop-up warnings don't help. Only a voice breaks a voice.
4. Her bank sends the payment to Ruko's API. It is held, with a plain reason for every point of risk, and her app shows a one-time code word. Then a Bolna voice agent calls her.
5. A deterministic policy decides from the recorded evidence. The agent can make the outcome stricter, never softer, and it never asks for an OTP. The fraud team sees every quote, signal and reason.
6. In text-mode tests, Ruko caught <!--r:dev.catch-->60/60<!--/r--> scams on the set we tuned on, and <!--r:ho.catch-->15/18<!--/r--> on a held-out set we froze before any run, with <!--r:ho.fh-->2/10<!--/r--> false holds on genuine payments. The held-out number is the one we are improving.
7. Banks pay ₹20 to ₹30 per completed check, and nothing when the payment passes. We have no customers or pilots yet. We are asking for introductions to Indian banks for shadow-mode pilots.
8. Ruko. Built on Bolna.

## Rendering and the splice

Run these from the repo root. Videos go to `..\_videos`, outside git.

```bat
set PY=C:\Desktop\COLLEGE\Coding\Hackathon\_videos\toolkit\.venv\Scripts\python.exe
set R=C:\Desktop\COLLEGE\Coding\Hackathon\_videos\toolkit\render.py
set FF=C:\Users\yashv\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe

%PY% %R% deck\video\ruko-demo.yaml --tts-only
%PY% %R% deck\video\ruko-demo.yaml --only cold,title,problem,hold --output ..\_videos\ruko-part-a.mp4
%PY% %R% deck\video\ruko-demo.yaml --only decide,results,ask,end --output ..\_videos\ruko-part-b.mp4

rem Normalise the call recording to vidkit's format (1080p30, AAC 48 kHz, -16 LUFS). Trim with -ss/-to if needed.
%FF% -i ..\_videos\ruko-call-raw.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b111c,fps=30,format=yuv420p,setsar=1" -af "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000" -ac 2 -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k ..\_videos\ruko-call.mp4

rem Join part A, the call and part B.
%FF% -i ..\_videos\ruko-part-a.mp4 -i ..\_videos\ruko-call.mp4 -i ..\_videos\ruko-part-b.mp4 -filter_complex "[0:v]setsar=1[v0];[1:v]setsar=1[v1];[2:v]setsar=1[v2];[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];[2:a]aresample=48000[a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k -movflags +faststart ..\_videos\ruko-demo.mp4
```

**Editing rules.**
- Trim dead air only at the start and end of the call.
- Inside the call, mark any cut with a one-second "cut" title. Never hide a cut or reorder answers.

**Rehearsal.** On 22 October the four browser scenes (`cold`, `hold`, `call-recorded`, `decide`) were rehearsed against production with `--record-only --keep-going`, and every action found its element. The `decide` scene opens console check `chk_YEEMZU2H8H`: Hindi, ₹2,40,000 to "Safe Custody Account RBI", blocked, from the v5 seed. If the console seed is rebuilt, replace that id with any blocked digital-arrest eval replay.

## Fallbacks

| If | Then |
|---|---|
| **A.** The live call fails, or its audio is unusable | Render the fallback cut in one pass: `--only cold,title,problem,hold,call-recorded,decide,results,ask,end --output ..\_videos\ruko-demo.mp4`. Scene `call-recorded` plays the recorded run on /demo, a text-mode conversation replayed through the live engine, under the label "Recorded run: text mode, no audio", with its own narration. Remove the end card's live-call disclosure. |
| **B.** The call is good but drops before the decision | Keep the clip up to the drop. Add a one-second card, "Call dropped; same scenario, recorded run", then the last 15 s of `call-recorded`. Never present the recorded run's decision as the live call's. |
| **C.** The call runs past 90 s | Trim the greeting and the goodbye, not the middle. If it is still long, drop the `title` scene (4.5 s) and cut narration 3 to its last sentence. |
| **D.** The agent does something unexpected (another pattern, odd phrasing, a delay instead of a block) | Use it if the decision path is visible, and change narration 5 to say what the policy did. An honest imperfect call beats a polished replay. If it is unusable, use A. |
| **E.** Piper is unavailable | vidkit falls back to a Windows voice, or you record the eight lines yourself and re-assemble with `--reuse-recording`. |

## Disclosures that stay in the video

- Kamla, Ravi and Demo Bank are fictional.
- **The customer on the call is a scripted computer voice**; the agent's side is live.
- Results are text mode: an LLM plays the customer.
- The narration is a synthetic voice, and the video was built with AI assistance (vidkit's end card adds this).
