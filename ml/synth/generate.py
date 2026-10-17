"""
Generate Ruko's SYNTHETIC Indian scam / genuine dialogue set with Nebius Token Factory.

Every sample this script writes is LLM-generated and labelled synthetic=True.
Inputs are the official pattern definitions in data/patterns/library.json and the
genuine / hard-negative scenarios in ml/synth/genuine_scenarios.json.

Formats
  call_check  a Ruko safety-check call: Ruko asks neutral questions, the customer
              answers. Scam calls come at three coaching levels:
                0 open      the victim believes the fraudster and explains openly
                1 partial   the victim gives a cover story, but details leak
                2 heavy     the victim sticks to a coached cover story
  message     what the fraudster sends or says (SMS, WhatsApp, Telegram, call opening)
  report      a person describing what happened to a free "Is this a scam?" line

Generators: model A (training + in-distribution test) and model B (held out,
cross-generator test only). Responses are cached under ml/.cache/nebius (git-ignored),
so re-running is free and reproducible. The API key is read at runtime from the
NebiusXNvidia .env and is never printed or written anywhere.

Usage
  ml/.venv/Scripts/python -X utf8 ml/synth/generate.py --plan            # print the job plan and token estimate
  ml/.venv/Scripts/python -X utf8 ml/synth/generate.py --run [--limit N]  # generate (cached)
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))
from pii import scrub  # noqa: E402

NEBIUS_BASE = "https://api.tokenfactory.nebius.com/v1/"
NEBIUS_ENV_PATH = Path("C:/Desktop/COLLEGE/Coding/Hackathon/NebiusXNvidia/.env")
CACHE_DIR = ROOT / "ml" / ".cache" / "nebius"
LIBRARY = ROOT / "data" / "patterns" / "library.json"
GENUINE = ROOT / "ml" / "synth" / "genuine_scenarios.json"
OUT = ROOT / "ml" / "data" / "synthetic" / "ruko_synth_v1.jsonl"
LOG = ROOT / "ml" / "data" / "synthetic" / "generation_log.json"
# Pattern briefs are frozen the first time a pattern is generated, so later library edits
# (translations, merges, extra sources) never silently change or invalidate the synthetic set.
BRIEFS = ROOT / "ml" / "synth" / "briefs_v1.json"

MODEL_A = "Qwen/Qwen3-235B-A22B-Instruct-2507"
MODEL_B = "google/gemma-3-27b-it"
SYNTH_VERSION = 1

LANG_DESC = {
    "en": "Indian English as people actually speak on a phone call: simple, natural, a few Indian expressions.",
    "hi": "Hindi in Devanagari script, natural spoken register. Common English words (bank, account, OTP, UPI, app, link) may appear in Devanagari (बैंक, अकाउंट) or Latin letters, as real speakers mix them.",
    "hinglish": "Hinglish: Hindi-English code-mixed, written ONLY in Roman/Latin letters the way Indians type on WhatsApp or an English speech recogniser would transcribe it (e.g. 'haan ji, mere bete ki fees bharni hai'). No Devanagari.",
    "ta": "Tamil in Tamil script, natural spoken register, with the English words Tamil speakers really use (bank, OTP, account).",
    "bn": "Bengali in Bengali script, natural spoken register, with the English words Bengali speakers really use (bank, OTP, account).",
    "mr": "Marathi in Devanagari script, natural spoken register, with the English words Marathi speakers really use (bank, OTP, account).",
}

PERSONAS = [
    "retired schoolteacher, 68, Lucknow", "college student, 20, Pune", "homemaker, 45, Patna",
    "software engineer, 29, Bengaluru", "kirana shop owner, 50, Surat", "nurse, 34, Kochi",
    "farmer, 55, Nashik", "government clerk, 52, Bhopal", "auto-rickshaw driver, 40, Chennai",
    "retired bank officer, 66, Delhi", "delivery rider, 26, Hyderabad", "army veteran, 70, Dehradun",
    "schoolteacher, 38, Kolkata", "doctor, 44, Jaipur", "freelance designer, 31, Mumbai",
    "pensioner, 74, Chandigarh", "small-business owner, 47, Ludhiana", "BPO employee, 24, Noida",
    "widow living alone, 63, Varanasi", "shopkeeper, 58, Indore", "first-job graduate, 22, Guwahati",
    "chartered accountant, 36, Ahmedabad", "tuition teacher, 41, Kanpur", "IT manager, 39, Gurugram",
    "homemaker, 33, Coimbatore", "retired railway employee, 69, Nagpur", "MBA student, 25, Bhubaneswar",
    "tailor, 49, Ranchi", "real-estate agent, 43, Thane", "hotel cook, 37, Goa",
]

AMOUNTS = [3500, 7999, 12000, 18500, 25000, 49000, 75000, 99999, 150000, 240000, 375000, 500000, 820000, 1200000]

SYSTEM = (
    "You write realistic, varied SYNTHETIC training data for a payment-fraud classifier used by Indian banks. "
    "The data teaches a model to recognise scams and to NOT flag genuine payments. "
    "Never include real phone numbers, UPI IDs, account numbers, URLs or names of real private individuals; "
    "write [phone], [upi], [account] or [link] instead. Brands, banks and government bodies may be named. "
    "Output strict JSON only, no markdown."
)

RUKO_DESC = (
    "Ruko is the bank's automated safety assistant. A payment was held because it looked risky, and Ruko phones the customer "
    "for a 60-second check before releasing it. Ruko speaks calmly, asks one short neutral question at a time "
    "(what is the payment for, how do they know the payee, did someone contact them about it, is anyone on another call "
    "guiding them, were they told to keep it secret, did they install any app). Ruko NEVER asks for OTP, PIN, CVV, card number or passwords. "
    "Ruko does not accuse; it just asks."
)

COACHING = {
    0: "OPEN: the customer fully believes the fraudster and openly explains what they were told, because they think it is legitimate.",
    1: "PARTIALLY COACHED: the fraudster told the customer what to say. The customer starts with the cover story, but under Ruko's simple questions some details leak (hesitation, 'someone is on the other line', 'they said not to tell', vague about the payee, rushing).",
    2: "HEAVILY COACHED: the customer sticks to a cover story the fraudster gave them (for example 'it's for my nephew's fees', 'I know him personally', 'it's my own investment', 'nobody called me'). They are impatient and defensive. Only subtle cues remain: urgency, a payee they cannot really describe, a story that does not fit, a second call or someone prompting them, unusual amount.",
}


def read_key() -> str:
    if os.environ.get("NEBIUS_API_KEY"):
        return os.environ["NEBIUS_API_KEY"]
    m = re.search(r'^NEBIUS_API_KEY\s*=\s*"?([^"\r\n]+)"?', NEBIUS_ENV_PATH.read_text(encoding="utf-8"), re.M)
    if not m:
        raise SystemExit("NEBIUS_API_KEY not found")
    return m.group(1).strip()


_usage_lock = threading.Lock()
USAGE = {"requests": 0, "cached": 0, "prompt_tokens": 0, "completion_tokens": 0, "errors": 0}


def chat(model: str, user: str, *, temperature: float, max_tokens: int, seed: int, key: str | None) -> str:
    body = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
        "temperature": temperature,
        "top_p": 0.95,
        "max_tokens": max_tokens,
        "seed": seed,
        "response_format": {"type": "json_object"},
    }
    h = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    path = CACHE_DIR / h[:2] / f"{h}.json"
    if path.exists():
        with _usage_lock:
            USAGE["cached"] += 1
        return json.loads(path.read_text(encoding="utf-8"))["content"]
    if key is None:
        raise RuntimeError("cache miss in offline mode")
    for attempt in range(6):
        try:
            req = urllib.request.Request(
                NEBIUS_BASE + "chat/completions",
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            content = data["choices"][0]["message"]["content"] or ""
            usage = data.get("usage") or {}
            with _usage_lock:
                USAGE["requests"] += 1
                USAGE["prompt_tokens"] += usage.get("prompt_tokens", 0)
                USAGE["completion_tokens"] += usage.get("completion_tokens", 0)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"model": model, "content": content, "usage": usage}, ensure_ascii=False), encoding="utf-8")
            return content
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode(errors="replace")
            if e.code == 400 and "response_format" in msg and "response_format" in body:
                body.pop("response_format")
                continue
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 * 2**attempt + random.random())
                continue
            with _usage_lock:
                USAGE["errors"] += 1
            raise RuntimeError(f"Nebius HTTP {e.code}: {msg}")
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 * 2**attempt)
    with _usage_lock:
        USAGE["errors"] += 1
    raise RuntimeError("Nebius: retries exhausted")


def parse_json(content: str) -> dict:
    content = content.strip()
    content = re.sub(r"^```(?:json)?|```$", "", content, flags=re.M).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", content, re.S)
        if m:
            return json.loads(m.group(0))
        raise


# --- job planning -----------------------------------------------------------

def pattern_brief(p: dict) -> str:
    def lst(xs, k=6):
        return "; ".join(xs[:k]) if xs else "(none documented)"
    coaching = p.get("coaching_phrases", {})
    coach_en = coaching.get("en", []) if isinstance(coaching, dict) else coaching
    return (
        f"SCAM PATTERN: {p['name']['en']} (id {p['id']}, region {p['region']})\n"
        f"How it works (from official advisories): {p['summary']}\n"
        f"Channels: {', '.join(p.get('channel', []))}. Payment rails: {', '.join(p.get('payment_rails', []))}.\n"
        f"Typical victims: {p.get('victim_profile', 'general public')}\n"
        f"What the fraudster typically claims: {lst(p.get('typical_claims', []))}\n"
        f"What victims are coached to say or do: {lst(coach_en)}\n"
        f"Red flags: {lst(p.get('indicators', []))}"
    )


def scenario_brief(s: dict) -> str:
    return (
        f"GENUINE SITUATION ({'hard negative: contains scam-like words but is genuine' if s['kind'] == 'hard_negative' else 'ordinary genuine payment'})\n"
        f"Purpose: {s['purpose']}\nPayee: {s['payee']}\nDetails: {s['details']}"
    )


def make_prompt(job: dict, brief: str) -> str:
    n, lang, fmt = job["n"], job["lang"], job["format"]
    rng = random.Random(job["key"])
    personas = rng.sample(PERSONAS, n)
    amounts = [rng.choice(AMOUNTS) for _ in range(n)]
    lang_line = f"LANGUAGE for every sample: {LANG_DESC[lang]}"
    scam = job["label"] == "scam"
    if fmt == "call_check":
        who = (
            f"The customer is a victim of the scam below. Coaching level: {COACHING[job['coaching']]}"
            if scam
            else "The customer is making a GENUINE payment as described below. They answer consistently and concretely (they know the payee, why, and how). "
            "Some are busy or mildly annoyed at the delay; that alone is not a sign of fraud."
        )
        return (
            f"{brief}\n\n{RUKO_DESC}\n\n"
            f"Write {n} DIFFERENT transcripts of this safety-check call. {who}\n"
            f"Each transcript: 6-10 turns alternating speaker 'ruko' and 'customer', starting with ruko. Customer turns are 1-3 short spoken sentences, "
            f"with natural hesitations, as a speech recogniser would transcribe them (light punctuation).\n"
            f"Customer personas, one per transcript: {personas}. Held amounts in rupees: {amounts}.\n"
            f"{lang_line}\n"
            'Return JSON: {"samples": [{"turns": [{"speaker": "ruko"|"customer", "text": "..."}], "cover_story": "<short, or empty>"}]}'
        )
    if fmt == "message":
        if scam:
            what = (
                "messages or call openings a FRAUDSTER would use for this pattern. Mix channels: SMS, WhatsApp, Telegram, e-mail subject+body, "
                "and the opening lines a scam caller says on the phone. Vary length (1-6 sentences), tone and brand names; include the typical tricks "
                "(urgency, threats, rewards, links written as [link], numbers as [phone])."
            )
        else:
            what = (
                "GENUINE messages related to this situation that a customer could receive or send: real bank alerts, official reminders, "
                "family or business chats about the payment, receipts, booking confirmations. Some may mention OTP, fraud, police, urgency or "
                "fees in a genuine, non-scam way. They must NOT be scams."
            )
        return (
            f"{brief}\n\nWrite {n} DIFFERENT {what}\n{lang_line}\n"
            'Return JSON: {"samples": [{"channel": "sms|whatsapp|telegram|email|call_opening|chat", "text": "..."}]}'
        )
    if fmt == "report":
        if scam:
            what = (
                "first-person descriptions a person would type or say to a free 'Is this a scam?' helpline, describing what happened to them "
                "in this pattern. They do not name the scam type; they describe events, what they were told, and what they are about to pay. "
                "Some are worried, some are convinced it's real, some are unsure."
            )
        else:
            what = (
                "first-person descriptions a person would type or say to a free 'Is this a scam?' helpline about this GENUINE situation, "
                "asking whether it is safe. The situation is genuine and the details show it (verified payee, official channel, no secrecy)."
            )
        return (
            f"{brief}\n\nWrite {n} DIFFERENT {what} 2-5 sentences each. Speakers, one per sample: {personas}.\n{lang_line}\n"
            'Return JSON: {"samples": [{"text": "..."}]}'
        )
    raise ValueError(fmt)


def plan_jobs(library: dict, genuine: dict) -> list[dict]:
    jobs: list[dict] = []
    extra_langs = ["ta", "bn", "mr"]

    def add(**kw):
        kw["key"] = "|".join(str(kw[k]) for k in ("generator", "label", "ref", "format", "lang", "coaching", "rep"))
        jobs.append(kw)

    for p in library["patterns"]:
        india = p["region"] == "india"
        langs = ["en", "hi", "hinglish"] if india else ["en"]
        for lang in langs:
            for c in (0, 1, 2):
                add(generator="A", label="scam", ref=p["id"], format="call_check", lang=lang, coaching=c, n=2, rep=0)
            add(generator="A", label="scam", ref=p["id"], format="message", lang=lang, coaching=None, n=5, rep=0)
            add(generator="A", label="scam", ref=p["id"], format="report", lang=lang, coaching=None, n=4, rep=0)
        if india:
            xl = extra_langs[int(hashlib.sha1(p["id"].encode()).hexdigest(), 16) % 3]  # stable as the library grows
            add(generator="A", label="scam", ref=p["id"], format="call_check", lang=xl, coaching=1, n=2, rep=0)
            add(generator="A", label="scam", ref=p["id"], format="report", lang=xl, coaching=None, n=3, rep=0)
        # held-out generator B: cross-generator test only
        add(generator="B", label="scam", ref=p["id"], format="call_check", lang="en", coaching=1, n=2, rep=0)
        add(generator="B", label="scam", ref=p["id"], format="message", lang="en", coaching=None, n=4, rep=0)
        if india:
            add(generator="B", label="scam", ref=p["id"], format="report", lang="hinglish", coaching=None, n=3, rep=0)

    for idx, s in enumerate(genuine["scenarios"]):
        for lang in ("en", "hi", "hinglish"):
            add(generator="A", label="genuine", ref=s["id"], format="call_check", lang=lang, coaching=None, n=3, rep=0)
            add(generator="A", label="genuine", ref=s["id"], format="message", lang=lang, coaching=None, n=5, rep=0)
            add(generator="A", label="genuine", ref=s["id"], format="report", lang=lang, coaching=None, n=4, rep=0)
        xl = extra_langs[idx % 3]
        add(generator="A", label="genuine", ref=s["id"], format="call_check", lang=xl, coaching=None, n=2, rep=0)
        add(generator="A", label="genuine", ref=s["id"], format="report", lang=xl, coaching=None, n=3, rep=0)
        add(generator="B", label="genuine", ref=s["id"], format="call_check", lang="en", coaching=None, n=2, rep=0)
        add(generator="B", label="genuine", ref=s["id"], format="report", lang="hinglish", coaching=None, n=3, rep=0)
        add(generator="B", label="genuine", ref=s["id"], format="message", lang="en", coaching=None, n=4, rep=0)
    return jobs


# --- quality filters ------------------------------------------------------------
_DEV = re.compile(r"[\u0900-\u097F]")
_TAM = re.compile(r"[\u0B80-\u0BFF]")
_BEN = re.compile(r"[\u0980-\u09FF]")
_LAT = re.compile(r"[A-Za-z]")


def script_ok(text: str, lang: str) -> bool:
    letters = len(_DEV.findall(text)) + len(_TAM.findall(text)) + len(_BEN.findall(text)) + len(_LAT.findall(text))
    if letters == 0:
        return False
    share = lambda rx: len(rx.findall(text)) / letters  # noqa: E731
    if lang == "hinglish":
        return share(_LAT) > 0.95
    if lang in ("hi", "mr"):
        return share(_DEV) > 0.5
    if lang == "ta":
        return share(_TAM) > 0.5
    if lang == "bn":
        return share(_BEN) > 0.5
    return share(_LAT) > 0.9


PLACEHOLDER_FIX = [
    (re.compile(r"\[(?:phone|mobile|number|phone number)\]", re.I), "+91 90000 00000"),
    (re.compile(r"\[(?:upi|upi id)\]", re.I), "payee@upi"),
    (re.compile(r"\[(?:account|account number|acct)\]", re.I), "000000000000"),
    (re.compile(r"\[(?:link|url)\]", re.I), "http://example.invalid/x"),
]


def clean_text(t: str) -> str:
    """Map generator placeholders onto values the featurizer redacts exactly like real PII, then scrub any leaked PII."""
    for rx, rep in PLACEHOLDER_FIX:
        t = rx.sub(rep, t)
    return scrub(t).strip()


def samples_from(job: dict, obj: dict) -> list[dict]:
    out = []
    for i, s in enumerate(obj.get("samples", [])[: job["n"] + 1]):
        rec = {
            "id": f"syn{SYNTH_VERSION}-" + hashlib.sha1(f"{job['key']}#{i}".encode()).hexdigest()[:12],
            "group": hashlib.sha1(job["key"].encode()).hexdigest()[:12],
            "synthetic": True,
            "generator": MODEL_A if job["generator"] == "A" else MODEL_B,
            "generator_role": job["generator"],
            "label": job["label"],
            "kind": job.get("kind", job["label"]),
            "pattern": job["ref"] if job["label"] == "scam" else None,
            "scenario": job["ref"] if job["label"] != "scam" else None,
            "format": job["format"],
            "lang": job["lang"],
            "coaching": job["coaching"],
        }
        if job["format"] == "call_check":
            turns = [
                {"speaker": "customer" if str(t.get("speaker", "")).lower().startswith("c") else "ruko", "text": clean_text(str(t.get("text", "")))}
                for t in s.get("turns", [])
                if isinstance(t, dict) and str(t.get("text", "")).strip()
            ]
            cust = [t["text"] for t in turns if t["speaker"] == "customer"]
            if len(turns) < 4 or len(cust) < 2:
                continue
            rec["turns"] = turns
            rec["text"] = "\n".join(cust)
            rec["cover_story"] = s.get("cover_story", "")
        else:
            rec["text"] = clean_text(str(s.get("text", "")))
            rec["channel"] = s.get("channel")
        if not (20 <= len(rec["text"]) <= 2500) or not script_ok(rec["text"], job["lang"]):
            continue
        out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--offline", action="store_true", help="use the cache only")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="", help="comma-separated pattern/scenario ids")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--scope", choices=["all", "scam", "genuine"], default="all")
    ap.add_argument("--library", default=str(LIBRARY), help="pattern source (library.json or research/raw/patterns_merged.json)")
    args = ap.parse_args()

    lib_path = Path(args.library)
    library = json.loads(lib_path.read_text(encoding="utf-8")) if lib_path.exists() else {"patterns": []}
    genuine = json.loads(GENUINE.read_text(encoding="utf-8"))
    jobs = plan_jobs(library, genuine)
    if args.scope != "all":
        jobs = [j for j in jobs if (j["label"] == "scam") == (args.scope == "scam")]
    kinds = {s["id"]: s["kind"] for s in genuine["scenarios"]}
    for j in jobs:
        if j["label"] != "scam":
            j["kind"] = kinds[j["ref"]]
    if args.only:
        keep = set(args.only.split(","))
        jobs = [j for j in jobs if j["ref"] in keep]
    if args.limit:
        jobs = jobs[: args.limit]
    frozen = json.loads(BRIEFS.read_text(encoding="utf-8")) if BRIEFS.exists() else {}
    needed = {j["ref"] for j in jobs if j["label"] == "scam"}
    for p in library["patterns"]:
        if p["id"] in needed and p["id"] not in frozen:
            frozen[p["id"]] = pattern_brief(p)
    if args.run and not args.offline:
        BRIEFS.write_text(json.dumps(dict(sorted(frozen.items())), ensure_ascii=False, indent=1) + chr(10), encoding="utf-8")
    briefs = dict(frozen)
    briefs.update({s["id"]: scenario_brief(s) for s in genuine["scenarios"]})

    n_samples = sum(j["n"] for j in jobs)
    print(f"jobs={len(jobs)} requested_samples={n_samples} "
          f"(A={sum(1 for j in jobs if j['generator']=='A')}, B={sum(1 for j in jobs if j['generator']=='B')})")
    if args.plan:
        est_out = sum(j["n"] * (450 if j["format"] == "call_check" else 120) for j in jobs)
        print(f"estimated completion tokens ~{est_out:,}")
        return
    if not args.run:
        return

    key = None if args.offline else read_key()
    results: list[dict] = []
    failures: list[str] = []
    lock = threading.Lock()

    def work(job):
        model = MODEL_A if job["generator"] == "A" else MODEL_B
        seed = int(hashlib.sha1(job["key"].encode()).hexdigest()[:8], 16)
        prompt = make_prompt(job, briefs[job["ref"]])
        max_tokens = 900 * job["n"] if job["format"] == "call_check" else 260 * job["n"] + 200
        # Malformed JSON (mostly unescaped quotes in long Indic outputs) is retried with a new seed;
        # earlier successful responses stay cached under their original seed.
        last = None
        for attempt in range(3):
            content = chat(model, prompt, temperature=0.9, max_tokens=max_tokens, seed=seed + attempt, key=key)
            try:
                return samples_from(job, parse_json(content))
            except (json.JSONDecodeError, AttributeError, TypeError) as e:
                last = e
        raise RuntimeError(f"unparseable after 3 attempts: {last}")

    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(work, j): j for j in jobs}
        for k, f in enumerate(cf.as_completed(futs), 1):
            j = futs[f]
            try:
                recs = f.result()
                with lock:
                    results.extend(recs)
            except Exception as e:  # noqa: BLE001
                failures.append(f"{j['key']}: {str(e)[:200]}")
            if k % 50 == 0 or k == len(jobs):
                print(f"  {k}/{len(jobs)} jobs, {len(results)} samples, {len(failures)} failures, "
                      f"{USAGE['completion_tokens']:,} new completion tokens, {time.time()-t0:.0f}s", flush=True)

    if OUT.exists():
        fresh = {r["id"] for r in results}
        kept = [json.loads(l) for l in OUT.read_text(encoding="utf-8").splitlines() if l.strip()]
        results.extend(r for r in kept if r["id"] not in fresh)
    results.sort(key=lambda r: r["id"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    log = {
        "synth_version": SYNTH_VERSION,
        "generators": {"A": MODEL_A, "B": MODEL_B},
        "jobs": len(jobs),
        "samples": len(results),
        "failures": failures[:50],
        "n_failures": len(failures),
        "usage_this_run": USAGE,
    }
    prev = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    log["usage_cumulative"] = {
        k: prev.get("usage_cumulative", {}).get(k, 0) + USAGE[k] for k in ("requests", "prompt_tokens", "completion_tokens")
    }
    LOG.write_text(json.dumps(log, indent=2), encoding="utf-8")
    print(json.dumps({k: log[k] for k in ("samples", "n_failures", "usage_this_run")}, indent=1))


if __name__ == "__main__":
    main()
