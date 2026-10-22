# Integration notes for the build agent

The research + ML owner wrote these notes. They cover how to wire the new pattern library (`data/patterns/`) and the text classifier (`server/ml/`) into the server, the voice agents and the console.

None of the files listed here is edited by the research + ML owner. Every change below is yours to make, and each can be done separately.

**Ground rule.** The classifier and the cue lexicon are **advisory evidence**. They can explain a decision, suggest a signal, rank patterns and make an outcome *stricter*. They must never release a payment on their own, and they must never block one on their own. The deterministic policy in `server/engine/decision.ts` stays in charge.

---

## 1. What ships

| Path | What it is |
|---|---|
| `data/patterns/library.json` | Versioned pattern library, validated against `library.schema.json` (60+ patterns, India and global). Its fields are a superset of `ScamPattern` in `shared/patterns.ts`. |
| `data/patterns/sources.json` | Every source cited by the library: URL, publisher, date, access date, whether it was fetched, and a paraphrased note. |
| `data/patterns/signal_cues.json` | Cue phrases in en, hi and Hinglish for each call signal in `shared/signals.ts`, plus negators. |
| `server/ml/index.ts` | Public API: `analyzeText()`, `mlStatus()`, `libraryPattern()`, `pick()`, `configureModel()`, `configureLibrary()`. |
| `server/ml/model/ruko-text-v1.json` (+ `.sha256`) | The model file: JSON, about 2 MB, checked against its SHA-256 at load. |
| `server/ml/__tests__/` and `server/ml/vitest.config.ts` | Tests: parity with the Python reference, golden cases in en, hi and Hinglish, fallbacks, PII and latency. |

The runtime is plain TypeScript with no new npm dependencies. It uses only `node:fs`, `node:crypto`, `node:path` and `node:url`.

## 2. Required config changes (your files)

1. **Bundle the data files with the Vercel function.** `server/ml` reads JSON at runtime, so add it to `vercel.json`:
   ```json
   "functions": {
     "api/router.ts": {
       "maxDuration": 30,
       "includeFiles": "{data/patterns/library.json,data/patterns/sources.json,data/patterns/signal_cues.json,server/ml/model/**}"
     }
   }
   ```
   If the model file is missing in production, nothing crashes. `analyzeText()` drops to `lexicon_only` mode and reports `engine.model_error`. Check `mlStatus()` on `/api/live/status` or a health route to catch this.
2. **Run the ML tests with the rest.** Add `"server/ml/__tests__/**/*.test.ts"` to `test.include` in `vite.config.ts`, or add a script: `"test:ml": "vitest run --config server/ml/vitest.config.ts"`.
3. **Ignore rules.** Nothing is needed in the root `.gitignore`. `ml/.gitignore` already covers `ml/.venv/`, `ml/__pycache__/`, `ml/data/raw/` (third-party downloads), `ml/.cache/` (the Nebius response cache) and `ml/work/`. If you'd like belt and braces, add `ml/data/raw/` and `ml/.cache/` to the root file as well.
4. **Optional: JSON imports.** If you prefer static imports over runtime file reads, import the JSON yourself and pass it in once at startup with `configureLibrary({ library, signalCues, sources })` and `configureModel(model)`.

## 3. Use the library alongside `shared/patterns.ts`

The 12 v0 ids are unchanged: `digital_arrest`, `courier_parcel`, `kyc_block`, `investment_trading`, `task_job`, `fake_support_refund`, `remote_access`, `electricity_disconnection`, `relative_emergency`, `prize_lottery`, `sim_disconnection`, `video_call_blackmail`. Existing eval scenarios, `pattern_hint` values and tool enums keep working.

New ids from research that duplicate v0 ones are stored as `aliases`. For example, `stock_ipo_trading_group` is an alias of `investment_trading`. `libraryPattern(id)` resolves aliases.

**Migration path (least risk first):**

1. **Read-only first.** Keep `PATTERNS` for the engine. Serve the library through `/api/console/patterns` and the public checker, using `getLibrary()`.
2. **Then switch the engine.** Replace `PATTERNS` with an adapter, which goes in your code (for example in `shared/patterns.ts`):
   ```ts
   import { getLibrary, pick } from "../server/ml/index.js";
   export const PATTERNS = getLibrary()!.patterns.map((p) => ({
     id: p.id,
     name: { en: p.name.en, hi: p.name.hi },
     summary: p.summary,
     indicators: p.indicators,
     typical_claims: p.typical_claims,
     signals: p.signals,                       // same signal-type -> weight shape
     keywords: p.keywords,                     // flat list, as before
     truth: p.truth,                           // en, hi, plus draft ta/bn/mr
     advice: { en: p.advice.en, hi: p.advice.hi },
     ask_next: { en: p.ask_next.en, hi: p.ask_next.hi },
     sources: p.sources,                       // ids now resolve in data/patterns/sources.json, not shared/sources.ts
   }));
   ```
   `sources` ids are strings from `sources.json`. All 29 v0 source ids are kept there unchanged, so `SourceId` can widen to `string`.
3. **Tool enums.** `server/bolna/tools.ts` builds `enum: ["none", ...PATTERNS.map(p => p.id)]`. With 60+ ids, that enum is long but valid. To keep the prompt small, you can send only `region === "india"` patterns, plus `"other"`, to Indian calls.

**Translation status.** Each pattern has `translation_status`:
- `source`: v0 text carried over.
- `machine_draft`: drafted by an LLM and awaiting native review.
- `draft`: the v0 ta/bn/mr text.

Speak `machine_draft` Hindi on calls only if you're comfortable that it is unreviewed. Otherwise use `truth.en` plus your agent's own live Hindi. The console should show a "draft translation" badge.

## 4. Call `server/ml` from the engine

```ts
import { analyzeText } from "../ml/index.js";
const a = analyzeText(text, { region: "india" });   // sync, ~1 ms; never throws; never logs text
// options: topK (default 3), explain (default true), region: "india" | "global" | "all" (default "all").
// Pass region "india" on Indian calls and the Indian public line: pattern candidates are then limited to the
// 54 Indian patterns (probabilities renormalised), so a UK/US pattern with a foreign "truth" sentence is never
// named. The scam probability and band are unaffected.
// a.scam_probability  0..1 calibrated (null in lexicon_only mode)
// a.band              "likely_scam" | "possible_scam" | "unlikely_scam" | "unknown"
// a.patterns[]        { id, name, category, p_given_scam, lexicon_score, cues[] (spans) }
// a.signals[]         { type (shared/signals.ts), hits[] (spans, negated flag) }
// a.evidence[] / counter_evidence[] / pattern_evidence[]   token spans with weights
```

**What text to pass.**
- In calls, pass **only the customer's turns**: the last 2–4 customer turns as a window, or all of them after the call. The model was trained on customer turns. Ruko's own questions are the same in scam and genuine calls, so they only add noise.
- For SMS or WhatsApp text, pass it as is.

### a) `record_signal` (`server/engine/toolHandlers.ts`)

After `deps.checks.recordSignal(...)`, run `analyzeText` on the check's evidence quotes joined with newlines. Do not add the new quote twice.

- **Missing pattern hint.** If the agent gave no `pattern_hint`, `a.patterns[0].p_given_scam >= 0.5` and `a.band !== "unlikely_scam"`, use `a.patterns[0].id` as a fallback hint for `guidance()`. This happens when `inferPattern` returns null. It lets `say_this` (the truth sentence) arrive earlier.
- **Return `ml_hint` to the agent:**
  ```json
  { "ml_hint": { "pattern": "<name>", "ask": "<red_flag_questions[lang][0]>" } }
  ```
  The question comes from the library: `pick(p.red_flag_questions, lang)`.
- **Never write ML output into `signals[]` as an agent signal.** Store it separately, for example as `check.ml = { scam_probability, band, patterns, model_version }`, so the audit log keeps the agent's evidence and the model's opinion apart.

### b) Transcript webhook (`server/bolna/webhook.ts`)

Once `call.transcript` is set, run `analyzeText` over the customer turns and store `check.ml_summary` (the same shape as above, plus `evidence` spans) for the console.

**Policy suggestion.** If `band === "likely_scam"` but the decision is `release` with no critical signal, add a console flag "model disagrees: review". Do **not** change the outcome automatically. That is in line with "stricter, never more lenient", which only the agent's evidence can trigger.

### c) Public text checker (`/api/public/text-check`) and `lookup_pattern`

Replace `matchText(text)` with:

```ts
const a = analyzeText(text, { topK: 3 });
const matches = a.patterns.map((m) => {
  const p = libraryPattern(m.id)!;
  return {
    id: p.id, name: pick(p.name, lang), probability: m.p_given_scam,
    truth: pick(p.truth, lang), advice: pick(p.advice, lang),
    red_flags: pick(p.red_flag_questions, lang),
    cues: m.cues.filter((c) => !c.negated),             // spans into `text` for highlighting
    sources: p.sources.map((s) => getSources().get(s)),
  };
});
return json({
  method: a.engine.mode === "model+lexicon"
    ? "on-server text classifier + cue lexicon (no LLM, nothing stored)"
    : "cue lexicon (no LLM, nothing stored)",
  band: a.band, scam_probability: a.scam_probability, matches,
  signals: a.signals, evidence: a.evidence, model_version: a.engine.model_version,
});
```

**Wording for the user.** Map `band` to plain language:
- `likely_scam`: "This looks like a known scam."
- `possible_scam`: "Some warning signs."
- `unlikely_scam`: "No known scam pattern found. Still never share OTP/PIN."

Never say "safe".

In `lookupPattern` (the public voice line), use `analyzeText(description)` in the same way. If `band === "unlikely_scam"` and there are no patterns, keep the existing "doesn't clearly match" answer.

## 5. What the voice agent's prompt should use

Use these library fields per pattern, in the call language via `pick(field, lang)`:

| Field | Use |
|---|---|
| `red_flag_questions` | The next question to ask once a pattern is suspected. Ask one at a time. They are written to surface the pattern **without** asking for an OTP, PIN or card number. |
| `coaching_phrases` | Things victims are told to say or do, such as "say it's for a family emergency", "don't tell the bank" or "stay on the video call". Add these to the agent's "listen for" list. If the customer says one, record `coached_on_call` or `secrecy_demand` with the quote. Highest value for the call agent. |
| `truth` | The one sentence said out loud to break the script. Already served through `say_this`; keep it that way. |
| `ask_next` | The v0 single follow-up question, kept for compatibility. |
| `advice` | Read out at the end, or sent by SMS after a block or delay. |

Don't put the whole library in the prompt. Serve fields through tool responses (`record_signal` → `guidance`), as you do now.

## 6. What the console should display

- **Check detail.**
  - Show the model's `band` and `scam_probability` (two decimals) next to the policy decision, labelled "model opinion (advisory)", with the model version.
  - Show the top 3 patterns with a `category` chip.
  - Highlight `evidence` spans (towards scam, warm colour) and `counter_evidence` spans (towards genuine, cool colour) in the transcript. Also highlight `cues` and `signals[].hits` (cue phrases). Show negated hits struck through.
  - Spans are UTF-16 offsets into the exact text you passed in, so slice the same string. The response never contains raw phone numbers, UPI IDs, account numbers or URLs; those become placeholder tokens.
- **Pattern library page.**
  - Use `getLibrary()`. Group by `category` and filter by `region`.
  - Per pattern, show `summary`, `channel`, `payment_rails`, `victim_profile`, `red_flag_questions`, `coaching_phrases`, `truth`, `first_seen`, `trend`, and the sources (title, publisher, date, link, "accessed" date).
  - Show `translation_status` badges for drafts.
- **Model card link.** Link to `ml/MODEL_CARD.md` and show the headline metrics from `ml/results/summary.json`, both in-distribution and out-of-distribution. Don't quote only the in-distribution number.

## 7. Privacy

- `analyzeText` does not log, store or send text anywhere.
- Don't log the response objects together with raw transcripts. The spans let you highlight without copying text.
- The featurizer redacts phone numbers, UPI IDs and e-mails, account, card and Aadhaar numbers, and URLs before any feature is built.

## 8. Re-training and updating

1. **Environment:**
   ```
   uv venv ml/.venv --python 3.12
   uv pip install --python ml/.venv -r ml/requirements.lock.txt
   ```
2. **Data:**
   ```
   ml/.venv/Scripts/python -I -X utf8 ml/fetch_data.py
   ml/.venv/Scripts/python -I -X utf8 ml/prepare_data.py
   ```
   `fetch_data.py` checks SHA-256 pins.
3. **Train:**
   ```
   ml/.venv/Scripts/python -I -X utf8 ml/train.py
   ```
   This writes the model, its `.sha256`, `ml/results/*.json` and the golden fixtures.
4. **Check the TS side:**
   ```
   npx vitest run --config server/ml/vitest.config.ts
   npx tsx server/ml/scripts/eval_runtime.ts
   ```
5. **Library changes:**
   ```
   data/patterns/build/build_library.py --stage merge
   data/patterns/build/translate.py
   data/patterns/build/build_library.py --stage final
   ```
   The final stage validates the schema and source references.
