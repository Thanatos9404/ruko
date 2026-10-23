# Ruko: Bolna × YC Symphony Buildathon submission

**Live:** https://ruko-symphony.vercel.app · **Code:** https://github.com/Thanatos9404/ruko · **Demo video (2:49):** https://drive.google.com/file/d/1f2OE-d3mbBMDU0lZkZFAH0jkTYVZXan4/view?usp=sharing · **Deck (PDF):** https://drive.google.com/file/d/1ZaWkebC4p3mi0jBwqFbbyIPVRdyTgppH/view?usp=sharing

These are the exact answers for the official form, which is due 31 October 2026. Copy each one as written. Anything in square brackets still needs filling in before you submit. The form's e-mail field takes the address you registered with; it is left out of this public copy.

| Form field | Answer |
|---|---|
| Team size | Just me |
| Name | Yashvardhan Thanvi |
| Project description (max 200 characters) | Ruko holds a risky bank or UPI payment while a Bolna voice agent calls the customer in their language, names the scam and blocks the payment if needed. For Indian banks, UPI apps and NBFCs. |
| Submission link (repo or live app) | https://github.com/Thanatos9404/ruko (live app: https://ruko-symphony.vercel.app) |
| Pitch deck or pitch video (Google Drive or Luma) | Demo video (2:49): https://drive.google.com/file/d/1f2OE-d3mbBMDU0lZkZFAH0jkTYVZXan4/view?usp=sharing · Pitch deck (PDF): https://drive.google.com/file/d/1ZaWkebC4p3mi0jBwqFbbyIPVRdyTgppH/view?usp=sharing (both on Google Drive, "Anyone with the link can view") |

## Project description

The recommended version is the one in the table above. It is 189 characters, counted with Python `len()` on the exact text, and it says what Ruko does and who it is for, in that order.

Two alternatives:

| Description | Characters |
|---|---|
| A voice check for risky payments: Ruko pauses the transfer, calls the customer in their language, names the scam and decides in about a minute. Built on Bolna for Indian banks and UPI apps. | 189 |
| Scam victims pay while a fraudster coaches them on another call. Ruko holds the payment and a Bolna agent calls them in Hindi or English to break the script. For Indian banks and NBFCs. | 185 |

## What the links show

- **https://ruko-symphony.vercel.app** is the landing page.
- **/demo** is a sandbox bank. Press Pay on the "CBI officer" scenario, then watch the recorded run. That replays a text-mode conversation through the live engine, takes about a minute and uses no Bolna credit. A live Bolna call needs an access code. <!--r:live.note-->Five live Bolna web calls on 23 Oct (4 English, 1 Hindi; 41.25¢ in all), each with a scripted text-to-speech customer, not a real person. Two ran the full flow and blocked the payment, including the first live Hindi call, where the policy was stricter than the agent; three ended on a safe hold after test set-up faults.<!--/r-->
- **/check** is the free "Is this a scam?" checker. It uses the official-advisory library plus an on-server text classifier. There is no LLM, and nothing the person types is stored.
- **/console** is the fraud-ops view. It shows transcripts with the evidence highlighted, the signals, the policy's reasons, the pattern library and the evaluation.

## If the form has a longer free-text field

> Ruko is a voice check of about a minute for risky bank and UPI payments, built on Bolna. When a payment looks coached, the bank sends it to Ruko's API. Ruko holds it, and a Bolna agent calls the customer in their language. The agent says the code word shown in their app first, so the call is hard to spoof. It asks whether anyone on another call is telling them what to do, names the scam with a cited official line and, with consent, calls a trusted family contact. A deterministic policy then releases, delays or blocks the payment. The model can make a decision stricter, never softer, and it never asks for an OTP or PIN. In text-mode tests (an LLM plays the customer), <!--r:version-->v5<!--/r--> caught <!--r:ho.catch-->15/18<!--/r--> scams on a held-out set frozen before any run, with <!--r:ho.fh-->2/10<!--/r--> false holds on genuine payments. <!--r:live.narration-->We have also made five live Bolna calls, with a scripted computer voice as the customer. Both calls that ran the full flow blocked the scam.<!--/r--> We have no customers or pilots yet.

The numbers between `r:` comment markers are filled in by `node deck/tools/build.mjs` from the published eval results, so they match the deck.
