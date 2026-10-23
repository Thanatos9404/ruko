# Ruko: Bolna × YC Symphony Buildathon submission

These are the exact answers for the official form, which is due 31 October 2026. Copy each one as written. Anything in square brackets still needs filling in before you submit.

| Form field | Answer |
|---|---|
| Team size | Just me |
| Name | Yashvardhan Thanvi |
| Email | [the email you registered with] |
| Project description (max 200 characters) | Ruko holds a risky bank or UPI payment while a Bolna voice agent calls the customer in their language, names the scam and blocks the payment if needed. For Indian banks, UPI apps and NBFCs. |
| Submission link (repo or live app) | https://ruko-symphony.vercel.app<br>[GitHub repository link, to add once the repo is public] |
| Pitch deck or pitch video (Google Drive or Luma) | [Google Drive link to `deck/Ruko-pitch.pdf` and the demo video. Set sharing to "Anyone with the link can view", then open the link in a private window to check it works] |

## Project description

The recommended version is the one in the table above. It is 189 characters, counted with Python `len()` on the exact text, and it says what Ruko does and who it is for, in that order.

Two alternatives:

| Description | Characters |
|---|---|
| A voice check for risky payments: Ruko pauses the transfer, calls the customer in their language, names the scam and decides in about a minute. Built on Bolna for Indian banks and UPI apps. | 189 |
| Scam victims pay while a fraudster coaches them on another call. Ruko holds the payment and a Bolna agent calls them in Hindi or English to break the script. For Indian banks and NBFCs. | 185 |

## What the links show

- **https://ruko-symphony.vercel.app** is the landing page.
- **/demo** is a sandbox bank. Press Pay on the "CBI officer" scenario, then watch the recorded run. That replays a text-mode conversation through the live engine, takes about a minute and uses no Bolna credit. A live Bolna call needs an access code.
- **/check** is the free "Is this a scam?" checker. It uses the official-advisory library plus an on-server text classifier. There is no LLM, and nothing the person types is stored.
- **/console** is the fraud-ops view. It shows transcripts with the evidence highlighted, the signals, the policy's reasons, the pattern library and the evaluation.

## If the form has a longer free-text field

> Ruko is a voice check of about a minute for risky bank and UPI payments, built on Bolna. When a payment looks coached, the bank sends it to Ruko's API. Ruko holds it, and a Bolna agent calls the customer in their language. The agent says the code word shown in their app first, so the call is hard to spoof. It asks whether anyone on another call is telling them what to do, names the scam with a cited official line and, with consent, calls a trusted family contact. A deterministic policy then releases, delays or blocks the payment. The model can make a decision stricter, never softer, and it never asks for an OTP or PIN. In text-mode tests (an LLM plays the customer), <!--r:version-->v5<!--/r--> caught <!--r:ho.catch-->15/18<!--/r--> scams on a held-out set frozen before any run, with <!--r:ho.fh-->2/10<!--/r--> false holds on genuine payments. We have no customers or pilots yet.

The numbers between `r:` comment markers are filled in by `node deck/tools/build.mjs` from the published eval results, so they match the deck.
