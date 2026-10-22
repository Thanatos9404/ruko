"""
Train, export and evaluate Ruko's text model. Deterministic: fixed splits (hash
based), deterministic solvers, sorted inputs, pinned requirements.

  ml/.venv/Scripts/python -I -X utf8 ml/prepare_data.py
  ml/.venv/Scripts/python -I -X utf8 ml/train.py            # all experiments + export
  ml/.venv/Scripts/python -I -X utf8 ml/train.py --only main

Model (per experiment)
  features   ruko_text.analyze: word 1-2 grams + char 2-5 grams, TF-IDF (sublinear, L2)
  stage 1    LR on the full vocabulary (min_df 2) -> keep the Nb strongest binary
             features and the Np strongest per pattern class
  stage 2    refit both heads on the selected vocabulary (what is exported)
  binary     LogisticRegression(class_weight=balanced), Platt-calibrated on val
  patterns   multinomial LogisticRegression on scam rows, temperature-scaled on val
  export     integer weights (x10000); pattern weights pruned to the top M per class

Outputs
  server/ml/model/ruko-text-v1.json (+ .sha256)          shipped model (experiment "main")
  ml/results/<experiment>.json, ml/results/summary.json   metrics
  server/ml/__tests__/fixtures/golden.json               parity fixtures for the TS runtime
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pickle
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.feature_selection import chi2
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
from ruko_text import FEATURIZER_VERSION, ExportedModel, analyze, tokenize  # noqa: E402

DATA = ROOT / "ml" / "work" / "dataset.jsonl"
RESULTS = ROOT / "ml" / "results"
MODEL_DIR = ROOT / "server" / "ml" / "model"
MODEL_PATH = MODEL_DIR / "ruko-text-v1.json"
GOLDEN_IN = ROOT / "ml" / "golden_inputs.json"
GOLDEN_OUT = ROOT / "server" / "ml" / "__tests__" / "fixtures" / "golden.json"

MODEL_VERSION = "ruko-text-1.0.0"
SCALE = 10000
SEED = 20261017
MIN_CLASS = 5

HP = {"Cb": 32.0, "Cp": 64.0, "Nb": 24000, "Np": 700, "M": 1200}
GRID = {"Cb": [8.0, 32.0, 128.0], "Cp": [16.0, 64.0, 256.0]}  # tuned on validation for the shipped model only

COUNTS = ROOT / "ml" / "work" / "counts.pkl"


class Corpus:
    """Raw feature counts for every row of the dataset over one global feature index.

    Built once per dataset (keyed by its SHA-256) and cached in ml/work/counts.pkl, so
    experiments only slice sparse matrices instead of re-tokenising text."""

    def __init__(self, rows: list[dict], data_sha: str):
        if COUNTS.exists():
            with COUNTS.open("rb") as f:
                obj = pickle.load(f)
            if obj.get("sha") == data_sha and obj.get("featurizer") == FEATURIZER_VERSION:
                self.names, self.C, self.row = obj["names"], obj["C"], obj["row"]
                self.fid = {n: i for i, n in enumerate(self.names)}
                print(f"  loaded cached counts: {self.C.shape[0]} rows x {self.C.shape[1]} features")
                return
        t0 = time.time()
        fid: dict[str, int] = {}
        indptr, indices, data = [0], [], []
        for r in rows:
            c = Counter(analyze(r["text"]))
            for f, n in c.items():
                j = fid.get(f)
                if j is None:
                    j = fid[f] = len(fid)
                indices.append(j)
                data.append(n)
            indptr.append(len(indices))
        self.fid = fid
        self.names = [None] * len(fid)
        for f, j in fid.items():
            self.names[j] = f
        self.C = sparse.csr_matrix(
            (np.array(data, dtype=np.float64), np.array(indices, dtype=np.int64), np.array(indptr, dtype=np.int64)),
            shape=(len(rows), len(fid)),
        )
        self.row = {r["id"]: i for i, r in enumerate(rows)}
        COUNTS.parent.mkdir(parents=True, exist_ok=True)
        with COUNTS.open("wb") as f:
            pickle.dump({"sha": data_sha, "featurizer": FEATURIZER_VERSION, "names": self.names, "C": self.C, "row": self.row}, f, protocol=5)
        print(f"  featurised {len(rows)} rows -> {len(fid)} features in {time.time()-t0:.0f}s")

    def sub(self, recs: list[dict]) -> sparse.csr_matrix:
        return self.C[[self.row[r["id"]] for r in recs]]


def tfidf(Csub: sparse.csr_matrix, cols: np.ndarray, idf: np.ndarray) -> sparse.csr_matrix:
    """Sublinear tf * idf, L2-normalised over the given columns (scikit-learn TfidfVectorizer maths)."""
    X = Csub[:, cols].tocsr().astype(np.float64)
    X.data = 1.0 + np.log(X.data)
    X = (X @ sparse.diags(idf)).tocsr()
    return normalize(X, norm="l2", copy=False)


# --- model fitting ----------------------------------------------------------------

def _lr(C: float) -> LogisticRegression:
    return LogisticRegression(C=C, class_weight="balanced", max_iter=3000, tol=1e-5, solver="lbfgs", random_state=SEED)


def fit(corpus: Corpus, train: list[dict], val: list[dict], hp: dict, name: str, tune: bool = False) -> dict:
    t0 = time.time()
    y = np.array([r["label"] == "scam" for r in train], dtype=int)
    w = np.array([r.get("weight", 1.0) for r in train], dtype=float)
    pc = Counter(r["pattern"] for r in train if r["label"] == "scam" and r.get("pattern"))
    classes = sorted(k for k, c in pc.items() if c >= MIN_CLASS)
    cidx = {c: i for i, c in enumerate(classes)}
    pidx = [i for i, r in enumerate(train) if r["label"] == "scam" and r.get("pattern") in cidx]
    yp = np.array([cidx[train[i]["pattern"]] for i in pidx], dtype=int)

    # stage 1: full vocabulary (min_df 2) -> feature selection
    Ct = corpus.sub(train)
    n = Ct.shape[0]
    df = np.asarray((Ct > 0).sum(axis=0)).ravel()
    cols1 = np.where(df >= 2)[0]
    X1 = tfidf(Ct, cols1, np.log((1 + n) / (1 + df[cols1])) + 1)
    lb = _lr(hp["Cb"]).fit(X1, y, sample_weight=w)
    sel = set(cols1[np.argsort(-np.abs(lb.coef_[0]))[: hp["Nb"]]].tolist())
    if len(classes) >= 2:
        Xp = X1[pidx]
        for k in range(len(classes)):
            sc, _ = chi2(Xp, (yp == k).astype(int))
            sc = np.nan_to_num(sc)
            sel |= set(cols1[np.argsort(-sc)[: hp["Np"]]].tolist())

    # stage 2: refit on the selected vocabulary (this is what ships)
    cols2 = np.array(sorted(sel, key=lambda j: corpus.names[j]), dtype=np.int64)
    idf2 = np.round(np.log((1 + n) / (1 + df[cols2])) + 1, 6)
    X2 = tfidf(Ct, cols2, idf2)
    Xv = tfidf(corpus.sub(val), cols2, idf2) if val else None
    yv = np.array([r["label"] == "scam" for r in val], dtype=int) if val else None
    pv = [i for i, r in enumerate(val) if r["label"] == "scam" and r.get("pattern") in cidx] if val else []
    ypv = np.array([cidx[val[i]["pattern"]] for i in pv], dtype=int)

    grid_log = []
    best_b = None
    for Cb in (GRID["Cb"] if tune else [hp["Cb"]]):
        m = _lr(Cb).fit(X2, y, sample_weight=w)
        auc = roc_auc_score(yv, m.decision_function(Xv)) if (val and len(set(yv.tolist())) == 2) else 0.0
        grid_log.append({"head": "binary", "C": Cb, "val_auroc": r4(auc)})
        if best_b is None or auc > best_b[0] + 1e-9:
            best_b = (auc, Cb, m)
    _, Cb, lb2 = best_b
    bw = np.round(lb2.coef_[0] * SCALE).astype(np.int64)

    triples: list[tuple[int, int, int]] = []
    pb: list[float] = []
    Cp = hp["Cp"]
    if len(classes) >= 2:
        best_p = None
        for Cp_ in (GRID["Cp"] if tune else [hp["Cp"]]):
            m = _lr(Cp_).fit(X2[pidx], yp, sample_weight=w[pidx])
            acc = float((m.decision_function(Xv[pv]).argmax(axis=1) == ypv).mean()) if pv else 0.0
            grid_log.append({"head": "patterns", "C": Cp_, "val_top1": r4(acc)})
            if best_p is None or acc > best_p[0] + 1e-9:
                best_p = (acc, Cp_, m)
        _, Cp, lp2 = best_p
        W = lp2.coef_
        for k in range(len(classes)):
            for j in np.argsort(-np.abs(W[k]))[: hp["M"]].tolist():
                q = int(round(W[k, j] * SCALE))
                if q != 0:
                    triples.append((j, k, q))
        triples.sort()
        pb = [round(float(b), 6) for b in lp2.intercept_]
    flat = [v for t in triples for v in t]
    hp = {**hp, "Cb": Cb, "Cp": Cp}

    art = {
        "format": "ruko-text-model",
        "format_version": 1,
        "model_version": MODEL_VERSION if name == "main" else f"{MODEL_VERSION}+{name}",
        "featurizer_version": FEATURIZER_VERSION,
        "created": "",
        "training_data_sha256": "",
        "weight_scale": SCALE,
        "hyperparameters": hp,
        "vocab": [corpus.names[j] for j in cols2],
        "idf": idf2.tolist(),
        "binary": {"w": bw.tolist(), "b": round(float(lb2.intercept_[0]), 6), "calibration": {"a": 1.0, "b": 0.0},
                   "thresholds": {"likely_scam": 0.85, "possible_scam": 0.5}},
        "patterns": {"classes": classes, "b": pb if pb else [0.0] * len(classes), "w": flat, "temperature": 1.0},
    }
    art["_grid"] = grid_log
    calibrate(art, corpus, val)
    art["_fit_seconds"] = round(time.time() - t0, 1)
    return art


class Scorer:
    """Vectorised scoring of an exported artefact (same maths as ExportedModel / server/ml/model.ts)."""

    def __init__(self, art: dict, corpus: Corpus):
        self.art, self.corpus = art, corpus
        self.cols = np.array([corpus.fid[f] for f in art["vocab"]], dtype=np.int64)
        self.idf = np.array(art["idf"])
        V = len(art["vocab"])
        self.bw = np.array(art["binary"]["w"], dtype=float) / art["weight_scale"]
        K = len(art["patterns"]["classes"])
        flat = art["patterns"]["w"]
        if K and flat:
            rows, cols, vals = flat[0::3], flat[1::3], np.array(flat[2::3], dtype=float) / art["weight_scale"]
            self.PW = sparse.csr_matrix((vals, (rows, cols)), shape=(V, K))
        else:
            self.PW = sparse.csr_matrix((V, max(K, 1)))
        self.pb = np.array(art["patterns"]["b"] or [0.0])

    def raw(self, recs: list[dict]):
        X = tfidf(self.corpus.sub(recs), self.cols, self.idf)
        z = X @ self.bw + self.art["binary"]["b"]
        L = np.asarray((X @ self.PW).todense()) + self.pb
        return z, L

    def predict(self, recs: list[dict]):
        z, L = self.raw(recs)
        cal = self.art["binary"]["calibration"]
        p = 1 / (1 + np.exp(-(cal["a"] * z + cal["b"])))
        T = self.art["patterns"]["temperature"]
        Ls = (L - L.max(axis=1, keepdims=True)) / T
        P = np.exp(Ls)
        P /= P.sum(axis=1, keepdims=True)
        return p, P


def calibrate(art: dict, corpus: Corpus, val: list[dict]) -> None:
    if not val:
        return
    z, L = Scorer(art, corpus).raw(val)
    y = np.array([r["label"] == "scam" for r in val], dtype=int)
    if len(set(y.tolist())) == 2:
        pl = LogisticRegression(C=1e6, max_iter=2000, solver="lbfgs").fit(z.reshape(-1, 1), y)
        art["binary"]["calibration"] = {"a": round(float(pl.coef_[0, 0]), 6), "b": round(float(pl.intercept_[0]), 6)}
    classes = art["patterns"]["classes"]
    cidx = {c: i for i, c in enumerate(classes)}
    rows = [i for i, r in enumerate(val) if r["label"] == "scam" and r.get("pattern") in cidx]
    if rows and len(classes) >= 2:
        yt = np.array([cidx[val[i]["pattern"]] for i in rows])
        Lv = L[rows]
        best = (1e18, 1.0)
        for T in np.exp(np.linspace(math.log(0.2), math.log(5.0), 61)):
            Z = (Lv - Lv.max(axis=1, keepdims=True)) / T
            nll = -(Z[np.arange(len(yt)), yt] - np.log(np.exp(Z).sum(axis=1))).mean()
            if nll < best[0]:
                best = (nll, float(T))
        art["patterns"]["temperature"] = round(best[1], 4)
    # Band thresholds are FIXED on the calibrated probability: possible_scam >= 0.5, likely_scam >= 0.85.
    # (Percentile rules on the in-distribution validation set collapsed both to 0.5, because val is
    # nearly separable; fixed cut-offs keep the bands meaningful. Metrics are reported at both.)
    art["binary"]["thresholds"] = {"likely_scam": 0.85, "possible_scam": 0.5}


# --- metrics -------------------------------------------------------------------------

def ece(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    tot, out = 0.0, []
    for i in range(bins):
        m = (p >= edges[i]) & ((p < edges[i + 1]) if i < bins - 1 else (p <= 1))
        if m.sum() == 0:
            continue
        conf, acc = p[m].mean(), y[m].mean()
        tot += m.sum() / len(p) * abs(conf - acc)
        out.append({"bin": f"{edges[i]:.1f}-{edges[i+1]:.1f}", "n": int(m.sum()), "mean_p": round(float(conf), 4), "frac_scam": round(float(acc), 4)})
    return float(tot), out


def at_threshold(y, p, t):
    pred = p >= t
    tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum()); tn = int((~pred & (y == 0)).sum())
    prec = tp / (tp + fp) if tp + fp else None
    rec = tp / (tp + fn) if tp + fn else None
    f1 = 2 * prec * rec / (prec + rec) if prec and rec else None
    return {"threshold": round(t, 4), "tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": r4(prec), "recall": r4(rec), "f1": r4(f1),
            "fpr": r4(fp / (fp + tn)) if fp + tn else None, "accuracy": r4((tp + tn) / len(y)) if len(y) else None}


def r4(v):
    return None if v is None else round(float(v), 4)


def bootstrap_auc(y, p, n=500):
    rng = np.random.default_rng(SEED)
    vals = []
    idx = np.arange(len(y))
    for _ in range(n):
        s = rng.choice(idx, len(idx), replace=True)
        if len(set(y[s])) == 2:
            vals.append(roc_auc_score(y[s], p[s]))
    return [r4(np.percentile(vals, 2.5)), r4(np.percentile(vals, 97.5))] if vals else None


def binary_metrics(rows, p, th):
    y = np.array([r["label"] == "scam" for r in rows], dtype=int)
    out = {"n": len(rows), "n_scam": int(y.sum()), "n_genuine": int((1 - y).sum())}
    if len(set(y)) == 2:
        out["auroc"] = r4(roc_auc_score(y, p))
        out["auroc_95ci"] = bootstrap_auc(y, p)
        out["auprc"] = r4(average_precision_score(y, p))
    out["brier"] = r4(np.mean((p - y) ** 2))
    e, rel = ece(y, p)
    out["ece"] = r4(e)
    out["reliability"] = rel
    out["at_possible"] = at_threshold(y, p, th["possible_scam"])
    out["at_likely"] = at_threshold(y, p, th["likely_scam"])
    out["at_0.5"] = at_threshold(y, p, 0.5)
    gen = [i for i, r in enumerate(rows) if r["label"] == "genuine"]
    hard = [i for i in gen if rows[i].get("kind") == "hard_negative"]
    payments = [i for i in gen if rows[i].get("format") == "call_check"]
    for nm, ix in (("fpr_hard_negatives", hard), ("fpr_genuine_payment_calls", payments)):
        if ix:
            pp = p[ix]
            out[nm] = {"n": len(ix), "at_possible": r4((pp >= th["possible_scam"]).mean()), "at_likely": r4((pp >= th["likely_scam"]).mean())}
    return out


def pattern_metrics(rows, P, classes):
    cidx = {c: i for i, c in enumerate(classes)}
    ix = [i for i, r in enumerate(rows) if r["label"] == "scam" and r.get("pattern")]
    known = [i for i in ix if rows[i]["pattern"] in cidx]
    out = {"n_scam_with_pattern": len(ix), "n_scored": len(known), "n_pattern_not_in_model": len(ix) - len(known)}
    if not known:
        return out
    yt = np.array([cidx[rows[i]["pattern"]] for i in known])
    Pk = P[known]
    order = np.argsort(-Pk, axis=1)
    out["top1"] = r4((order[:, 0] == yt).mean())
    out["top3"] = r4((order[:, :3] == yt[:, None]).any(axis=1).mean())
    pred = order[:, 0]
    per = {}
    f1s = []
    for k, c in enumerate(classes):
        tp = int(((pred == k) & (yt == k)).sum()); fp = int(((pred == k) & (yt != k)).sum()); fn = int(((pred != k) & (yt == k)).sum())
        sup = int((yt == k).sum())
        if sup == 0 and fp == 0:
            continue
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        per[c] = {"support": sup, "precision": r4(prec), "recall": r4(rec), "f1": r4(f1)}
        if sup:
            f1s.append(f1)
    out["macro_f1"] = r4(np.mean(f1s)) if f1s else None
    out["per_pattern"] = per
    conf = Counter((classes[a], classes[b]) for a, b in zip(yt, pred) if a != b)
    out["top_confusions"] = [{"true": a, "predicted": b, "n": n} for (a, b), n in conf.most_common(15)]
    return out


def slice_metrics(rows, p, th, key):
    groups = defaultdict(list)
    for i, r in enumerate(rows):
        groups[str(r.get(key))].append(i)
    out = {}
    for g, ix in sorted(groups.items()):
        y = np.array([rows[i]["label"] == "scam" for i in ix], dtype=int)
        pp = p[ix]
        d = {"n": len(ix), "n_scam": int(y.sum())}
        if len(set(y)) == 2:
            d["auroc"] = r4(roc_auc_score(y, pp))
        d["recall_at_possible"] = r4((pp[y == 1] >= th["possible_scam"]).mean()) if y.sum() else None
        d["fpr_at_possible"] = r4((pp[y == 0] >= th["possible_scam"]).mean()) if (1 - y).sum() else None
        out[g] = d
    return out


def evaluate(art: dict, corpus: Corpus, sets: dict[str, list[dict]], slices: bool) -> dict:
    sc = Scorer(art, corpus)
    th = art["binary"]["thresholds"]
    res = {}
    for nm, rows in sets.items():
        if not rows:
            continue
        p, P = sc.predict(rows)
        d = {"binary": binary_metrics(rows, p, th)}
        if len(art["patterns"]["classes"]) >= 2:
            d["patterns"] = pattern_metrics(rows, P, art["patterns"]["classes"])
        if slices:
            d["by_lang"] = slice_metrics(rows, p, th, "lang")
            d["by_format"] = slice_metrics(rows, p, th, "format")
            d["by_source"] = slice_metrics(rows, p, th, "source")
            if any(r.get("coaching") is not None for r in rows):
                d["by_coaching"] = slice_metrics(rows, p, th, "coaching")
        res[nm] = d
    return res


# --- experiments ---------------------------------------------------------------------------

def load() -> list[dict]:
    return [json.loads(l) for l in DATA.read_text(encoding="utf-8").splitlines() if l.strip()]


def pick(rows, split, sources=None, exclude_langs=()):
    return [r for r in rows if r["split"] == split and (sources is None or r["source"] in sources) and r["lang"] not in exclude_langs]


def eval_sets(rows):
    sets = {
        "test_synthetic_A": [r for r in rows if r["split"] == "test" and r["source"] == "synthetic"],
        "test_genB_cross_generator": pick(rows, "test_genB"),
        "test_mendeley_real_sms": [r for r in rows if r["split"] == "test" and r["source"] == "mendeley_sms"],
        "test_bothbosu": [r for r in rows if r["split"] == "test" and r["source"].startswith("bothbosu")],
        "ood_ridham115_indian_sms": pick(rows, "ood_ridham"),
        "ood_flowxai_en": pick(rows, "ood_flowxai"),
        "ood_realworld_curated": pick(rows, "ood_realworld"),
        "ood_icfd31k_calls": pick(rows, "ood_icfd31k"),
        "ood_imc25_real_smishing_india": pick(rows, "ood_imc25_india"),
        "ood_imc25_real_smishing_global": pick(rows, "ood_imc25_global"),
        "ood_skyaara_genuine_payment_sms": pick(rows, "ood_skyaara"),
        "ood_marketing_spam_flag_rate": pick(rows, "ood_spam"),
    }
    return sets


BOTH = ("bothbosu_scam_dialogue", "bothbosu_multi_agent", "bothbosu_single_agent")


def experiments(rows):
    syn = ("synthetic",)
    real = ("mendeley_sms", "imc25_smishing_train")
    main_src = syn + BOTH + real
    return {
        "main": (pick(rows, "train", main_src), pick(rows, "val", main_src)),
        "synthetic_only": (pick(rows, "train", syn), pick(rows, "val", syn)),
        "real_sms_only": (pick(rows, "train", real), pick(rows, "val", real)),
        "bothbosu_only": (pick(rows, "train", BOTH), pick(rows, "val", BOTH)),
        "lang_holdout_ta_bn_mr": (pick(rows, "train", main_src, ("ta", "bn", "mr")), pick(rows, "val", main_src, ("ta", "bn", "mr"))),
    }


def model_size(art) -> int:
    return len(json.dumps(art, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def export(art: dict, data_sha: str, summary: dict) -> None:
    art = {k: v for k, v in art.items() if not k.startswith("_")}
    art["created"] = time.strftime("%Y-%m-%d")
    art["training_data_sha256"] = data_sha
    art["metrics_summary"] = summary
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(art, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    MODEL_PATH.write_bytes(blob)
    digest = hashlib.sha256(blob).hexdigest()
    (MODEL_DIR / (MODEL_PATH.name + ".sha256")).write_text(f"{digest}  {MODEL_PATH.name}\n", encoding="utf-8")
    print(f"exported {MODEL_PATH.relative_to(ROOT)} {len(blob)/1e6:.2f} MB sha256={digest[:16]}…")


def golden(art: dict) -> None:
    if not GOLDEN_IN.exists():
        return
    cases = json.loads(GOLDEN_IN.read_text(encoding="utf-8"))["cases"]
    em = ExportedModel(json.loads(MODEL_PATH.read_text(encoding="utf-8")))
    out = []
    for c in cases:
        pr = em.predict(c["text"])
        top = sorted(pr["pattern_probs"].items(), key=lambda kv: -kv[1])[:3]
        f = analyze(c["text"])
        out.append({
            **c,
            "tokens": [t.text for t in tokenize(c["text"])],
            "features_sha256": hashlib.sha256("\n".join(f).encode("utf-8")).hexdigest(),
            "p_scam": pr["p_scam"],
            "top_patterns": [[k, v] for k, v in top],
        })
    GOLDEN_OUT.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN_OUT.write_text(json.dumps({"model_version": art["model_version"], "cases": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(out)} golden cases")


def python_latency(art: dict, rows: list[dict]) -> dict:
    em = ExportedModel(json.loads(MODEL_PATH.read_text(encoding="utf-8")))
    texts = [r["text"] for r in rows[:400]]
    t0 = time.perf_counter()
    for t in texts:
        em.predict(t)
    dt = (time.perf_counter() - t0) / max(1, len(texts)) * 1000
    return {"python_reference_ms_per_text": round(dt, 3), "n": len(texts), "mean_chars": round(float(np.mean([len(t) for t in texts])), 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--no-tune", action="store_true")
    args = ap.parse_args()
    rows = load()
    data_sha = hashlib.sha256(DATA.read_bytes()).hexdigest()
    sets = eval_sets(rows)
    RESULTS.mkdir(parents=True, exist_ok=True)
    summary = {"dataset_sha256": data_sha, "experiments": {}}
    corpus = Corpus(rows, data_sha)
    exps = experiments(rows)
    if args.only:
        exps = {k: v for k, v in exps.items() if k in args.only.split(",")}
    for name, (train, val) in exps.items():
        print(f"== {name}: train={len(train)} val={len(val)}")
        art = fit(corpus, train, val, HP, name, tune=(name == "main" and not args.no_tune))
        hp, grid = art["hyperparameters"], art.pop("_grid", [])
        res = evaluate(art, corpus, sets, slices=(name == "main"))
        res["val"] = evaluate(art, corpus, {"val": val}, False)["val"]
        info = {
            "experiment": name, "hyperparameters": hp, "tuning_grid": grid,
            "train": {"n": len(train), "by_source": dict(Counter(r["source"] for r in train)), "by_label": dict(Counter(r["label"] for r in train))},
            "pattern_classes": len(art["patterns"]["classes"]), "vocab": len(art["vocab"]),
            "thresholds": art["binary"]["thresholds"], "calibration": art["binary"]["calibration"],
            "temperature": art["patterns"]["temperature"], "model_bytes": model_size(art), "fit_seconds": art.get("_fit_seconds"),
            "results": res,
        }
        if name == "main":
            short = {k: {"auroc": v["binary"].get("auroc"), "fpr_at_possible": v["binary"]["at_possible"]["fpr"],
                         "recall_at_possible": v["binary"]["at_possible"]["recall"], "top1": v.get("patterns", {}).get("top1")}
                     for k, v in res.items()}
            export(art, data_sha, short)
            info["latency"] = python_latency(art, sets["test_synthetic_A"])
            info["model_sha256"] = (MODEL_DIR / (MODEL_PATH.name + ".sha256")).read_text().split()[0]
            golden(art)
        (RESULTS / f"{name}.json").write_text(json.dumps(info, indent=1, ensure_ascii=False), encoding="utf-8")
        summary["experiments"][name] = {
            k: {"auroc": v["binary"].get("auroc"), "auprc": v["binary"].get("auprc"), "ece": v["binary"].get("ece"),
                "fpr_at_possible": v["binary"]["at_possible"]["fpr"], "recall_at_possible": v["binary"]["at_possible"]["recall"],
                "top1": v.get("patterns", {}).get("top1"), "top3": v.get("patterns", {}).get("top3"), "n": v["binary"]["n"]}
            for k, v in res.items()
        }
        for k, v in res.items():
            b = v["binary"]
            print(f"   {k:32s} n={b['n']:5d} auroc={b.get('auroc')} fpr@poss={b['at_possible']['fpr']} rec@poss={b['at_possible']['recall']} "
                  f"top1={v.get('patterns', {}).get('top1')} top3={v.get('patterns', {}).get('top3')}")
    prev = json.loads((RESULTS / "summary.json").read_text(encoding="utf-8")) if (RESULTS / "summary.json").exists() and args.only else {"experiments": {}}
    prev["experiments"].update(summary["experiments"])
    prev["dataset_sha256"] = data_sha
    (RESULTS / "summary.json").write_text(json.dumps(prev, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
