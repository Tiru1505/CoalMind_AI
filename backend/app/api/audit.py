"""Audit & history.

Every user sees their own activity history (scope=mine). Administrators can
additionally review the organisation-wide trail across all users (scope=all).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import get_db
from app.models.models import AuditLog
from app.utils.security import current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


def _can_all(user: dict) -> bool:
    return "view_all_audit" in user["permissions"]


@router.get("")
def list_logs(category: str = "", q: str = "", scope: str = "mine", limit: int = 200,
              db: Session = Depends(get_db), user: dict = Depends(current_user)):
    query = db.query(AuditLog)
    if scope == "all":
        if not _can_all(user):
            raise HTTPException(403, "Only administrators can view the organisation-wide audit trail.")
    else:
        query = query.filter(AuditLog.owner_id == user["id"])
    if category:
        query = query.filter(AuditLog.category == category)
    rows = query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(min(limit, 500)).all()
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in f"{r.user} {r.action} {r.document_label} {r.status} {r.source}".lower()]
    return [S.audit(r) for r in rows]


@router.get("/{log_id}")
def get_log(log_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    r = db.get(AuditLog, log_id)
    if r is None or (r.owner_id != user["id"] and not _can_all(user)):
        raise HTTPException(404, "Audit entry not found")
    related = []
    if r.document_id:
        related = [S.audit(x) for x in db.query(AuditLog).filter(AuditLog.document_id == r.document_id, AuditLog.id != r.id)
                   .order_by(AuditLog.timestamp.desc()).limit(8).all()]
    return {**S.audit(r), "related": related}
