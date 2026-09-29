from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import get_db
from app.models.models import AuditLog
from app.utils.security import require

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("")
def list_logs(category: str = "", q: str = "", limit: int = 200, db: Session = Depends(get_db), user: dict = Depends(require("view_audit"))):
    query = db.query(AuditLog)
    if category:
        query = query.filter(AuditLog.category == category)
    rows = query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(min(limit, 500)).all()
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in f"{r.user} {r.action} {r.document_label} {r.status} {r.source}".lower()]
    return [S.audit(r) for r in rows]


@router.get("/{log_id}")
def get_log(log_id: int, db: Session = Depends(get_db), user: dict = Depends(require("view_audit"))):
    r = db.get(AuditLog, log_id)
    if r is None:
        raise HTTPException(404, "Audit entry not found")
    related = []
    if r.document_id:
        related = [S.audit(x) for x in db.query(AuditLog).filter(AuditLog.document_id == r.document_id, AuditLog.id != r.id)
                   .order_by(AuditLog.timestamp.desc()).limit(8).all()]
    return {**S.audit(r), "related": related}
