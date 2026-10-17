"""
Build data/patterns/library.json and data/patterns/sources.json.

Inputs (all committed, so the build is reproducible)
  research/raw/legacy_v0.json          snapshot of shared/patterns.ts + shared/sources.ts (v0)
  research/raw/*_patterns.jsonl        cited pattern research (one JSON object per line)
  research/raw/*_sources.jsonl         the sources those patterns cite
  data/patterns/build/overrides.json   curation: aliases, signal weights, merges, truth edits
  data/patterns/build/translations.json  machine-drafted hi / hinglish / ta / bn / mr text

  ml/.venv/Scripts/python -I -X utf8 data/patterns/build/build_library.py --stage merge
  ml/.venv/Scripts/python -I -X utf8 data/patterns/build/translate.py
  ml/.venv/Scripts/python -I -X utf8 data/patterns/build/build_library.py --stage final
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "research" / "raw"
BUILD = ROOT / "data" / "patterns" / "build"
LIB = ROOT / "data" / "patterns" / "library.json"
SRC = ROOT / "data" / "patterns" / "sources.json"
SCHEMA = ROOT / "data" / "patterns" / "library.schema.json"
MERGED = RAW / "patterns_merged.json"
VERSION = "1.0.0"
GENERATED = "2026-10-18"

CATEGORIES = {
    "authority_impersonation": ("Authority impersonation", "Police, CBI, ED, customs, courts, telecom regulators or other officials threaten the victim."),
    "bank_or_service_impersonation": ("Bank or service impersonation", "Fake bank staff, KYC teams, customer care, utilities or telecom companies."),
    "government_benefit_impersonation": ("Government benefit impersonation", "Fake refunds, subsidies, scholarships, pensions or provident-fund help."),
    "payment_mechanics_trick": ("Payment mechanics trick", "Abuse of how payments work: collect requests, QR codes, 'wrong transfer' returns, refunds."),
    "account_takeover": ("Account takeover", "OTP interception, SIM swap, malware and remote-access apps."),
    "investment": ("Investment", "Fake trading, IPO, crypto and high-return deposit schemes."),
    "employment_income": ("Employment and income", "Task jobs, job fees, mule-account recruitment, betting apps."),
    "advance_fee": ("Advance fee", "Pay a fee to receive a prize, loan, gift, lease or dealership."),
    "relationship_extortion": ("Relationship and extortion", "Romance, matrimonial and sextortion scams."),
    "family_emergency": ("Family emergency", "A relative or friend 'in trouble', including AI-cloned voices and hacked accounts."),
    "purchase_marketplace": ("Purchase and marketplace", "Fake buyers, sellers, landlords, shops and bookings."),
    "charity_donation": ("Charity and donation", "Fake disaster relief, temple or medical fundraising."),
    "business_payment_fraud": ("Business payment fraud", "Invoice redirection and boss/CEO impersonation."),
    "tech_support": ("Tech support", "Fake technical support and refund-overpayment scams."),
    "loan_debt": ("Loans and debt", "Predatory loan apps, fake loan fees and recovery scams."),
}

SIGNAL_DEFAULTS = {
    "authority_impersonation": {"authority_threat": 3, "coached_on_call": 1, "secrecy_demand": 1, "urgency_pressure": 1},
    "bank_or_service_impersonation": {"account_block_threat": 2, "remote_access": 1, "urgency_pressure": 1, "payee_unknown": 1},
    "government_benefit_impersonation": {"pay_to_receive": 2, "remote_access": 1, "urgency_pressure": 1},
    "payment_mechanics_trick": {"pay_to_receive": 2, "payee_unknown": 1, "coached_on_call": 1},
    "account_takeover": {"remote_access": 3, "coached_on_call": 1, "urgency_pressure": 1},
    "investment": {"promised_returns": 3, "payee_unknown": 1, "urgency_pressure": 1},
    "employment_income": {"pay_to_earn": 3, "payee_unknown": 1},
    "advance_fee": {"pay_to_receive": 3, "urgency_pressure": 1},
    "relationship_extortion": {"secrecy_demand": 2, "distress": 1, "urgency_pressure": 1, "payee_unknown": 1},
    "family_emergency": {"relative_emergency": 3, "urgency_pressure": 1, "secrecy_demand": 1, "distress": 1},
    "purchase_marketplace": {"payee_unknown": 2, "pay_to_receive": 1, "urgency_pressure": 1},
    "charity_donation": {"payee_unknown": 2, "urgency_pressure": 1},
    "business_payment_fraud": {"payee_unknown": 2, "urgency_pressure": 1, "secrecy_demand": 1},
    "tech_support": {"remote_access": 3, "pay_to_receive": 1},
    "loan_debt": {"pay_to_receive": 2, "distress": 1, "urgency_pressure": 1},
}

OFFICIAL_KINDS = {"official", "regulator", "police", "parliament"}


def dedupe(xs, key=lambda s: re.sub(r"\s+", " ", s.strip().lower())):
    seen, out = set(), []
    for x in xs or []:
        if not isinstance(x, str) or not x.strip():
            continue
        k = key(x)
        if k in seen:
            continue
        seen.add(k)
        out.append(x.strip())
    return out


def load_jsonl(paths):
    out = []
    for p in sorted(paths):
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.strip():
                out.append(json.loads(line))
    return out


def load_sources() -> tuple[dict, dict]:
    """All sources by id, plus a remap {research id -> canonical id} that merges duplicates by URL."""
    legacy = json.loads((RAW / "legacy_v0.json").read_text(encoding="utf-8"))["sources"]
    by_id: dict[str, dict] = {}
    by_url: dict[str, str] = {}
    remap: dict[str, str] = {}

    def norm_url(u):
        return re.sub(r"^https?://(www\.)?", "", u.strip().rstrip("/").lower())

    for sid, s in legacy.items():
        by_id[sid] = {
            "id": sid, "title": s["title"], "publisher": s["publisher"], "date": s["date"], "url": s["url"],
            "accessed": "2026-10", "kind": "official", "jurisdiction": "IN", "verified": "fetched",
            "notes": s["used_for"], "origin": "legacy_v0",
        }
        by_url[norm_url(s["url"])] = sid
    for s in load_jsonl(RAW.glob("*_sources.jsonl")):
        sid = s["id"].strip().lower()
        u = norm_url(s.get("url", ""))
        if u in by_url:
            remap[sid] = by_url[u]
            continue
        if sid in by_id:
            continue
        rec = {k: s.get(k, "") for k in ("title", "publisher", "date", "url", "accessed", "kind", "jurisdiction", "verified", "notes")}
        rec["id"] = sid
        rec["origin"] = "research_2026_10"
        by_id[sid] = rec
        by_url[u] = sid
    return by_id, remap


def stage_merge() -> None:
    legacy = {p["id"]: p for p in json.loads((RAW / "legacy_v0.json").read_text(encoding="utf-8"))["patterns"]}
    research = load_jsonl(RAW.glob("*_patterns.jsonl"))
    ov = json.loads((BUILD / "overrides.json").read_text(encoding="utf-8"))
    sources, remap = load_sources()
    rename = ov.get("rename", {})
    drop = set(ov.get("drop", []))

    def sids(xs):
        out = []
        for x in xs or []:
            x = remap.get(x.strip().lower(), x.strip().lower())
            if x in sources and x not in out:
                out.append(x)
        return out

    merged: dict[str, dict] = {}
    missing_src = Counter()
    for r in research:
        rid = rename.get(r["id"], r["id"])
        if rid in drop:
            continue
        for x in (r.get("source_ids") or []):
            if remap.get(x.lower(), x.lower()) not in sources:
                missing_src[x] += 1
        if rid in merged:  # two agents covered the same pattern: union the lists
            m = merged[rid]
            for k in ("indicators", "typical_claims", "coaching_phrases", "red_flag_questions", "cues_en", "cues_hinglish", "cues_hi", "advice", "channel", "payment_rails", "markets"):
                m[k] = dedupe((m.get(k) or []) + (r.get(k) or []))
            for k in ("source_ids", "coaching_source_ids", "truth_source_ids"):
                m[k] = sids((m.get(k) or []) + (r.get(k) or []))
            continue
        r = dict(r)
        r["id"] = rid
        for k in ("source_ids", "coaching_source_ids", "truth_source_ids"):
            r[k] = sids(r.get(k))
        r["first_seen"] = {"value": (r.get("first_seen") or {}).get("value", "unknown"), "sources": sids((r.get("first_seen") or {}).get("source_ids"))}
        tr = r.get("trend") or {}
        r["trend"] = {"status": tr.get("status", "unknown"), "note": tr.get("note", ""), "sources": sids(tr.get("source_ids"))}
        merged[rid] = r

    patterns = []
    for pid in sorted(set(merged) | set(legacy)):
        r = merged.get(pid)
        lg = legacy.get(pid)
        o = ov.get("patterns", {}).get(pid, {})
        if r is None:
            print(f"  ! legacy pattern {pid} has no new research; keeping v0 content only")
            r = {"id": pid, "name_en": lg["name"]["en"], "category": o.get("category", "authority_impersonation"), "region": "india", "markets": ["IN"],
                 "summary": lg["summary"], "channel": ["call"], "payment_rails": ["upi"], "victim_profile": "general public; no specific profile documented",
                 "indicators": [], "typical_claims": [], "coaching_phrases": [], "coaching_source_ids": [], "red_flag_questions": [], "cues_en": [],
                 "cues_hinglish": [], "cues_hi": [], "first_seen": {"value": "unknown", "sources": []}, "trend": {"status": "unknown", "note": "", "sources": []},
                 "official_truth": lg["truth"]["en"], "truth_source_ids": [], "advice": [], "source_ids": [], "ruko_applicability": "direct"}
        cat = o.get("category", r["category"])
        src_ids = sids((lg["sources"] if lg else []) + r.get("source_ids", []))
        p = {
            "id": pid,
            "aliases": dedupe(o.get("aliases", []) + [k for k, v in rename.items() if v == pid and k != pid]),
            "name": {"en": o.get("name_en") or (lg["name"]["en"] if lg else r["name_en"])},
            "category": cat,
            "region": r.get("region", "india"),
            "markets": r.get("markets") or (["IN"] if r.get("region", "india") == "india" else ["GB"]),
            "summary": lg["summary"] if lg and not o.get("prefer_research_summary") else r["summary"],
            "channel": dedupe(r.get("channel") or ["call"]),
            "payment_rails": dedupe(r.get("payment_rails") or ["upi"]),
            "victim_profile": r.get("victim_profile") or "general public; no specific profile documented",
            "indicators": dedupe((lg["indicators"] if lg else []) + r.get("indicators", [])),
            "typical_claims": dedupe((lg["typical_claims"] if lg else []) + r.get("typical_claims", [])),
            "red_flag_questions": {"en": dedupe(r.get("red_flag_questions", []))},
            "coaching_phrases": {"en": dedupe(r.get("coaching_phrases", []))},
            "cues": {"en": dedupe([c.lower() for c in r.get("cues_en", [])]), "hinglish": dedupe([c.lower() for c in r.get("cues_hinglish", [])]),
                     "hi": dedupe(r.get("cues_hi", []))},
            "signals": o.get("signals") or (lg["signals"] if lg else SIGNAL_DEFAULTS[cat]),
            "truth": {"en": o.get("truth_en") or (lg["truth"]["en"] if lg else r["official_truth"])},
            "advice": {"en": lg["advice"]["en"] if lg else dedupe(r.get("advice", []))},
            "ask_next": {"en": lg["ask_next"]["en"] if lg else (o.get("ask_next_en") or (r.get("red_flag_questions") or [""])[0])},
            "first_seen": r["first_seen"],
            "trend": r["trend"],
            "ruko_applicability": r.get("ruko_applicability", "direct"),
            "applicability_note": r.get("applicability_note", ""),
            "sources": src_ids,
            "citations": {
                "summary": src_ids,
                "coaching_phrases": r.get("coaching_source_ids", []),
                "truth": dedupe((lg["sources"] if lg else []) + r.get("truth_source_ids", [])) if lg else r.get("truth_source_ids", []) or src_ids[:1],
                "first_seen": r["first_seen"]["sources"],
                "trend": r["trend"]["sources"],
            },
            "provenance": {"origin": "legacy_v0" if lg else "research_2026_10",
                           "notes": ("Base text from shared/patterns.ts v0; research fields added Oct 2026." if lg else "Researched Oct 2026 from the cited sources.")},
            "_legacy": lg,
        }
        if lg:
            p["name"]["hi"] = lg["name"]["hi"]
            p["truth"].update(lg["truth"])
            p["advice"]["hi"] = lg["advice"]["hi"]
            p["ask_next"]["hi"] = lg["ask_next"]["hi"]
            for k in lg.get("keywords", []):
                p["cues"]["hi" if re.search(r"[ऀ-ॿ]", k) else "en"].append(k.strip().lower() if not re.search(r"[ऀ-ॿ]", k) else k.strip())
            p["cues"] = {k: dedupe(v) for k, v in p["cues"].items()}
        patterns.append(p)
    MERGED.write_text(json.dumps({"patterns": patterns}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"merged {len(patterns)} patterns ({sum(1 for p in patterns if p['_legacy'])} legacy) -> {MERGED.relative_to(ROOT)}")
    if missing_src:
        print("  source ids cited but not found:", dict(missing_src.most_common(20)))


def stage_final() -> None:
    merged = json.loads(MERGED.read_text(encoding="utf-8"))["patterns"]
    tr_all = json.loads((BUILD / "translations.json").read_text(encoding="utf-8")) if (BUILD / "translations.json").exists() else {}
    sources, _ = load_sources()
    out = []
    for p in merged:
        lg = p.pop("_legacy")
        tr = tr_all.get(p["id"], {})
        ts = {"en": "source"}
        if lg:
            ts["hi"] = "source"
        else:
            if tr.get("name_hi"):
                p["name"]["hi"] = tr["name_hi"]
                p["truth"]["hi"] = tr["truth_hi"]
                p["advice"]["hi"] = tr["advice_hi"]
                p["ask_next"]["hi"] = tr["ask_next_hi"]
                ts["hi"] = "machine_draft"
        if tr.get("red_flag_questions_hi"):
            p["red_flag_questions"]["hi"] = dedupe(tr["red_flag_questions_hi"])
        if tr.get("coaching_phrases_hi"):
            p["coaching_phrases"]["hi"] = dedupe(tr["coaching_phrases_hi"])
        if tr.get("coaching_phrases_hinglish"):
            p["coaching_phrases"]["hinglish"] = dedupe(tr["coaching_phrases_hinglish"])
            ts["hinglish"] = "machine_draft"
        p["cues"]["hi"] = dedupe(p["cues"].get("hi", []) + tr.get("extra_cues_hi", []))
        p["cues"]["hinglish"] = dedupe(p["cues"].get("hinglish", []) + [c.lower() for c in tr.get("extra_cues_hinglish", [])])
        for lang in ("ta", "bn", "mr"):
            if lg and lang in lg["truth"]:
                ts[lang] = "draft"
            elif tr.get(f"truth_{lang}"):
                p["truth"][lang] = tr[f"truth_{lang}"]
                p["name"][lang] = tr[f"name_{lang}"]
                ts[lang] = "machine_draft"
        p["translation_status"] = ts
        p["keywords"] = dedupe(p["cues"]["en"][:25] + p["cues"]["hinglish"][:10] + p["cues"]["hi"][:10])
        p["cues"] = {k: v for k, v in p["cues"].items() if v}
        p["coaching_phrases"] = {k: v for k, v in p["coaching_phrases"].items() if v}
        p["red_flag_questions"] = {k: v for k, v in p["red_flag_questions"].items() if v}
        out.append(p)

    # every cited source, plus all v0 sources (shared/sources.ts ids stay resolvable)
    used = sorted({s for p in out for s in p["sources"]} | {s for p in out for v in p["citations"].values() for s in v}
                  | {sid for sid, s in sources.items() if s.get("origin") == "legacy_v0"})
    lib = {
        "$schema": "./library.schema.json",
        "library": "ruko-scam-patterns",
        "version": VERSION,
        "generated": GENERATED,
        "sources_file": "./sources.json",
        "translation_policy": {
            "en": "Reference text, paraphrased from the cited sources.",
            "source": "Written directly in that language (carried over from shared/patterns.ts v0).",
            "draft": "Human-written draft awaiting native-speaker review.",
            "machine_draft": "Drafted by an LLM (Qwen3-235B via Nebius) from the English; awaiting native-speaker review. Do not present as reviewed.",
            "reviewed": "Reviewed by a native speaker (none yet).",
        },
        "categories": [{"id": k, "name": v[0], "description": v[1]} for k, v in CATEGORIES.items()],
        "patterns": out,
    }
    LIB.write_text(json.dumps(lib, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    src_out = {"version": VERSION, "generated": GENERATED, "note": "Every source the pattern library cites. 'verified' = fetched (opened and read) or search_snippet_only. Notes paraphrase what we rely on; quotes are kept under 15 words.",
               "sources": [{k: v for k, v in sources[s].items()} for s in used]}
    SRC.write_text(json.dumps(src_out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    validate()


def validate() -> None:
    import jsonschema

    lib = json.loads(LIB.read_text(encoding="utf-8"))
    src = {s["id"]: s for s in json.loads(SRC.read_text(encoding="utf-8"))["sources"]}
    jsonschema.validate(lib, json.loads(SCHEMA.read_text(encoding="utf-8")))
    problems = []
    ids = Counter(p["id"] for p in lib["patterns"])
    problems += [f"duplicate id {k}" for k, v in ids.items() if v > 1]
    for p in lib["patterns"]:
        refs = set(p["sources"]) | {s for v in p["citations"].values() for s in v} | set(p["first_seen"]["sources"]) | set(p["trend"]["sources"])
        for s in refs:
            if s not in src:
                problems.append(f"{p['id']}: unknown source {s}")
        if p["region"] == "india" and not any(src.get(s, {}).get("kind") in OFFICIAL_KINDS for s in p["sources"]):
            problems.append(f"{p['id']}: no official/regulator/police source (warning)")
        if p["coaching_phrases"].get("en") and not p["citations"].get("coaching_phrases"):
            problems.append(f"{p['id']}: coaching phrases without a cited source (warning)")
    hard = [x for x in problems if "(warning)" not in x]
    for x in problems:
        print("  ", x)
    by_region = Counter(p["region"] for p in lib["patterns"])
    by_cat = Counter(p["category"] for p in lib["patterns"])
    print(f"library v{lib['version']}: {len(lib['patterns'])} patterns {dict(by_region)}; {len(src)} sources")
    print("  by category:", dict(sorted(by_cat.items())))
    if hard:
        raise SystemExit(f"{len(hard)} validation errors")
    print("schema + reference checks passed")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=["merge", "final", "validate"], required=True)
    a = ap.parse_args()
    {"merge": stage_merge, "final": stage_final, "validate": validate}[a.stage]()
