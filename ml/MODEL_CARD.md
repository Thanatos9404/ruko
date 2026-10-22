# Model card: Ruko text model (ruko-text-1.0.0)

*Advisory evidence only.* This model never releases or blocks a payment. Ruko's deterministic decision policy (`server/engine/decision.ts`) decides, using the signals the voice agent records. The model's opinion is stored separately (`check.ml`) and shown in the console as "model opinion (advisory)". [Why advisory](#why-the-model-is-advisory-only) explains this, and the numbers below are the reason.

| | |
|---|---|
| Artefact | `server/ml/model/ruko-text-v1.json` (JSON, about 3 MB) with a SHA-256 sidecar `ruko-text-v1.json.sha256`. The runtime refuses a file that fails the checksum. |
| Runtime | `server/ml/` (TypeScript, no dependencies, Node on Vercel). Python reference: `ml/ruko_text.py`. Parity is tested on 28 golden inputs (tokens, feature hash, probabilities to 1e-9). |
| Training code | `ml/train.py`, deterministic: hash-based splits, lbfgs solver, pinned `ml/requirements.lock.txt` |
| Data | [`DATA_CARD.md`](DATA_CARD.md) |
| Results | `ml/results/*.json`. The tables below are printed by `ml/report_tables.py` from those files. |
| Owner | Ruko research + ML. Built 22 Oct 2026. |

## What it does

The model takes one short text in English, Hindi (Devanagari), Hinglish (romanised) or, less reliably, Tamil, Bengali or Marathi. That text can be:
- the customer's turns from a Ruko safety-check call;
- an SMS or WhatsApp message pasted into the public checker;
- a person's description of what happened.

For that text, the model returns:
1. **P(scam)**, a calibrated scam probability (logistic regression with Platt scaling on the validation set).
2. **Band** on that probability:
   - `possible_scam` from 0.5;
   - `likely_scam` from 0.85;
   - otherwise `unlikely_scam`.
   The cut-offs are fixed, not tuned (see Calibration).
3. **P(pattern | scam)** over the 72 library patterns: multinomial logistic regression with temperature scaling. With `region: "india"` the candidates are limited to the 54 Indian patterns.
4. **Explanations.** Each feature's contribution is attributed to the token it came from. The runtime returns:
   - `evidence` (towards scam) and `counter_evidence` (towards genuine) as character spans in the original text;
   - the top features.

   Redacted PII becomes placeholder tokens and is never echoed.

The cue lexicon (`server/ml/lexicon.ts`) runs alongside the model. It matches library cue phrases and call-signal phrases with negation handling, and it is the **fallback** if the model file is missing or corrupt.

## How it works

- **Features** (`ml/ruko_text.py` = `server/ml/featurize.ts`, featurizer v2):
  - Redact PII to placeholders.
  - Normalise text: NFKC, lower-case, digits to 0, nukta and chandrabindu folded.
  - Take word 1–2-grams and char 2–5-grams inside each token.
  - Weight with sublinear TF-IDF and L2 normalisation.
  - In v2, **link, UPI ID / e-mail, phone and account-number placeholders produce no features.** In v1 the placeholders alone were among the strongest scam features (weights of about 4). Genuine bank alerts and OTPs carry links and numbers too, and in our synthetic data their frequency reflected how the generator was prompted. APK file names still count.
- **Selection.** Stage 1 fits on the full vocabulary (min_df 2). We keep the 24,000 strongest binary features, plus the 700 per pattern with the highest χ² score. Stage 2 refits on that union, about 62k features. Weights are stored as integers (×10⁴); the pattern weights keep the top 1,200 per class.
- **Hyperparameters.** Binary C and pattern C are tuned on validation over {8, 32, 128} and {16, 64, 256}. Class weights are balanced, and sample weights are 0.5 for BothBosu and early-call windows.

## Results

All numbers come from `ml/results/main.json`. Held-out sets are described in [`DATA_CARD.md`](DATA_CARD.md#evaluation-only-data-never-trained-on). "False-alarm rate" is the share of genuine rows at or above the threshold.

### Headline, read honestly

- **On synthetic data like its training data, it is very good.** AUROC is 0.997, and at P ≥ 0.5 it catches 98.6% of scams with 3.6% false alarms. On synthetic calls written by a different LLM it scores AUROC 0.989, 95.7% recall and 5.3% false alarms, so it has not just memorised one generator's style.
- **On real-world text it is moderate.**
  - The 166 cited real Indian cases and messages: AUROC 0.933, 83% recall, 15% false alarms.
  - Real Indian smishing reports (IMC25): 72% caught.
  - Global smishing reports: only 49%.
- **False alarms on genuine Indian look-alike messages are still too high** for the model to act alone:
  - Ridham115 genuine bank, courier and bill SMS: 13.5%.
  - ScamGuardBench legit OTPs, transaction alerts and family requests: 27.6%.
  - Genuine payment SMS: 18% (6 of 33).
  - Marketing spam: called a scam 57% of the time (it is not a scam, but it is not "safe" either).
- **On ICFD-31k scammer-victim calls**, a different conversation shape from Ruko's check calls, it flags 91.5% of fraud calls. The few "non-fraud" ICFD calls are themselves conversations about scams, so that set cannot measure false alarms.
- **Probabilities are calibrated in-distribution only.** ECE is 0.013 on held-out synthetic data and 0.11–0.51 on the out-of-distribution sets.

### Binary head (scam vs genuine), shipped model

| Set | n (scam/genuine) | AUROC [95% CI] | Recall @0.5 | False-alarm rate @0.5 | Recall @0.85 | False-alarm rate @0.85 | ECE |
|---|---|---|---|---|---|---|---|
| Synthetic, held-out requests (in-distribution) | 1517 (992/525) | 0.997 [0.995–0.999] | 98.6% | 3.6% | 95.3% | 1.1% | 0.013 |
| Synthetic, other generator (Gemma-27B) | 1069 (598/471) | 0.989 [0.985–0.993] | 95.7% | 5.3% | 89.8% | 2.1% | 0.013 |
| Real SMS, Mendeley held-out | 1578 (142/1436) | 0.992 [0.982–0.999] | 87.3% | 0.1% | 76.8% | 0.0% | 0.009 |
| BothBosu dialogues, held-out | 895 (439/456) | 1.000 [1.000–1.000] | 99.5% | 0.0% | 99.1% | 0.0% | 0.004 |
| Real-world curated (166, cited) | 166 (125/41) | 0.933 [0.890–0.966] | 83.2% | 14.6% | 63.2% | 0.0% | 0.119 |
| Indian SMS, other team (Ridham115) | 1580 (797/783) | 0.887 [0.869–0.902] | 73.2% | 13.5% | 58.7% | 5.5% | 0.116 |
| Legit look-alikes (ScamGuardBench en) | 378 (168/210) | 0.970 [0.951–0.984] | 97.0% | 27.6% | 94.6% | 15.7% | 0.156 |
| Genuine Indian payment SMS (skyaara) | 33 (0/33) | – | – | 18.2% | – | 9.1% | 0.219 |
| Real smishing, India (IMC25) | 2621 (2621/0) | – | 71.8% | – | 53.1% | – | 0.307 |
| Real smishing, global (IMC25) | 1432 (1432/0) | – | 48.6% | – | 33.2% | – | 0.509 |
| Indian fraud calls (ICFD-31k) | 5500 (5438/62) | 0.635 [0.580–0.699] | 91.5% | 88.7% | 78.7% | 64.5% | 0.106 |
| Marketing spam (not scam) | 451 (0/451) | – | – | 56.8% | – | 37.0% | 0.555 |

AUROC confidence intervals are 500-sample bootstraps. "–" means the set has only one class.

**Slices on the in-distribution test** (`main.json` → `by_lang`, `by_format`, `by_coaching`):
- **By language**, recall @0.5 with false alarms in brackets: en 98.1% (2.0%), hi 98.9% (5.7%), Hinglish 99.3% (3.8%), mr 96.4% (0%, n=45), bn 88.9% (0%, n=21), ta 100% (0%, n=21). The ta, bn and mr slices are tiny.
- **By format**, false alarms @0.5: call-check transcripts 13.8% (9 of 65 genuine payment calls), messages 2.3%, reports 1.9%. At 0.85 the call-check false alarms fall to 4.6%. Genuine payment calls are the costliest false alarm for Ruko. **This is the main reason the model may not delay or block a payment.**
- **By coaching level** (scam calls only), recall @0.5:
  - open: 100%;
  - partly coached: 100%;
  - heavily coached: 98.6%.

  The synthetic coached victims still leak cues. Real coached victims may leak fewer.
- **Hard negatives** (genuine but scam-like: a real bank fraud call, a relative really in hospital, a payment after an ignored scam call, and so on): 3.9% false alarms in-distribution and 7.8% with the other generator.

### Pattern head (which of the 72 scams)

| Set | scam rows scored | Top-1 | Top-3 | Top-1, global/India twins merged | Top-1, same category | Macro-F1 |
|---|---|---|---|---|---|---|
| Synthetic, held-out requests (in-distribution) | 992 | 72.5% | 84.3% | 74.3% | 78.7% | 0.681 |
| Synthetic, other generator (Gemma-27B) | 598 | 73.6% | 88.8% | 78.3% | 82.4% | 0.718 |
| Real-world curated (166, cited) | 125 | 57.6% | 74.4% | 60.0% | 69.6% | 0.506 |

- **Twins merged** counts a global pattern and its Indian counterpart as the same, for example `romance_scam_global` and `romance_social_media`. **Same category** counts any pattern in the same library category, for example both authority impersonation.
- The most confused pairs are close by design:
  - `ai_voice_clone_emergency` → `relative_emergency`;
  - `refund_cashback` → `fake_support_refund`;
  - `job_task_scam_global` → `task_job`;
  - `investment_trading` → `crypto_investment`;
  - `credit_card_reward_points` → `apk_malware_invite`.
- The weakest patterns have few samples or overlap heavily with another: `fake_payment_screenshot`, `crypto_investment`, `mule_account_recruitment`, and the English-only global patterns with only 15 synthetic samples each. On real-world text, top-3 (74%) is the honest figure to quote.

### Which way does it generalise? (train on one source, test on another)

| Trained on | Synthetic test | Other-generator test | Mendeley real SMS | Real-world curated | Ridham115 | IMC25 India recall @0.5 |
|---|---|---|---|---|---|---|
| Synthetic only (`synthetic_only`) | 0.998 | 0.998 | 0.714 | 0.928 | 0.873 | 77.9% |
| Real SMS only (Mendeley + IMC25 slice, `real_sms_only`) | 0.532 | 0.526 | 0.997 | 0.704 | 0.586 | 93.2% |
| BothBosu US dialogues only (`bothbosu_only`) | 0.603 | 0.606 | 0.862 | 0.623 | 0.668 | 2.3% |
| **Shipped** (synthetic + BothBosu + Mendeley) | 0.997 | 0.989 | 0.992 | 0.933 | 0.887 | 71.8% |

The cells are AUROC unless marked. Synthetic data transfers to real Indian text much better (0.928 on the curated set) than real Western SMS transfers to Indian calls and messages (0.704). Real SMS, though, catches far more real smishing.

**Language hold-out** (`lang_holdout_ta_bn_mr`). We trained without any Tamil, Bengali or Marathi rows. On those slices recall collapsed: ta 28%, bn 0%, mr 50%, with AUROC 0.61, 0.40 and 0.96. Character n-grams do not carry across scripts, so **a language must be in training data to be covered**. Telugu, Kannada, Malayalam, Gujarati and others are not covered at all.

### Before / after: reducing false alarms on genuine Indian messages

We trained in four rounds. Every model below is scored on the **same** final held-out sets. Round 1 is the model committed in `876c93d`, re-scored with its own featurizer v1.

- **Round 1.** Synthetic + BothBosu + Mendeley.
- **Round 2.** Added two things:
  - 1,275 synthetic **genuine look-alike messages** in 16 categories: bank alerts, OTPs, KYC reminders, bills, deliveries, promotions, government credits and more;
  - a real-smishing training slice from IMC25.
- **Round 2c.** Featurizer v2: link, phone, UPI and account placeholders no longer produce features. In round 1, `xurl` and `xphone` were the strongest scam features (weights of about 4) only because the generator was told to write `[link]` and `[phone]` in scam messages.
- **Round 2d (shipped).** Added 1,784 **scam messages that name real senders** (SBI, HDFC, PhonePe, Tata Power and others) as contrastive pairs for the genuine look-alikes. IMC25 was dropped from training and kept for evaluation.

| Set | metric | round 1 (876c93d) | 2d data + IMC25 slice (rejected) | **shipped (2d)** |
|---|---|---|---|---|
| Synthetic, held-out requests (in-distribution) | AUROC | 0.989 | 0.996 | 0.997 |
| Synthetic, held-out requests (in-distribution) | recall @0.5 | 98.8% | 97.6% | 98.6% |
| Synthetic, held-out requests (in-distribution) | false alarms @0.5 | 11.8% | 2.7% | 3.6% |
| Synthetic, other generator (Gemma-27B) | AUROC | 0.976 | 0.981 | 0.989 |
| Synthetic, other generator (Gemma-27B) | recall @0.5 | 96.8% | 95.7% | 95.7% |
| Synthetic, other generator (Gemma-27B) | false alarms @0.5 | 12.1% | 10.4% | 5.3% |
| Real SMS, Mendeley held-out | AUROC | 0.999 | 0.993 | 0.992 |
| Real SMS, Mendeley held-out | recall @0.5 | 98.6% | 92.2% | 87.3% |
| Real SMS, Mendeley held-out | false alarms @0.5 | 0.3% | 1.0% | 0.1% |
| BothBosu dialogues, held-out | AUROC | 1.000 | 1.000 | 1.000 |
| BothBosu dialogues, held-out | recall @0.5 | 100.0% | 99.1% | 99.5% |
| BothBosu dialogues, held-out | false alarms @0.5 | 0.0% | 0.0% | 0.0% |
| Real-world curated (166, cited) | AUROC | 0.910 | 0.915 | 0.933 |
| Real-world curated (166, cited) | recall @0.5 | 83.2% | 85.6% | 83.2% |
| Real-world curated (166, cited) | false alarms @0.5 | 14.6% | 19.5% | 14.6% |
| Indian SMS, other team (Ridham115) | AUROC | 0.866 | 0.853 | 0.887 |
| Indian SMS, other team (Ridham115) | recall @0.5 | 83.9% | 82.3% | 73.2% |
| Indian SMS, other team (Ridham115) | false alarms @0.5 | 28.2% | 26.2% | 13.5% |
| Legit look-alikes (ScamGuardBench en) | AUROC | 0.958 | 0.936 | 0.970 |
| Legit look-alikes (ScamGuardBench en) | recall @0.5 | 98.2% | 98.2% | 97.0% |
| Legit look-alikes (ScamGuardBench en) | false alarms @0.5 | 42.4% | 60.0% | 27.6% |
| Genuine Indian payment SMS (skyaara) | false alarms @0.5 | 24.2% | 54.5% | 18.2% |
| Real smishing, India (IMC25) | recall @0.5 | 67.7% | 89.6% | 71.8% |
| Real smishing, global (IMC25) | recall @0.5 | 59.5% | 83.1% | 48.6% |
| Indian fraud calls (ICFD-31k) | AUROC | 0.604 | 0.625 | 0.635 |
| Indian fraud calls (ICFD-31k) | recall @0.5 | 86.5% | 92.2% | 91.5% |
| Indian fraud calls (ICFD-31k) | false alarms @0.5 | 82.3% | 90.3% | 88.7% |
| Marketing spam (not scam) | false alarms @0.5 | 64.8% | 65.6% | 56.8% |

**What changed.**
- **False alarms dropped.**
  - Ridham115 genuine SMS: 28.2% → 13.5%.
  - ScamGuardBench look-alikes: 42.4% → 27.6%.
  - Genuine payment SMS: 24.2% → 18.2%.
  - Other-generator test: 12.1% → 5.3%.
  - In-distribution: 11.8% → 3.6%. The test now contains the new look-alikes.
- **AUROC rose** on every two-class out-of-distribution set.
- **What it cost.**
  - Recall on Mendeley real SMS: 98.6% → 87.3%.
  - Global IMC25 smishing: 59.5% → 48.6%.
  - Ridham scam recall: 83.9% → 73.2%.

**The rejected alternative (`variant_imc02_hn2`)** trains on the IMC25 slice. It catches far more real smishing (India 89.6%, global 83.1%), but it raises false alarms everywhere: ScamGuardBench 60%, genuine payment SMS 55%, real-world 19.5%. `ml/results/tradeoff.json` sweeps the threshold.
- At a matched 16–17% false-alarm rate on pooled genuine look-alikes, the IMC model still catches more Indian smishing (80% vs 72%), but recall on the real-world curated set falls (59% vs 83%).
- We shipped the version that is better on the calls and victim accounts Ruko actually sees, and kept the other for a future SMS-only checker.

We picked between these few configurations using the held-out results above, so those numbers are slightly optimistic for the shipped model. Every configuration we tried is in `ml/results/ablation_logs/`.

### Calibration

- Platt scaling on validation: P = σ(1.395·z − 0.568).
- Pattern temperature: 0.617.
- In-distribution ECE: 0.013.
- On real-world text the model is **overconfident in both directions**: ECE 0.12 on the curated set and 0.31 on IMC25 India.

The band cut-offs, 0.5 and 0.85, are **fixed policy values, not tuned**. Choosing them on validation percentiles collapsed both to 0.5, because the validation set is nearly separable. At 0.85, false alarms on the real-world curated set are 0% (0 of 41) and recall is 63%.

### Latency, size, cold start (TypeScript runtime)

Measured by `server/ml/scripts/eval_runtime.ts`, written to `ml/results/runtime_ts.json`, on Node 22, single thread, Windows laptop:
- **`analyzeText()` end to end** (tokenise, model, lexicon, explanations) on transcripts and messages averaging 305 characters: **p50 0.74 ms, p95 1.53 ms, p99 2.13 ms**. Texts ≤ 300 characters: p95 0.71 ms. That is well under the 5 ms target.
- **Model file:** 3.02 MB JSON; 62,606 features; 72 pattern classes.
- **Cold start:** about 106 ms to read and verify the model and library and build the indexes. This is once per server instance.
- **Python reference:** 1.4 ms per text.

### Fallback: cue lexicon only

If the model file is missing or fails its checksum, `analyzeText` answers from the lexicon and reports `engine.mode = "lexicon_only"`. It is much weaker. At its "possible" band:
- In-distribution recall is 54% with 13% false alarms.
- Real-world curated recall is 50% with 15% false alarms.
- Pattern top-1 on the real-world set is 30%.

It is a safety net, not a replacement.

**Experiment we rejected.** We tested raising the model's band to `possible_scam` whenever the lexicon alone says `likely_scam`. It gained 0.1–2.4 points of recall but added 2–4 points of false alarms. In-distribution false alarms went from 3.6% to 5.7%, and the other-generator test went from 5.3% to 8.9%. **Not shipped.** The lexicon's view is returned separately as `lexicon_band`, so the console can show "cue phrases matched" next to the model's opinion.

### Golden and adversarial tests

`server/ml/__tests__/runtime.test.ts` checks 25 behaviour cases plus PII and edge cases. They cover:
- en, hi, Hinglish, ta and bn scams;
- **negation** ("nobody asked for my OTP", "किसी ने ओटीपी नहीं माँगा");
- **a genuine bank fraud-team call**;
- **a relative really in hospital** (en and hi);
- a genuine OTP SMS;
- someone who ignored a scam call;
- benign secrecy ("don't tell my wife, it's a surprise");
- a genuine SIP;
- PII redaction, plus empty, tiny and over-long inputs.

**Known miss, kept in the suite as an expected failure:** a classic "your SBI account will be blocked today, update PAN KYC immediately" SMS scores P = 0.30. The genuine look-alike data taught the model that "SBI" and "KYC" also appear in real bank notices. The lexicon flags it (`kyc_block`, `lexicon_band = likely_scam`), and on a call Ruko's own questions would surface it.

`parity.test.ts` checks that TypeScript and Python agree exactly on all 28 golden inputs.

## Why the model is advisory only

1. **Its false-alarm rate on genuine payments is too high to act on.**
   - 13.8% of genuine synthetic payment calls cross 0.5.
   - 13–28% of genuine Indian look-alike SMS from other sources cross 0.5.

   A model that delayed one in seven genuine rent or hospital payments would do real harm and erode trust.
2. **It has never seen a real Ruko call.** Call-side training and testing are synthetic. Real speech-to-text output, real coaching and real victims will differ.
3. **It is overconfident on real-world text** (ECE 0.12–0.5), so its probability cannot be read as a real-world rate.
4. **It misses obvious scams sometimes** (the KYC SMS above), and it misses about half of global smishing reports.
5. **A score is not a reason.** Ruko's deterministic policy acts on named signals the agent heard and recorded, each with a reason in plain words that the customer and the bank can check. A bag-of-n-grams score cannot be explained that way.

So the model does three things:
- it **suggests** a likely pattern and a red-flag question to the agent;
- it **explains** by highlighting text in the console;
- it can **flag a disagreement** for human review ("model says likely scam, policy released").

It never releases, delays or blocks a payment, and it never writes a call signal.

## Intended use and out-of-scope use

**Intended use.**
- An advisory signal in Ruko safety-check calls (customer turns).
- The public "Is this a scam?" text checker, paired with plain-language wording ("warning signs", never "safe").
- Explanations in the console.

**Out of scope.**
- Automated payment decisions.
- Scoring people.
- Languages it was not trained on.
- Long documents or e-mail threads (input is capped at 5,000 characters).
- Using P(scam) as a real-world probability.
- Using the twins-merged or category accuracy as if it were exact-pattern accuracy.

## Ethics and privacy

- PII is redacted before any feature is built. Responses carry spans and placeholder tokens, never raw numbers, handles or URLs.
- The runtime never logs input text.
- Training data includes no real victims' personal data. The real-world set is paraphrased and scrubbed, and third-party sets were scrubbed with the same rules.
- Synthetic data is labelled as synthetic everywhere.
- Hindi, Hinglish, ta, bn and mr in the pattern library are mostly LLM drafts awaiting native review. The classifier's Indic coverage is only as good as that data.

## Reproduce and update

See [`DATA_CARD.md`](DATA_CARD.md#how-to-reproduce). Then:
- `ml/train.py` writes the model, `ml/results/*.json` and the golden fixtures.
- `npx vitest run --config server/ml/vitest.config.ts` runs the TypeScript tests.
- `npx tsx server/ml/scripts/eval_runtime.ts` measures runtime latency and the fallback.

**Model versioning.**
- The model version is in the file.
- The SHA-256 is in the sidecar.
- The runtime refuses a featurizer-version mismatch.
- `training_data_sha256` records the exact `dataset.jsonl` used.
