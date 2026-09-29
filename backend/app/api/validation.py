from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import get_db
from app.models.models import Document, ExtractedField, ValidationRecord
from app.schemas.schemas import ApproveRequest, EditRequest, RejectRequest
from app.services import validation_service as V
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/validation", tags=["validation"])


@router.get("/queue")
def queue(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    fields = (db.query(ExtractedField).filter(ExtractedField.status == "pending")
              .order_by(ExtractedField.confidence).all())
    docs = {d.id: d for d in db.query(Document).filter(Document.id.in_({f.document_id for f in fields})).all()}
    recent = db.query(ValidationRecord).order_by(ValidationRecord.timestamp.desc()).limit(10).all()
    recent_fields = {f.id: f for f in db.query(ExtractedField).filter(ExtractedField.id.in_({r.field_id for r in recent})).all()}
    total = db.query(ExtractedField).count()
    return {
        "pending": [{**S.field(f), "document": S.document(docs[f.document_id])} for f in fields],
        "stats": {
            "pending": len(fields),
            "approved": db.query(ExtractedField).filter_by(status="approved").count(),
            "auto_accepted": db.query(ExtractedField).filter_by(status="auto_accepted").count(),
            "rejected": db.query(ExtractedField).filter_by(status="rejected").count(),
            "total": total,
            "threshold": V.AUTO_ACCEPT_THRESHOLD,
        },
        "recent": [{"id": r.id, "action": r.action, "field": recent_fields[r.field_id].label if r.field_id in recent_fields else "",
                    "document_id": recent_fields[r.field_id].document_id if r.field_id in recent_fields else None,
                    "previous_value": r.previous_value, "new_value": r.new_value, "user": r.user, "timestamp": S.iso(r.timestamp)} for r in recent],
    }


def _run(fn, *args):
    try:
        return S.field(fn(*args))
    except V.ValidationError as e:
        raise HTTPException(status_code=422 if "not found" not in str(e) else 404, detail=str(e))


@router.post("/{field_id}/approve")
def approve(field_id: int, body: ApproveRequest | None = None, db: Session = Depends(get_db), user: dict = Depends(require("validate"))):
    return _run(V.approve, db, field_id, user, (body.comment if body else ""))


@router.post("/{field_id}/edit")
def edit(field_id: int, body: EditRequest, db: Session = Depends(get_db), user: dict = Depends(require("validate"))):
    return _run(V.edit, db, field_id, user, body.value, body.reason)


@router.post("/{field_id}/reject")
def reject(field_id: int, body: RejectRequest | None = None, db: Session = Depends(get_db), user: dict = Depends(require("validate"))):
    return _run(V.reject, db, field_id, user, (body.reason if body else ""))


@router.get("/{field_id}/history")
def history(field_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    rows = db.query(ValidationRecord).filter_by(field_id=field_id).order_by(ValidationRecord.timestamp).all()
    return [{"action": r.action, "previous_value": r.previous_value, "new_value": r.new_value, "reason": r.reason,
             "user": r.user, "timestamp": S.iso(r.timestamp)} for r in rows]
