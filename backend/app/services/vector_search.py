"""Vector search over knowledge chunks.

Prototype: brute-force cosine similarity over embeddings stored as JSON in
SQLite, combined with metadata boosts (mine, financial year, metric). This is
a hybrid retriever — the same scoring shape you would use with pgvector:

    SELECT id, 1 - (embedding <=> :q) AS sim FROM knowledge_chunks
    WHERE mine_codes ? :mine ORDER BY embedding <=> :q LIMIT :k;
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.models import Document, KnowledgeChunk
from app.services.embedding_service import cosine, get_embedder, tokenize

SEARCHABLE_STATUSES = {"Processed", "Approved", "Validation Required"}


@dataclass
class Hit:
    chunk: KnowledgeChunk
    similarity: float
    score: float


def search(db: Session, query: str, *, owner_id: int, k: int = 8, mines: list[str] | None = None, fy: str | None = None,
           metrics: list[str] | None = None, topic: str | None = None, require_filter: bool = False,
           verified_only: bool = False, one_per_document: bool = False,
           exclude_metrics: list[str] | None = None) -> list[Hit]:
    q_vec = get_embedder().embed(query)
    q_tokens = set(tokenize(query))
    q = (db.query(KnowledgeChunk).join(Document, Document.id == KnowledgeChunk.document_id)
         .filter(KnowledgeChunk.owner_id == owner_id, Document.status.in_(SEARCHABLE_STATUSES)))
    if verified_only:
        q = q.filter(KnowledgeChunk.verified.is_(True))
    rows = q.all()
    hits: list[Hit] = []
    for ch in rows:
        if exclude_metrics and any(m in (ch.metrics or []) for m in exclude_metrics):
            continue
        sim = max(0.0, cosine(q_vec, ch.embedding))
        c_tokens = set(tokenize(ch.content))
        overlap = len(q_tokens & c_tokens) / max(1, len(q_tokens))
        mine_ok = bool(mines) and any(m in (ch.mine_codes or []) for m in mines)
        fy_ok = bool(fy) and fy in (ch.financial_year or "").split(",")
        metric_ok = bool(metrics) and any(m in (ch.metrics or []) for m in metrics)
        topic_ok = bool(topic) and ch.topic == topic
        if require_filter:
            if mines and not mine_ok:
                continue
            if fy and not fy_ok:
                continue
            if metrics and not metric_ok:
                continue
        score = 0.45 * sim + 0.25 * overlap
        score += 0.12 if mine_ok else 0
        score += 0.08 if fy_ok else 0
        score += 0.07 if metric_ok else 0
        score += 0.03 if topic_ok else 0
        # single-mine primary reports are more authoritative than aggregate tables
        if mine_ok and len(ch.mine_codes or []) == 1:
            score += 0.10
        score *= 1.0 if ch.verified else 0.9
        hits.append(Hit(ch, sim, score))
    hits.sort(key=lambda h: h.score, reverse=True)
    if one_per_document:
        seen, unique = set(), []
        for h in hits:
            if h.chunk.document_id not in seen:
                seen.add(h.chunk.document_id)
                unique.append(h)
        hits = unique
    return hits[:k]


def relevance_pct(hit: Hit, top: float) -> float:
    """Map raw hybrid score to a display relevance in [55, 99]."""
    if top <= 0:
        return 0.0
    return round(min(99.0, 55 + 44 * (hit.score / top) ** 1.5 * min(1.0, top / 0.6)), 1)
