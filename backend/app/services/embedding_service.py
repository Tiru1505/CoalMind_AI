"""Embedding service.

Prototype implementation: a deterministic hashed bag-of-words / bigram
embedding with a mining-domain synonym lexicon. It runs fully offline and
gives stable, explainable similarity for the demo.

Production replacement: Sentence-BERT (e.g. `all-MiniLM-L6-v2` or a
multilingual model such as `paraphrase-multilingual-MiniLM-L12-v2` for
Hindi + English). Swap `HashingEmbedder` for a class exposing the same
`embed(text) -> list[float]` method; set EMBEDDING_BACKEND=sbert.
"""
from __future__ import annotations

import hashlib
import math
import os
import re

DIM = 384  # same dimensionality as MiniLM so the pgvector schema would not change

STOPWORDS = set("""a an the of in on at for to and or is was were be by with from as what which who how show me
tell give please during over last this that these those it its are has have had did do does about into than
वर्ष का की के में है""".split())

# domain synonyms -> canonical token
SYNONYMS = {
    "output": "production", "produced": "production", "produce": "production", "producing": "production",
    "उत्पादन": "production", "कोयला": "coal", "लक्ष्य": "target", "उपलब्धि": "achievement",
    "ob": "overburden", "overburden": "overburden", "stripping": "overburden",
    "reclaimed": "reclamation", "reclaim": "reclamation", "reclamation": "reclamation", "restoration": "reclamation",
    "plantation": "plantation", "saplings": "plantation", "afforestation": "plantation",
    "workforce": "manpower", "employees": "manpower", "staff": "manpower", "जनशक्ति": "manpower",
    "accident": "safety", "accidents": "safety", "incident": "safety", "incidents": "safety", "dgms": "safety",
    "reserve": "reserves", "reserves": "reserves", "geological": "geology", "geology": "geology",
    "borehole": "drilling", "boreholes": "drilling", "exploration": "drilling",
    "achieved": "achievement", "achievement": "achievement", "exceeded": "achievement",
    "targets": "target", "mt": "mt", "tonnes": "mt", "million": "mt",
    "dispatch": "dispatch", "despatch": "dispatch", "offtake": "dispatch",
    "gevra": "gevra", "गेवरा": "gevra", "kusmunda": "kusmunda", "कुसमुंडा": "kusmunda",
    "dipka": "dipka", "दीपका": "dipka", "korba": "korba", "कोरबा": "korba", "manikpur": "manikpur",
    "trend": "trend", "years": "trend", "yearly": "trend",
}

TOKEN_RE = re.compile(r"[\wऀ-ॿ]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    toks = []
    for raw in TOKEN_RE.findall(text.lower()):
        if raw in STOPWORDS or len(raw) < 2 and not raw.isdigit():
            continue
        toks.append(SYNONYMS.get(raw, raw))
    return toks


def _bucket(token: str) -> tuple[int, float]:
    h = hashlib.md5(token.encode("utf-8")).digest()
    idx = int.from_bytes(h[:4], "little") % DIM
    sign = 1.0 if h[4] & 1 else -1.0
    return idx, sign


class HashingEmbedder:
    name = "hashing-bow-384 (Sentence-BERT stand-in)"

    def embed(self, text: str) -> list[float]:
        toks = tokenize(text)
        vec = [0.0] * DIM
        feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
        for f in feats:
            idx, sign = _bucket(f)
            vec[idx] += sign * (1.0 if "_" not in f else 0.5)
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [round(v / norm, 5) for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    return sum(x * y for x, y in zip(a, b))


_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        backend = os.getenv("EMBEDDING_BACKEND", "hashing")
        if backend == "sbert":  # pragma: no cover - optional dependency
            try:
                from sentence_transformers import SentenceTransformer

                class SBERT:
                    name = os.getenv("SBERT_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

                    def __init__(self):
                        self.model = SentenceTransformer(self.name)

                    def embed(self, text: str) -> list[float]:
                        return self.model.encode(text, normalize_embeddings=True).tolist()

                _embedder = SBERT()
            except Exception:  # fall back silently to keep the demo working
                _embedder = HashingEmbedder()
        else:
            _embedder = HashingEmbedder()
    return _embedder
