from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dashboard import PROCESSED, baseline
from app.database.db import get_db
from app.database.demo_data import DISPLAY_TOTALS
from app.models.models import Document, ExtractedField, KnowledgeChunk, Mine
from app.services import rag_service, vector_search
from app.services.embedding_service import get_embedder
from app.utils.security import current_user

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    uid = user["id"]
    base = baseline(db, uid)
    docs = db.query(Document).filter_by(owner_id=uid).all()
    live = [d for d in docs if d.status in PROCESSED]
    chunks = db.query(KnowledgeChunk).filter_by(owner_id=uid).count()
    verified_chunks = db.query(KnowledgeChunk).filter_by(owner_id=uid, verified=True).count()
    fq = db.query(ExtractedField).join(Document, Document.id == ExtractedField.document_id).filter(Document.owner_id == uid)
    verified_fields = fq.filter(ExtractedField.status.in_(["approved", "auto_accepted"])).count()
    fields = fq.count()
    tables = sum(d.tables_detected for d in docs)
    by_category, by_fy = {}, {}
    for d in live:
        by_category[d.doc_category] = by_category.get(d.doc_category, 0) + 1
        by_fy[d.financial_year] = by_fy.get(d.financial_year, 0) + 1
    return {
        "documents_indexed": DISPLAY_TOTALS["documents_processed"] + len(live) - base.get("processed_docs", 0),
        "knowledge_chunks": DISPLAY_TOTALS["knowledge_chunks"] + chunks - base.get("chunks", 0),
        "entities": DISPLAY_TOTALS["entities"] + fields - base.get("field_rows", 0),
        "tables": DISPLAY_TOTALS["tables"] + tables - base.get("tables", 0),
        "verified_records": DISPLAY_TOTALS["verified_records"] + verified_fields - base.get("verified_fields", 0),
        "demo_library": {"documents": len(live), "chunks": chunks, "verified_chunks": verified_chunks, "verified_fields": verified_fields},
        "by_category": [{"name": k, "value": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "by_year": [{"fy": k, "value": v} for k, v in sorted(by_fy.items())],
        "embedding_model": get_embedder().name,
        "vector_store": "SQLite JSON vectors (demo) · pgvector in production",
        "recent_additions": [
            {"id": d.id, "title": d.title, "status": d.status, "uploaded_at": d.uploaded_at.isoformat() + "Z",
             "chunks": db.query(KnowledgeChunk).filter_by(document_id=d.id).count(),
             "verified_chunks": db.query(KnowledgeChunk).filter_by(document_id=d.id, verified=True).count()}
            for d in sorted(live, key=lambda d: d.uploaded_at, reverse=True)[:5]
        ],
    }


@router.get("/search")
def search(q: str = Query(min_length=1, max_length=300), mine: str = "", fy: str = "", verified_only: bool = False,
           db: Session = Depends(get_db), user: dict = Depends(current_user)):
    mines = rag_service.parse_mines(db, q)
    if mine:
        m = db.query(Mine).filter_by(code=mine).first()
        mines = [m] if m else mines
    fy_parsed = fy or rag_service.parse_fy(q)
    hits = vector_search.search(db, q, owner_id=user["id"], k=10, mines=[m.code for m in mines] or None, fy=fy_parsed,
                                verified_only=verified_only)
    specific = set(rag_service.tokenize(q)) - rag_service.GENERIC
    results = []
    top = hits[0].score if hits else 0
    for h in hits:
        c_tokens = set(rag_service.tokenize(h.chunk.content + " " + h.chunk.document.title))
        if specific and not (specific & c_tokens) and not mines:
            continue
        rel = vector_search.relevance_pct(h, top)
        if rel < 58:
            continue
        doc = h.chunk.document
        results.append({
            "chunk_id": h.chunk.id, "document_id": doc.id, "document_title": doc.title, "filename": doc.filename,
            "page": h.chunk.page_number, "section": h.chunk.section,
            "snippet": rag_service.best_line(h.chunk.content, q, mines, fy_parsed, None, len(h.chunk.mine_codes or []) != 1),
            "content": h.chunk.content[:600], "financial_year": h.chunk.financial_year.split(",")[-1] if h.chunk.financial_year else doc.financial_year,
            "mine": ", ".join(m.short_name for m in db.query(Mine).filter(Mine.code.in_(h.chunk.mine_codes or [])).all()) or doc.mine_label,
            "relevance": rel, "verified": h.chunk.verified, "doc_status": doc.status, "topic": h.chunk.topic,
            "extraction_confidence": h.chunk.extraction_confidence,
        })
    return {"query": q, "interpreted": {"mines": [m.short_name for m in mines], "financial_year": fy_parsed},
            "results": results, "count": len(results)}
