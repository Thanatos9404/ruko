# Ruko progress log

Newest first. Wallet figures come from Bolna's `GET /user/me` (free); 500 = $5.00.

## 16 Oct 2026, ~01:45 IST: engine, Bolna agents and eval harness

**What works**
- Ruko API (`/v1/checks`) with a transparent risk policy: every point of the score comes from a named rule with a plain-language reason. It also has idempotency keys, tenant API keys and a per-check client secret for the customer's app.
- Bolna custom-function endpoints (`get_check_context`, `record_signal`, `call_trusted_contact`, `check_trusted_contact`, `set_decision`, plus the contact-agent and public-line tools). They check a bearer token and, optionally, Bolna's published source IPs.
- The decision policy is deterministic. The agent's recommendation can make the outcome stricter, but never more lenient than the recorded evidence.
- Webhook receiver: secret-token URL, idempotent per execution and status. It re-reads every terminal execution from Bolna's API, so a forged webhook body can't change a decision.
- Gate in front of every paid call: an access code, a daily cap, a per-visitor cap, and a wallet floor read from `/user/me` before each session.
- The three Bolna agents (payment safety check, trusted contact, public safety line) were created through the API. All saved with `restricted: false`. Only flat-rate preferred models; English and Hindi with mid-call switching.
- 12-pattern scam library built from official sources (MHA/I4C, RBI, CERT-In, DoT/TRAI, SEBI, NPCI), with English and Hindi "truth" sentences and per-pattern citations.
- Text-mode eval harness on Nebius: 96 scenarios across 10 scam types, 8 genuine payment types and 6 ambiguous cases, in English, Hindi and Hinglish, at two coaching levels.
  - A 12-scenario smoke run caught 12 of 12 correctly: every scam held, no false holds, no OTP or PIN requests.
  - This is a smoke run, not the headline result. The full run comes next.
- 47 tests pass; type checks and lint are clean.

**Next**
- Tighten the call to under 60 seconds.
- Run the full eval.
- Build the demo PSP app, console, public checker (text mode on Nebius) and landing page.

**Wallet:** 500 (no paid calls yet).
