"""
PII scrubbing for anything Ruko stores (training data, eval sets, golden tests).

Detected phone numbers, UPI IDs / e-mails, account / card / Aadhaar numbers and
URLs are replaced with fixed dummy values. The dummies are chosen so that the
featurizer (ruko_text.tokenize) redacts them to exactly the same placeholder
tokens as real values, so scrubbing never changes what the model sees.
"""
from __future__ import annotations

from ruko_text import _redaction_spans

DUMMY = {
    "xphone": "+91 90000 00000",
    "xhandle": "payee@upi",
    "xnum": "000000000000",
    "xurl": "http://example.invalid/x",
}


def scrub(text: str) -> str:
    out = []
    last = 0
    for s, e, tag in _redaction_spans(text):
        out.append(text[last:s])
        out.append(DUMMY.get(tag, text[s:e]))
        last = e
    out.append(text[last:])
    return "".join(out)


if __name__ == "__main__":
    import sys

    for line in sys.stdin:
        sys.stdout.write(scrub(line))
