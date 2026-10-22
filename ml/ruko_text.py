"""
Ruko text featurizer and reference inference (Python side).

This module is the single source of truth for how text becomes features. The
TypeScript runtime in server/ml/featurize.ts mirrors it line for line; the
parity test (server/ml/__tests__/parity.test.ts) checks both produce the same
tokens, features and probabilities on golden inputs written by ml/train.py.

Pipeline
1. Redact PII on the ORIGINAL text with ASCII-only regexes (same flavour in
   Python and JS): APK file names, URLs, UPI IDs / e-mails, phone numbers,
   card and account numbers. Each match becomes one placeholder token.
2. Everything else is normalised per character: NFKC, lower-case, nukta
   dropped and chandrabindu -> anusvara (Devanagari, Bengali), every decimal
   digit (any script) -> "0", format chars (ZWJ/ZWNJ) dropped, letters, marks
   and numbers kept, anything else is a token break. "₹" becomes "rs".
3. Features: word unigrams ("w:"), word bigrams ("b:"), and character n-grams
   (n = 2..5) inside each space-padded token ("c:"). Since v2, the link, handle,
   phone and account placeholders produce no features (see NO_FEATURE).
4. TF-IDF with sublinear tf (1 + ln count), smooth idf, L2 norm over known
   features (identical to scikit-learn's TfidfVectorizer).
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from dataclasses import dataclass

FEATURIZER_VERSION = 2
CHAR_N_MIN, CHAR_N_MAX = 2, 5

# --- PII redaction --------------------------------------------------------
# ASCII-only classes, no IGNORECASE, so Python (re.ASCII) and JS ("g" flag,
# no "u"/"i") match exactly the same spans.
_TLDS = (
    "com|in|net|org|info|xyz|top|online|site|link|ly|co|me|app|io|cc|biz|live|"
    "shop|club|vip|pro|icu|tk|ml|ga|cf|gq|gov|ac|edu|page|store|cloud|today"
)
REDACTIONS: list[tuple[str, str]] = [
    # file names ending in .apk (kept as their own token: APKs are a strong cue)
    ("xapk", r"[A-Za-z0-9_\-.]*[A-Za-z0-9_\-]\.[Aa][Pp][Kk](?![A-Za-z0-9])"),
    # URLs with a scheme or www.
    ("xurl", r"(?:[Hh][Tt][Tt][Pp][Ss]?://|[Ww][Ww][Ww]\.)[^ \t\r\n]+"),
    # UPI IDs and e-mail addresses (name@bank, name@gmail.com)
    ("xhandle", r"[A-Za-z0-9][A-Za-z0-9._\-]*@[A-Za-z][A-Za-z0-9.\-]*[A-Za-z0-9]"),
    # bare domains like bit.ly/abc or kyc-update.xyz
    (
        "xurl",
        r"(?<![A-Za-z0-9@.\-])[A-Za-z0-9][A-Za-z0-9\-]*(?:\.[A-Za-z0-9\-]+)*\.(?:" + _TLDS + r")(?![A-Za-z0-9\-])(?:/[^ \t\r\n]*)?",
    ),
    # card numbers 1234 5678 9012 3456
    ("xnum", r"(?<![0-9])[0-9]{4}(?:[ \-][0-9]{4}){3}(?![0-9])"),
    # Indian mobile numbers, optional +91 / 0 prefix, optional single space or dash after 5 digits
    ("xphone", r"(?<![0-9])(?:\+?91[ \-]?|0)?[6-9][0-9]{4}[ \-]?[0-9]{5}(?![0-9])"),
    # other international numbers written with a +
    ("xphone", r"\+[0-9][0-9 \-]{7,}[0-9]"),
    # long digit runs: account numbers, Aadhaar, card numbers without spaces
    ("xnum", r"(?<![0-9])[0-9]{9,}(?![0-9])"),
    # Aadhaar written 1234 5678 9012
    ("xnum", r"(?<![0-9])[0-9]{4} [0-9]{4} [0-9]{4}(?![0-9])"),
]
_REDACTION_RES = [(tag, re.compile(rx, re.ASCII)) for tag, rx in REDACTIONS]


@dataclass
class Token:
    text: str
    start: int  # offset in the original string (code points in Python, UTF-16 units in TS)
    end: int


def _redaction_spans(text: str) -> list[tuple[int, int, str]]:
    """Non-overlapping redaction spans, earlier rules win, left to right."""
    taken: list[tuple[int, int, str]] = []
    for tag, rx in _REDACTION_RES:
        for m in rx.finditer(text):
            s, e = m.start(), m.end()
            if e <= s:
                continue
            if any(s < te and ts < e for ts, te, _ in taken):
                continue
            taken.append((s, e, tag))
    taken.sort()
    return taken


# Spelling variants that carry no meaning for us: nukta (Devanagari, Bengali)
# is often omitted when typing, and chandrabindu is often typed as anusvara.
_DROP = {"़", "়"}
_MAP = {"ँ": "ं", "ঁ": "ং"}


def _norm_char(ch: str) -> str:
    """Per-character normalisation. Returns '' (drop), ' ' (break) or kept chars."""
    out = []
    for c in unicodedata.normalize("NFKC", ch).lower():
        if c in _DROP:
            continue
        c = _MAP.get(c, c)
        if c == "₹":
            out.append(" rs ")
            continue
        cat = unicodedata.category(c)
        if cat == "Nd":
            out.append("0")
        elif cat[0] in "LMN":
            out.append(c)
        elif cat == "Cf":
            continue
        else:
            out.append(" ")
    return "".join(out)


def tokenize(text: str) -> list[Token]:
    spans = _redaction_spans(text)
    tokens: list[Token] = []
    cur: list[str] = []
    cur_start = -1
    last_end = -1

    def flush():
        nonlocal cur, cur_start
        if cur:
            tokens.append(Token("".join(cur), cur_start, last_end))
        cur = []
        cur_start = -1

    i = 0
    si = 0
    n = len(text)
    while i < n:
        if si < len(spans) and spans[si][0] == i:
            flush()
            s, e, tag = spans[si]
            tokens.append(Token(tag, s, e))
            i = e
            si += 1
            continue
        piece = _norm_char(text[i])
        for c in piece:
            if c == " ":
                flush()
            else:
                if cur_start < 0:
                    cur_start = i
                cur.append(c)
                last_end = i + 1
        if piece == "" and cur:
            last_end = i + 1
        i += 1
    flush()
    return tokens


def normalize(text: str) -> str:
    return " ".join(t.text for t in tokenize(text))


# v2: redacted links, handles, phone and account numbers produce no features. Genuine bank alerts,
# OTPs and bills carry links and numbers too, and in synthetic data their frequency mostly reflects
# how the generator was prompted, so the model must judge the words around them instead.
# APK file names (xapk) still count: genuine messages almost never carry an .apk file.
NO_FEATURE = {"xurl", "xhandle", "xphone", "xnum"}


def features_from_tokens(toks: list[str], version: int = FEATURIZER_VERSION) -> list[str]:
    nofeat = NO_FEATURE if version >= 2 else set()  # v1 kept placeholder features (used to re-evaluate old models)
    feats: list[str] = []
    for t in toks:
        if t not in nofeat:
            feats.append("w:" + t)
    for a, b in zip(toks, toks[1:]):
        if a not in nofeat and b not in nofeat:
            feats.append("b:" + a + "_" + b)
    for t in toks:
        if t in nofeat:
            continue
        chars = [" "] + list(t) + [" "]
        L = len(chars)
        for nlen in range(CHAR_N_MIN, CHAR_N_MAX + 1):
            for i in range(0, L - nlen + 1):
                feats.append("c:" + "".join(chars[i : i + nlen]))
    return feats


def analyze(text: str, version: int = FEATURIZER_VERSION) -> list[str]:
    """Feature strings for a text (the training pipeline's analyzer)."""
    return features_from_tokens([t.text for t in tokenize(text)], version)


# --- reference inference over the exported JSON model ------------------------

def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1.0 + ez)


class ExportedModel:
    """Pure-Python inference over the JSON artefact (mirrors server/ml/model.ts)."""

    def __init__(self, obj: dict):
        self.obj = obj
        self.index = {f: i for i, f in enumerate(obj["vocab"])}
        self.idf = obj["idf"]
        self.scale = obj["weight_scale"]
        b = obj["binary"]
        self.bw = b["w"]
        self.bb = b["b"]
        self.cal = b["calibration"]
        p = obj["patterns"]
        self.classes = p["classes"]
        self.pb = p["b"]
        self.ptemp = p["temperature"]
        self.pw: dict[int, list[tuple[int, int]]] = {}
        flat = p["w"]
        for k in range(0, len(flat), 3):
            self.pw.setdefault(flat[k], []).append((flat[k + 1], flat[k + 2]))

    @classmethod
    def load(cls, path: str) -> "ExportedModel":
        with open(path, encoding="utf-8") as f:
            return cls(json.load(f))

    def vectorize(self, text: str) -> dict[int, float]:
        counts: dict[int, int] = {}
        for f in analyze(text):
            j = self.index.get(f)
            if j is not None:
                counts[j] = counts.get(j, 0) + 1
        vec = {j: (1.0 + math.log(c)) * self.idf[j] for j, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm > 0:
            vec = {j: v / norm for j, v in vec.items()}
        return vec

    def predict(self, text: str) -> dict:
        x = self.vectorize(text)
        z = self.bb + sum(v * self.bw[j] / self.scale for j, v in x.items())
        p_scam = _sigmoid(self.cal["a"] * z + self.cal["b"])
        logits = list(self.pb)
        for j, v in x.items():
            for ci, w in self.pw.get(j, ()):
                logits[ci] += v * w / self.scale
        m = max(logits)
        ex = [math.exp((l - m) / self.ptemp) for l in logits]
        s = sum(ex)
        probs = [e / s for e in ex]
        return {"p_scam": p_scam, "raw_logit": z, "pattern_probs": dict(zip(self.classes, probs))}
