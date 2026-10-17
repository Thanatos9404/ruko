# Public scam datasets: what we checked and what Ruko uses

Checked on 17 Oct 2026. Hugging Face entries were verified through the public API (`https://huggingface.co/api/datasets/<id>`), which gives the licence field, gated status and file sizes. We also read each README and sent anonymous HEAD requests for the files. Mendeley Data entries were verified through `https://data.mendeley.com/public-api/datasets/<id>`. Sizes are the published file sizes. Row counts are as stated in the card, or as counted after download where we downloaded the data.

**Decision key**
- **train**: the shipped model learns from it.
- **eval**: a held-out test set only.
- **no**: not used, with the reason given.

The decisions that matter, and how each source is used, are in [`ml/DATA_CARD.md`](../../ml/DATA_CARD.md).

## Used

| Dataset | Licence | Size | Language | Real or synthetic | Decision |
|---|---|---|---|---|---|
| Ruko synthetic set v1 (ours: `ml/data/synthetic/`) | MIT (this repo) | see DATA_CARD | en, hi, Hinglish, ta, bn, mr | **Synthetic**, generated on Nebius from the cited pattern library | train (generator A); eval (generator B, a different model family) |
| Ruko real-world set (ours: `ml/data/realworld/`) | MIT for our paraphrases; each row cites its source URL | see DATA_CARD | en, hi, Hinglish | Real cases and messages from advisories, fact-checks and news, **lightly paraphrased** with PII removed | eval only |
| [Mendeley f45bkkt8pr, "SMS Phishing Dataset for ML and Pattern Recognition"](https://data.mendeley.com/datasets/f45bkkt8pr/1) (Mishra & Soni, 2022) | CC BY 4.0 | 245 KB zip; 5,971 SMS (4,844 ham, 638 smishing, 489 spam) | en | Real SMS. Smishing texts were OCR'd from images posted online. It overlaps heavily with the UCI SMS Spam Collection ([systematic review, arXiv 2604.11429](https://arxiv.org/pdf/2604.11429)) | train and test (split by message). Smishing counts as scam, ham as genuine. Marketing spam is kept out of training and only used to measure how often promotions get flagged. |
| [BothBosu/scam-dialogue](https://huggingface.co/datasets/BothBosu/scam-dialogue) | Apache-2.0 | 2.3 MB; 1,600 dialogues | en (US) | Synthetic (Llama-3-70B) | train (weight 0.5, scam vs genuine only) and test |
| [BothBosu/multi-agent-scam-conversation](https://huggingface.co/datasets/BothBosu/multi-agent-scam-conversation) | Apache-2.0 | 4.8 MB; 1,600 dialogues | en (US) | Synthetic (two LLM agents) | train (weight 0.5) and test |
| [BothBosu/single-agent-scam-conversations](https://huggingface.co/datasets/BothBosu/single-agent-scam-conversations) | Apache-2.0 | 2.4 MB; 1,600 dialogues | en (US) | Synthetic | train (weight 0.5) and test |
| [Ridham115/indian-scam-sms-synthetic-audited](https://huggingface.co/datasets/Ridham115/indian-scam-sms-synthetic-audited) | CC BY 4.0 | 390 KB; 1,580 SMS (797 scam, 783 safe) | Hinglish, en, hi, bn/mr/te/ta code-mixed | Synthetic: Gemini and gpt-oss-120b, partly audited by hand. Includes genuine look-alikes. | eval only: an Indian SMS set from a different team and different generators |
| [rishia2220/icfd-31k](https://huggingface.co/datasets/rishia2220/icfd-31k) (ICFD-31k, IJCAI-ECAI 2026) | Restricted [defensive-use terms](https://github.com/SPELLAILab/ICFD-31k/blob/main/LICENSE-DATA.md) | test 2.1 MB + cross-domain 0.6 MB (zstd); 4,500 + 1,000 calls | en / Hinglish | Synthetic Indian fraud calls (about 99% fraud in these splits) | eval only. Its terms forbid commercial deployment without permission, so we measure recall on it and never train on it. |
| [flowxai/scamguardbench](https://huggingface.co/datasets/flowxai/scamguardbench) v0.2 | Apache-2.0 | 0.6 MB; we keep only the English rows | en (+ro dropped) | Mostly synthetic, with "legit confusable" look-alikes (bank OTPs, courier notices, family money requests) | eval only: tests hard negatives |

## Checked, not used

| Dataset | Licence | Why not |
|---|---|---|
| [UCI SMS Spam Collection #228](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) | CC BY 4.0 | Real, but the Mendeley set above already contains most of it with a smishing label. Using both would duplicate data. |
| [redasers/difraud](https://huggingface.co/datasets/redasers/difraud) | MIT | Long-form emails, job ads, reviews and fake news. Its SMS part is UCI-derived. Off-domain for short payment conversations. |
| [ysangam/Indian_Cyber_Scam_PhoneCall_Hinglish_Dataset](https://huggingface.co/datasets/ysangam/Indian_Cyber_Scam_PhoneCall_Hinglish_Dataset) | Apache-2.0 | About 10k rows, but the card gives no provenance or generation method. We can't tell whether it is real, synthetic or scraped, so we leave it out. |
| [anmolshrivastav/scam_ham_india_14_languages](https://huggingface.co/datasets/anmolshrivastav/scam_ham_india_14_languages) | MIT | Synthetic, 14 Indian languages, 14k rows. A candidate for a future multilingual eval. Not needed for v1, which covers ta/bn/mr with our own data and Ridham115. |
| [anmolshrivastav/scam-ham-india](https://huggingface.co/datasets/anmolshrivastav/scam-ham-india) | Apache-2.0 | Mix of real and synthetic without row-level provenance. 2,272 rows. |
| [sidzzz07/scamshield-dataset](https://huggingface.co/datasets/sidzzz07/scamshield-dataset) | MIT | 86k rows, but machine-generated and crowdsourced rows are mixed. The card does not trace sources. |
| [Him1304/scamshield-scam-detection-data](https://huggingface.co/datasets/Him1304/scamshield-scam-detection-data) | MIT (re-licensed) | Built from Kaggle copies of UCI and EMSCAD. We prefer the original publishers. |
| [nini654](https://huggingface.co/datasets/nini654/hinglish-scam-text-dataset) / [bolewara](https://huggingface.co/datasets/bolewara/hinglish-scam-text-dataset) hinglish-scam-text | CC BY 4.0 | The two files are identical (same 472,689 bytes). Mostly UCI plus 35 hand-written Hinglish rows. |
| [karanverma19/Indian_Multilingual_Scam_Message_Dataset](https://huggingface.co/datasets/karanverma19/Indian_Multilingual_Scam_Message_Dataset) | Apache-2.0 | 120 rows. Too small to matter. |
| [vnovaai/INDIA_FRAUD_DETECTION_JSONL_V1](https://huggingface.co/datasets/vnovaai/INDIA_FRAUD_DETECTION_JSONL_V1) | CC BY 4.0 | 100 synthetic scenario descriptions, not messages. |
| [CloveAI/india-spam-sms](https://huggingface.co/datasets/CloveAI/india-spam-sms) | MIT | About 20k rows, but the README carries no description or provenance. |
| [shakeleoatmeal/phone-scam-detection-synthetic](https://huggingface.co/datasets/shakeleoatmeal/phone-scam-detection-synthetic) | MIT | 1,800 Llama-8B dialogues, US-centric. BothBosu already covers this ground. |
| [alusci/sms-otp-spam-dataset](https://huggingface.co/datasets/alusci/sms-otp-spam-dataset) | MIT | Synthetic OTP template messages. Labels describe delivery validity, not fraud. |
| [ealvaradob/phishing-dataset](https://huggingface.co/datasets/ealvaradob/phishing-dataset) | Apache-2.0 | 1.7 GB, mostly URLs and web pages. Off-domain. |
| [FredZhang7/all-scam-spam](https://huggingface.co/datasets/FredZhang7/all-scam-spam) | Apache-2.0 | Multilingual e-mail spam (67 MB). Off-domain. |
| [mshenoda/spam-messages](https://huggingface.co/datasets/mshenoda/spam-messages) | MIT | Merged from Kaggle copies of UCI and others. |
| [Deysi/spam-detection-dataset](https://huggingface.co/datasets/Deysi/spam-detection-dataset) | Apache-2.0 | Generic spam. No provenance. |
| [dbarbedillo/SMS_Spam_Multilingual_Collection_Dataset](https://huggingface.co/datasets/dbarbedillo/SMS_Spam_Multilingual_Collection_Dataset) | GPL | UCI machine-translated with M2M100. Copyleft data licence. |
| [shaw/scambench-training](https://huggingface.co/datasets/shaw/scambench-training) | CC BY-SA 4.0 | Share-alike, and aimed at agent-safety and prompt-injection. Off-domain. |
| [build-small-hackathon/jawbreaker-scam-defense-data](https://huggingface.co/datasets/build-small-hackathon/jawbreaker-scam-defense-data) | MIT | Synthetic text-generation data for an LLM guard. Not labelled payment conversations. |
| [BothBosu/Scammer-Conversation](https://huggingface.co/datasets/BothBosu/Scammer-Conversation), [youtube-scam-conversations](https://huggingface.co/datasets/BothBosu/youtube-scam-conversations) | Apache-2.0 | The first is an earlier generation of the sets above. The second is 55 KB. |
| [Mendeley vmg875v4xs, "Balanced Dataset for Spam and Smishing Detection using LLMs"](https://data.mendeley.com/datasets/vmg875v4xs) | CC BY 4.0 | 10,191 LLM-generated SMS. Not Indian. We already have a synthetic SMS eval in Ridham115. |
| TeleAntiFraud-28k, Fraud-R1 | Apache-2.0 / MIT | Gated; they need a login. See [NEEDS_LOGIN.md](NEEDS_LOGIN.md). |
