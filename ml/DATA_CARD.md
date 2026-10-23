# Data card: Ruko text model (ruko-text v1)

Third-party sources, authors and licence links are also listed in the repository's [`NOTICE`](../NOTICE).

This card covers every dataset the Ruko text classifier was trained or evaluated on. For each one it gives the source, the licence, the size, the language and how the data was used. The candidates we checked and rejected are listed in [`research/datasets/DATASETS.md`](../research/datasets/DATASETS.md), and datasets that need a login (none of which is used) are in [`research/datasets/NEEDS_LOGIN.md`](../research/datasets/NEEDS_LOGIN.md).

**In short:** most training data is **synthetic**. That includes our own Nebius-generated set and the BothBosu dialogues. Real data enters training only as SMS, from the Mendeley smishing/ham set. The IMC25 real-smishing reports are used for evaluation; a training slice of them was tried and rejected, as `MODEL_CARD.md` explains. No real Indian *call* data with an open licence exists that we could find, so the call-transcript side of the model has only been trained and in-distribution-tested on synthetic calls. Read every number in [`MODEL_CARD.md`](MODEL_CARD.md) with that in mind.

## How to reproduce

```
uv venv ml/.venv --python 3.12 && uv pip install --python ml/.venv -r ml/requirements.lock.txt
ml/.venv/Scripts/python -I -X utf8 ml/fetch_data.py      # third-party downloads -> ml/data/raw/ (git-ignored), SHA-256 pinned in ml/data_pins.json
ml/.venv/Scripts/python -I -X utf8 ml/prepare_data.py    # -> ml/work/dataset.jsonl (git-ignored); prints its SHA-256
ml/.venv/Scripts/python -I -X utf8 ml/train.py           # model + ml/results/*.json
```

The synthetic set can be rebuilt offline from the response cache (`ml/synth/generate.py --run --offline`), or regenerated from the frozen prompts in `ml/synth/briefs_v1.json` and `ml/synth/genuine_scenarios.json`.

## Processing applied to every source

- **PII scrubbing** (`ml/pii.py`). Phone numbers, UPI IDs and e-mails, account, card and Aadhaar numbers, and URLs are replaced with fixed dummy values. The featurizer maps each dummy to the same placeholder token (`xphone`, `xhandle`, `xnum`, `xurl`) that it gives the real value, so scrubbing never changes what the model sees. Generator placeholders such as `[phone]` and `[link]` are mapped the same way.
- **Speaker tags removed** (BothBosu `caller:`, `Suspect:` and so on). They are dataset artefacts and not present at runtime.
- **Splits are by group, not by row.**
  - Synthetic data is split by generation request: all samples from one LLM call land in the same split.
  - Third-party sets are split by message.
  - Any held-out row whose normalised text equals a training row is dropped.
  - IMC25 held-out reports that are near-duplicates (word-trigram Jaccard > 0.5) of a report in the IMC25 training slice are also dropped: 1,233 rows. That slice is used only by the rejected variant, but the held-out sets are kept identical for every model.

## Training data (the shipped model, experiment `main`)

| Source | Licence | Rows used in train / val | Language | Real or synthetic | Label mapping |
|---|---|---|---|---|---|
| **Ruko synthetic set v1** (`ml/data/synthetic/ruko_synth_v1.jsonl`, generator A = Qwen3-235B-A22B-Instruct-2507 on Nebius) | MIT (this repo) | 6,974 / 662 (train includes 1,861 early-call windows at weight 0.5) | en, hi, Hinglish, mr, bn, ta | **Synthetic.** Every row is labelled `synthetic: true` | scam (pattern id) / genuine / hard_negative |
| [BothBosu scam-dialogue, single-agent, multi-agent](https://huggingface.co/datasets/BothBosu/scam-dialogue) (Gumphusiri & Triyason, WI-IAT 2024) | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | 3,384 / 521 (weight 0.5) | en (US scam types) | Synthetic (Llama-3-70B) | label 1 → scam, 0 → genuine. Scam vs genuine only, no pattern. |
| [Mendeley f45bkkt8pr SMS phishing](https://data.mendeley.com/datasets/f45bkkt8pr/1) (Mishra & Soni, 2022, doi:10.17632/f45bkkt8pr.1); its genuine rows largely come from the [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) (Almeida & Gómez Hidalgo, 2011, doi:10.24432/C5CC84, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 3,101 / 570 | en | Real SMS. The smishing texts were OCR'd from images posted online, and the set overlaps the UCI SMS Spam Collection. | smishing → scam; ham → genuine; spam → **excluded** (used only to measure the marketing-spam flag rate) |

**Not in the shipped model, used only by the rejected variant `variant_imc02_hn2`:** [IMC25 "Fishing for Smishing"](https://github.com/reportsmishing/Smishing-Dataset-IMC25) (Agarwal et al., ACM IMC 2025, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). This is a deterministic 12% slice of the non-Indian English reports: 2,012 rows at weight 0.2, real smishing from public user reports. The source's entity placeholders are mapped to our dummies or removed. It raised recall on real smishing but also raised false alarms on genuine look-alike messages, so the shipped model leaves it out. See the model card.

### The synthetic set in detail (8,361 samples)

**Generation** (`ml/synth/generate.py`).

Scam samples are generated from the cited pattern definitions in the library: summary, typical claims, documented coaching phrases and red flags. The briefs are frozen in `ml/synth/briefs_v1.json`.

Genuine samples come from 54 hand-written scenarios in `ml/synth/genuine_scenarios.json`:
- 28 ordinary payments: rent, family support, school fees, a hospital bill, a vendor, EMI, a house deposit and so on.
- 10 hard negatives: a real bank fraud-team call, a relative really in hospital, someone who ignored a scam call and is now paying rent, an official challan, official customs duty, a big genuine investment, a real job fee, a surprise gift kept secret, KYC done at the branch, and a bank-confirmed wrong-transfer reversal.
- 16 genuine look-alike message categories (1,275 messages): bank alerts, OTPs, awareness messages, KYC reminders, card dues, deliveries, utility bills, telecom, government credits, travel, appointments, salary and investments, refunds, brand promotions, family money chats, and FASTag/e-challan. These were added in round 2 after round 1 showed false positives on genuine transactional SMS. Later batches rotate through 55 named senders and 8 writing styles so they are not near-copies.

In round 2d we added 1,784 **contrastive scam messages** for every pattern. They name the same real senders (SBI, HDFC, PhonePe, Tata Power and others), so the model has to learn the intent (block threats, links to "update", pay-to-receive) rather than "a bank name means genuine".

**Formats.**
- `call_check`: a Ruko safety-check call. The model sees only the customer's turns.
- `call_window`: an early window of the call, used for training only.
- `message`: a scam SMS, WhatsApp, Telegram or e-mail message, or a scam call opening; or a genuine message.
- `report`: a person describing events to the "Is this a scam?" line.

**Coaching levels for scam calls.**
- 0: open; the victim explains.
- 1: partly coached; details leak.
- 2: heavily coached; the victim sticks to a cover story.

**Languages.** en 3,365; Hinglish (romanised) 2,525; hi (Devanagari) 2,083; mr 154; bn 119; ta 115.

**Formats (rows).** message 4,962; call_check 1,718; report 1,681; plus 1,861 call_window training augmentations.

**Kinds.** scam 5,220; genuine 1,376; hard_negative (genuine but scam-like, including the look-alike messages) 1,765.

**Patterns.** All 72 library patterns. Generator A wrote 25 scam samples for each of the 18 English-only global patterns and 73–80 for each India pattern across languages.

**Generator B (held out).** `google/gemma-3-27b-it` wrote 1,069 samples (598 scam, 471 genuine) from the same briefs. They are never trained on and are used only as a **cross-generator** test, to catch the model learning one LLM's writing style.

**Quality filters.**
- A script check per language: Hinglish must be over 95% Latin letters; hi and mr over 50% Devanagari.
- Length must be 20–2,500 characters.
- Calls need at least 2 customer turns.
- Truncated JSON is salvaged to its complete samples only.

**Cost.** 2,760 Nebius requests: 1.74M prompt and 2.73M completion tokens, cumulative, from `ml/data/synthetic/generation_log.json`. Library translations and Hinglish fixes added about 100 more requests. No dollar figure is stated here; check it against Nebius's price list.

**Known limits.**
- LLM dialogues are cleaner than real speech-recogniser output.
- Hindi and Hinglish register varies by generator.
- A few ta/bn/mr samples are code-mixed with English.
- Scam and genuine prompts differ in framing, which is a possible shortcut. The cross-generator test and the real-world sets exist to expose it.

## Evaluation-only data (never trained on)

| Set | Source and licence | Size after cleaning | What it measures |
|---|---|---|---|
| `test_synthetic_A` | Our synthetic, generator A, held-out request groups | 1,517 (992 scam / 525 genuine) | In-distribution |
| `test_genB_cross_generator` | Our synthetic, generator B (Gemma-27B) | 1,069 (598 / 471) | Cross-generator generalisation |
| `test_mendeley_real_sms` | Mendeley, held-out messages | 1,578 (142 / 1,436) | Real SMS, same source as training |
| `test_bothbosu` | BothBosu, held-out dialogues | 895 | Same source as training |
| `ood_realworld_curated` | **Ours**: items paraphrased from real cases and messages in RBI, NPCI, I4C, CERT-In, PIB Fact Check and news reports (2022–2026). Each row cites its URL. Licence: **our paraphrases (MIT); facts from the cited sources.** | 165 (124 / 41); hi 82, en 80, Hinglish 3 | Real Indian scam scripts and victim accounts, plus pattern labels. Caveats: the genuine items are mostly first-person descriptions built from documented official procedures, not real messages; and paraphrasing was done by an LLM agent. |
| `ood_imc25_real_smishing_india` | IMC25, Indian network or Hindi/Urdu reports, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2,621 (all scam) | Recall on real Indian smishing |
| `ood_imc25_real_smishing_global` | IMC25, a second held-out 12% slice of non-Indian English, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 1,432 (all scam) | Recall on real global smishing |
| `ood_ridham115_indian_sms` | [Ridham115/indian-scam-sms-synthetic-audited](https://huggingface.co/datasets/Ridham115/indian-scam-sms-synthetic-audited), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 1,580 (797 / 783) | Indian SMS from **another team's** generators (Gemini, gpt-oss), with genuine look-alikes. The card warns that scam rows use invented domains; our featurizer replaces every URL with `xurl`, so that shortcut is unavailable. |
| `ood_skyaara_genuine_payment_sms` | [skyaara/indian-payment-sms-dataset](https://github.com/skyaara/indian-payment-sms-dataset) (SplitEasy contributors), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). We use only the `synthetic_rewrite` rows; the numeric variants collapse after digit normalisation. | 33 (all genuine) | False alarms on genuine Indian bank and UPI SMS |
| `ood_flowxai_en` | [flowxai/scamguardbench](https://huggingface.co/datasets/flowxai/scamguardbench) v0.2, English rows, [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | 378 (168 / 210) | False alarms on legitimate look-alikes (OTP, courier, family money requests) |
| `ood_icfd31k_calls` | [ICFD-31k](https://huggingface.co/datasets/rishia2220/icfd-31k) test and cross-domain splits under its [defensive-use terms](https://github.com/SPELLAILab/ICFD-31k/blob/main/LICENSE-DATA.md). **Evaluation only, never trained on**: the terms forbid commercial deployment without the authors' permission. | 5,500 (5,438 / 62) | Recall on Indian English/Hinglish fraud calls between a scammer and a victim. The 62 rows ICFD labels non-fraud are still conversations *about* a scam (for example a customer reporting one to their bank), so FPR and AUROC on this set are not meaningful. |
| `ood_marketing_spam_flag_rate` | Mendeley "spam" rows | 451 | How often unsolicited marketing is called a scam. Not a scam metric. |

**Revision of the real-world set before publication (23 Oct 2026).**
- Row `rwe_0148` was dropped: a first-person account built around a real case that ended in a death.
- We fetched each cited page and checked for shared word runs. 155 of 165 rows could be checked; FTC pages and one news page block automated fetching.
- Rewritten: every row sharing 8 or more consecutive words with its source, plus the 10 rows we could not check. After revision, no row shares more than 9 consecutive words with its source.
- Scrubbed in both the text and the provenance notes:
  - people's names and scammer aliases → a role or `[name]`;
  - street, sector, neighbourhood, police-station and employer details → removed (city, district or state kept).
- What changed and why is logged in `ml/data/realworld/REVISION_LOG.json`; the script is `ml/realworld_revise.py`.
- The set is evaluation-only, so the model did not change. All models were re-scored on the revised set. On it the shipped model scores AUROC 0.957, versus 0.933 on the 166-row version.

## What the data does not cover

- **No real Indian call audio or transcripts.** All call-side training data is synthetic.
- **Real speech-recogniser output is missing.** No ASR errors, disfluencies or code-switch transcription errors from Bolna's actual speech-to-text appear in training.
- **Languages.** Coverage beyond en/hi/Hinglish is thin. mr, bn and ta have about 115–155 synthetic rows each, and there are no Telugu, Kannada, Malayalam or Gujarati rows. Ridham115 includes some te/ta/bn/mr code-mixed SMS, but only in evaluation.
- **Some library patterns rest on news reports only.** Seven India patterns have no official source we could open: AePS, APK malware, e-challan APK, fake cybercrime notice, LPG, Ponzi and wrong-transfer. See `provenance` in `library.json`.
