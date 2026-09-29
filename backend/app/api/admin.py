"""Administrator console: users, workspaces and platform health across the organisation."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import get_db
from app.models.models import AIQuery, AuditLog, Document, KnowledgeChunk, Report, User
from app.services.embedding_service import get_embedder
from app.services.llm_service import get_llm
from app.services.ocr_service import OCR_ENGINE
from app.utils.security import mask_mobile, require

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: dict = Depends(require("manage_users"))):
    now = datetime.utcnow()
    users = db.query(User).order_by(User.id).all()
    rows = []
    for u in users:
        docs = db.query(Document).filter_by(owner_id=u.id)
        rows.append({
            "id": u.id, "name": u.name, "role": u.role, "designation": u.designation, "employee_id": u.employee_id,
            "mobile": mask_mobile(u.mobile), "active": u.active,
            "last_login": u.last_login.isoformat() + "Z" if u.last_login else None, "created_at": u.created_at.isoformat() + "Z",
            "documents": docs.count(), "processed": docs.filter(Document.status.in_(["Processed", "Approved", "Validation Required"])).count(),
            "queries": db.query(AIQuery).filter_by(owner_id=u.id).count(), "reports": db.query(Report).filter_by(owner_id=u.id).count(),
        })
    by_role: dict[str, int] = {}
    for u in users:
        by_role[u.role] = by_role.get(u.role, 0) + 1
    day = now - timedelta(days=1)
    activity = []
    for i in range(7, -1, -1):
        start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        activity.append({"day": start.strftime("%d %b"),
                         "events": db.query(AuditLog).filter(AuditLog.timestamp >= start, AuditLog.timestamp < end).count(),
                         "queries": db.query(AuditLog).filter(AuditLog.category == "ai", AuditLog.timestamp >= start, AuditLog.timestamp < end).count()})
    llm = get_llm()
    return {
        "kpis": {
            "users": len(users), "active_24h": sum(1 for u in users if u.last_login and u.last_login >= day),
            "workspaces": len({r["id"] for r in rows if r["documents"]}),
            "documents": db.query(Document).count(), "chunks": db.query(KnowledgeChunk).count(),
            "queries": db.query(AIQuery).count(), "reports": db.query(Report).count(),
            "failed": db.query(Document).filter_by(status="Failed").count(),
            "sign_ins_24h": db.query(AuditLog).filter(AuditLog.category == "auth", AuditLog.action == "Signed in", AuditLog.timestamp >= day).count(),
            "failed_otp_24h": db.query(AuditLog).filter(AuditLog.category == "auth", AuditLog.status == "Rejected", AuditLog.timestamp >= day).count(),
        },
        "users": rows,
        "by_role": [{"role": k, "value": v} for k, v in by_role.items()],
        "activity": activity,
        "services": [
            {"name": "API gateway (FastAPI)", "status": "operational", "detail": "All routes responding"},
            {"name": "OCR engine", "status": "operational", "detail": OCR_ENGINE},
            {"name": "Embedding service", "status": "operational", "detail": get_embedder().name},
            {"name": "Vector index", "status": "operational", "detail": f"{db.query(KnowledgeChunk).count()} chunks across all workspaces"},
            {"name": "LLM runtime", "status": "operational", "detail": llm.name},
            {"name": "SMS / OTP gateway", "status": "demo", "detail": "Not configured — OTP displayed on screen (Demo Mode)"},
        ],
        "recent": [S.audit(a) for a in db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(12).all()],
    }
