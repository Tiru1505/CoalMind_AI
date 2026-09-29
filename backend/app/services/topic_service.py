"""Topic Intelligence.

Prototype: topics, keyword weights and yearly frequencies are seeded from a
curated taxonomy; live document counts and recent documents are computed from
the database, and the keyword cloud is re-weighted from indexed chunk text.

Production replacement: BERTopic over Sentence-BERT embeddings of all chunks
(UMAP + HDBSCAN + c-TF-IDF), re-fitted nightly, with topics_over_time() for
the trend chart.
"""
from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.database.demo_data import GLOBAL_KEYWORDS
from app.models.models import Document, KnowledgeChunk, Mine, ProductionRecord, SystemMeta, Topic
from app.services.embedding_service import tokenize

MODEL_INFO = "BERTopic-style taxonomy (simulated) · c-TF-IDF keyword weighting"


def topic_to_dict(db: Session, t: Topic, owner_id: int, detail: bool = False) -> dict:
    live_docs = [d for d in db.query(Document).filter_by(owner_id=owner_id).all() if t.slug in (d.topics or [])]
    base = (db.get(SystemMeta, f"baseline:{owner_id}") or SystemMeta(value={})).value
    # seeded counts already include the demo library; add documents uploaded & processed since the seed
    new_docs = [d for d in live_docs if d.id > base.get("max_doc_id", 10**9) and d.status in ("Processed", "Approved", "Validation Required")]
    out = {
        "id": t.id, "slug": t.slug, "name": t.name, "description": t.description, "color": t.color,
        "document_count": t.document_count + len(new_docs), "trend_pct": t.trend_pct,
        "keywords": [{"term": k, "weight": w} for k, w in t.keywords], "yearly": t.yearly,
    }
    if detail:
        mines = db.query(Mine).filter(Mine.code.in_(t.related_mines)).all()
        chunks = db.query(KnowledgeChunk).filter_by(topic=t.slug, owner_id=owner_id).count()
        out.update({
            "related_mines": [{"code": m.code, "name": m.short_name, "subsidiary": m.subsidiary} for m in mines],
            "recent_documents": [
                {"id": d.id, "title": d.title, "filename": d.filename, "financial_year": d.financial_year, "status": d.status,
                 "uploaded_at": d.uploaded_at.isoformat() + "Z", "mine": d.mine_label}
                for d in sorted(live_docs, key=lambda d: d.uploaded_at, reverse=True)[:6]
            ],
            "statistics": topic_statistics(db, t.slug, owner_id),
            "indexed_chunks": chunks,
            "model": MODEL_INFO,
        })
    return out


def topic_statistics(db: Session, slug: str, owner_id: int) -> list[dict]:
    fy = "2024-25"
    recs = (db.query(ProductionRecord).join(Mine)
            .filter(ProductionRecord.owner_id == owner_id, ProductionRecord.financial_year == fy, Mine.subsidiary == "SECL").all())
    if not recs:
        return []
    if slug == "production-output":
        p = sum(r.coal_production_mt for r in recs); t = sum(r.target_mt for r in recs)
        return [{"label": f"Korba group production FY {fy}", "value": f"{p:.1f} MT"}, {"label": "Combined target", "value": f"{t:.1f} MT"},
                {"label": "Achievement", "value": f"{p / t * 100:.1f}%"}, {"label": "Mines above target", "value": str(sum(1 for r in recs if r.coal_production_mt > r.target_mt))}]
    if slug == "land-reclamation":
        land = sum(r.land_reclaimed_ha for r in recs)
        return [{"label": f"Land reclaimed FY {fy}", "value": f"{land:g} ha"}, {"label": "Largest contributor", "value": max(recs, key=lambda r: r.land_reclaimed_ha).mine.short_name},
                {"label": "Saplings planted", "value": f"{int(land * 2500):,}"}, {"label": "Plantation survival", "value": "81%"}]
    if slug == "geological-exploration":
        return [{"label": "Blocks assessed", "value": "8"}, {"label": "Boreholes (latest cycle)", "value": "2,849"},
                {"label": "Exploratory drilling", "value": "671,800 m"}, {"label": "Geological reserves (tracked)", "value": "5,311.6 MT"}]
    if slug == "safety-compliance":
        inc = sum(r.safety_incidents for r in recs)
        return [{"label": f"Reportable incidents FY {fy}", "value": str(inc)}, {"label": "Fatal accidents", "value": "Nil"},
                {"label": "DGMS compliance", "value": "95.8%"}, {"label": "Safety audits", "value": "4 per mine / year"}]
    if slug == "environment":
        return [{"label": "Green belt (Gevra)", "value": "612 ha"}, {"label": "PM10 core zone (avg)", "value": "212 µg/m³"},
                {"label": "Water recycled for sprinkling", "value": "68%"}, {"label": "Cumulative plantation", "value": "2.94 M saplings"}]
    if slug == "manpower-productivity":
        mp = sum(r.manpower for r in recs); p = sum(r.coal_production_mt for r in recs)
        return [{"label": f"Manpower FY {fy}", "value": f"{mp:,}"}, {"label": "Average OMS", "value": f"{p * 1e6 / (mp * 300):.1f} t"},
                {"label": "Highest OMS", "value": max(recs, key=lambda r: r.productivity_oms).mine.short_name}, {"label": "HEMM availability", "value": "78%"}]
    return []


def keyword_cloud(db: Session, owner_id: int, topic_slug: str | None = None) -> list[dict]:
    """Seed weights blended with live term frequency from the user's indexed chunks."""
    q = db.query(KnowledgeChunk).filter_by(owner_id=owner_id)
    if topic_slug:
        q = q.filter_by(topic=topic_slug)
    counts = Counter(tok for ch in q.all() for tok in tokenize(ch.content))
    top = max(counts.values()) if counts else 1
    out = []
    for term, w in GLOBAL_KEYWORDS:
        live = counts.get(tokenize(term)[0], 0) / top if tokenize(term) else 0
        out.append({"term": term, "weight": round(0.8 * w + 20 * live, 1)})
    return sorted(out, key=lambda x: -x["weight"])
