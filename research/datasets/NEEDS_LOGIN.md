# Datasets that need a login (not used)

Ruko's rules: no accounts, no sign-ins, no tokens, no spending. The datasets below can't be downloaded anonymously, so **none of them is used** in training or evaluation. Each entry says what a person on the team would have to do to fetch it, and what they must check before using it.

Checked on 17 Oct 2026.

## Hugging Face, gated ("agree to share your contact information")

The API reports `gated: auto`, and file requests without a token return HTTP 401.

| Dataset | What it is | Licence (as stated) | Why it would matter |
|---|---|---|---|
| [JimmyMa99/TeleAntiFraud](https://huggingface.co/datasets/JimmyMa99/TeleAntiFraud) | TeleAntiFraud-28k: Chinese telecom-fraud call audio with text (`binary_classification.zip` 60 KB, `audio.zip` 12.7 GB) | Apache-2.0 | Real-style fraud and normal calls, but in Chinese. Mainly a check on the method, not a source of Indian data. |
| [Chouoftears/Fraud-R1-LLM-Defense-Fraud-Benchmark](https://huggingface.co/datasets/Chouoftears/Fraud-R1-LLM-Defense-Fraud-Benchmark) | Fraud-R1: tests whether LLMs resist fraud and phishing (English and Chinese) | MIT | Robustness ideas for the voice agent. Not a classifier training set. |

**To fetch:**

1. Sign in to huggingface.co.
2. Open the dataset page and accept the access conditions.
3. Create a read token under Settings, then Access Tokens.
4. Set it only in your own shell (`HF_TOKEN=...`). Never put it in `.env` files that are committed.
5. Download with `huggingface-cli download <id> --repo-type dataset --local-dir ml/data/raw/<id>/`. That folder is git-ignored.
6. Before using the data, re-read the licence and the dataset card. TeleAntiFraud is Chinese-language, so it would need its own evaluation slice.

## Kaggle (every download needs a signed-in account)

- **Kaggle copies of datasets we already fetch from the original publisher.** For example, "SMS Spam Collection Dataset" (uciml/sms-spam-collection-dataset) is the UCI corpus. We take that corpus from UCI and Mendeley Data instead, where it is public and CC BY 4.0. There is no reason to sign in to Kaggle for these.
- **The "fraud call India" style datasets on Kaggle.** We searched on 17 Oct 2026 and could not confirm a specific Kaggle dataset of Indian fraud-call transcripts with a stated licence. So we don't list one here, rather than guess a URL.

**If someone finds one later:**

1. Sign in to kaggle.com and open the dataset page.
2. Check the licence shown in the sidebar. If it is "Unknown" or "Other" with no terms, do not use it.
3. Click Download and save the zip to `ml/data/raw/kaggle/<dataset-slug>.zip`. That folder is git-ignored.
4. Add a loader to `ml/prepare_data.py` and a row to `ml/DATA_CARD.md`, with the licence and the SHA-256 of the zip.

## Public, but restricted terms (used for evaluation only)

These download without a login. They are listed here because their terms limit how Ruko may use them.

| Dataset | Terms | How Ruko uses it |
|---|---|---|
| [rishia2220/icfd-31k](https://huggingface.co/datasets/rishia2220/icfd-31k) (ICFD-31k, IJCAI-ECAI 2026; code at [SPELLAILab/ICFD-31k](https://github.com/SPELLAILab/ICFD-31k)) | [LICENSE-DATA.md](https://github.com/SPELLAILab/ICFD-31k/blob/main/LICENSE-DATA.md): defensive research and benchmarking are allowed; commercial deployment needs the authors' written permission | **Evaluation only.** `ml/fetch_data.py` downloads the test and cross-domain shards, and they are never committed. The shipped model is not trained on them. Training on ICFD-31k would first need the authors' written permission. |
