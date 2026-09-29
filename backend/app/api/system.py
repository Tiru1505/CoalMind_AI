from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dashboard import live_totals
from app.database.db import DATABASE_URL, get_db
from app.database.seed import reset_and_seed, reset_workspace
from app.models.models import AuditLog, Document, Mine, Report, Topic, User
from app.services import audit_service, consistency_service
from app.services.embedding_service import get_embedder
from app.services.llm_service import get_llm
from app.services.ocr_service import OCR_ENGINE
from app.services.topic_service import MODEL_INFO
from app.services.validation_service import AUTO_ACCEPT_THRESHOLD
from app.utils.security import PERMISSIONS, current_user, mask_mobile, require

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat() + "Z"}


@router.get("/system/info")
def system_info(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    llm = get_llm()
    is_admin = "manage_users" in user["permissions"]
    return {
        "deployment": "On-Premise / Private Infrastructure",
        "ai": "Open-weight models",
        "external_api_dependency": "None in Demo Mode" if llm.provider == "mock" else f"Local endpoint: {getattr(llm, 'base_url', '')}",
        "data": "Organizational / Controlled · per-user workspaces",
        "demo_mode": llm.provider == "mock",
        "version": "1.1.0-prototype",
        "ai_configuration": {
            "ocr_engine": "PaddleOCR (fallback: Tesseract)", "ocr_runtime": OCR_ENGINE,
            "layout_model": "LayoutLMv3 (planned) · simulated", "table_extraction": "Table Transformer (planned) · simulated",
            "embedding_model": "Sentence-BERT", "embedding_runtime": get_embedder().name,
            "vector_database": "pgvector", "vector_runtime": "SQLite JSON vectors (demo)",
            "llm": "Local / Open-weight LLM", "llm_runtime": llm.name,
            "topic_model": "BERTopic", "topic_runtime": MODEL_INFO,
            "auto_accept_threshold": AUTO_ACCEPT_THRESHOLD, "deployment": "On-premise",
        },
        "database": "SQLite (demo)" if DATABASE_URL.startswith("sqlite") else "PostgreSQL",
        "roles": {k: sorted(v) for k, v in PERMISSIONS.items()},
        "users": [{"employee_id": u.employee_id, "name": u.name, "role": u.role, "designation": u.designation, "department": u.department,
                   "mobile": mask_mobile(u.mobile), "last_login": u.last_login.isoformat() + "Z" if u.last_login else None}
                  for u in db.query(User).order_by(User.id).all()] if is_admin else [],
    }


@router.post("/demo/reset")
def demo_reset(scope: str = "mine", db: Session = Depends(get_db), user: dict = Depends(require("reset_demo"))):
    """Reset the signed-in user's own workspace. Admins may rebuild the whole demo database (scope=all)."""
    if scope == "all":
        if "manage_users" not in user["permissions"]:
            raise HTTPException(403, "Only administrators can reset every workspace.")
        db.close()
        return {"ok": True, "scope": "all", **reset_and_seed()}
    u = db.get(User, user["id"])
    result = reset_workspace(db, u)
    audit_service.for_user(db, user, action="Loaded demo scenario (workspace reset)", category="system", status="Completed",
                           source="Demo Mode", details=result, commit=True)
    return {"ok": True, "scope": "mine", **result}


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    uid = user["id"]
    items = []
    t = live_totals(db, uid)
    vr_docs = db.query(Document).filter_by(owner_id=uid, status="Validation Required").all()
    if vr_docs:
        items.append({"id": "val", "type": "warning", "title": f"{len(vr_docs)} document{'s' if len(vr_docs) != 1 else ''} require validation",
                      "body": ", ".join(d.title for d in vr_docs[:2]), "link": "/validation", "time": datetime.utcnow().isoformat() + "Z"})
    scan = consistency_service.scan(db, uid)
    if scan["open_conflicts"]:
        items.append({"id": f"cg{scan['open_conflicts']}", "type": "error" if scan["high_severity"] else "warning",
                      "title": f"{scan['open_conflicts']} cross-source conflict{'s' if scan['open_conflicts'] != 1 else ''} detected",
                      "body": "Documents disagree on official figures — review in Consistency Guard", "link": "/consistency",
                      "time": datetime.utcnow().isoformat() + "Z"})
    for a in db.query(AuditLog).filter(AuditLog.owner_id == uid, AuditLog.category.in_(["report", "processing", "ai", "validation"]))\
            .order_by(AuditLog.timestamp.desc()).limit(12).all():
        kind, title, link = None, None, None
        if a.category == "report" and "Generated" in a.action:
            kind, title, link = "info", "New report generated", "/reports"
        elif a.category == "validation" and "low-confidence" in a.action:
            kind, title, link = "warning", "Low-confidence extraction detected", f"/documents/{a.document_id}/extraction"
        elif a.category == "ai" and a.status == "Answered":
            kind, title, link = "success", "AI query completed", "/ai-query"
        elif a.category == "processing" and a.status == "Failed":
            kind, title, link = "error", "Document processing failed", f"/documents/{a.document_id}"
        elif a.category == "processing" and a.action.startswith("Extracted"):
            kind, title, link = "success", "Document processed", f"/documents/{a.document_id}"
        if kind and not any(i["title"] == title for i in items):
            items.append({"id": f"a{a.id}", "type": kind, "title": title, "body": a.document_label or a.action, "link": link,
                          "time": a.timestamp.isoformat() + "Z"})
    return {"items": items[:8], "pending_validation": t["live_pending_fields"], "open_conflicts": scan["open_conflicts"]}


@router.get("/search")
def global_search(q: str = Query(min_length=1, max_length=100), db: Session = Depends(get_db), user: dict = Depends(current_user)):
    ql = q.lower().strip()
    out = []
    for m in db.query(Mine).all():
        if ql in m.name.lower() or any(ql in a for a in m.aliases):
            out.append({"type": "Mine", "label": m.name, "sub": f"{m.subsidiary} · {m.area}", "link": f"/analytics?mine={m.code}"})
    for d in db.query(Document).filter_by(owner_id=user["id"]).order_by(Document.uploaded_at.desc()).all():
        if ql in f"{d.title} {d.filename} {d.financial_year}".lower():
            out.append({"type": "Document", "label": d.title, "sub": f"{d.status} · FY {d.financial_year}", "link": f"/documents/{d.id}"})
    for r in db.query(Report).filter_by(owner_id=user["id"]).order_by(Report.created_at.desc()).all():
        if ql in f"{r.title} {r.report_type} {r.financial_year}".lower():
            out.append({"type": "Report", "label": r.title, "sub": f"{r.report_no} · {r.status}", "link": f"/reports?id={r.id}"})
    for t in db.query(Topic).all():
        if ql in t.name.lower() or any(ql in k[0].lower() for k in t.keywords):
            out.append({"type": "Topic", "label": t.name, "sub": f"{t.document_count} documents", "link": f"/topics/{t.slug}"})
    if "query_ai" in user["permissions"]:
        out.append({"type": "Ask AI", "label": f"Ask CoalMind AI: “{q}”", "sub": "Source-grounded answer", "link": f"/ai-query?q={q}"})
    return out[:12]
