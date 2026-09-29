"""Human-in-the-loop validation.

Fields at or above AUTO_ACCEPT_THRESHOLD are auto-accepted (still visible and
reversible); fields below it are routed to an officer. Approved values are
written back to the structured tables (production_records) and the related
knowledge chunks are marked verified, so downstream AI answers and reports
only rely on validated figures.
"""
from __future__ import annotations

import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import Document, ExtractedField, KnowledgeChunk, ProductionRecord, ValidationRecord
from app.services import audit_service

AUTO_ACCEPT_THRESHOLD = 80
HIGH_CONFIDENCE = 90


class ValidationError(ValueError):
    pass


def band(conf: float) -> str:
    return "high" if conf >= HIGH_CONFIDENCE else "medium" if conf >= AUTO_ACCEPT_THRESHOLD else "low"


def effective_value(f: ExtractedField) -> str:
    return f.human_value if f.human_value not in (None, "") else f.ai_value


def _numeric(value: str) -> float | None:
    cleaned = value.replace(",", "").strip()
    return float(cleaned) if re.fullmatch(r"-?\d+(\.\d+)?", cleaned) else None


def _write_back(db: Session, doc: Document, f: ExtractedField) -> dict | None:
    if not f.record_column or doc.mine_id is None:
        return None
    rec = db.query(ProductionRecord).filter_by(owner_id=doc.owner_id, mine_id=doc.mine_id, financial_year=doc.financial_year).first()
    num = _numeric(effective_value(f))
    if rec is None or num is None:
        return None
    before = getattr(rec, f.record_column)
    setattr(rec, f.record_column, int(num) if isinstance(before, int) else num)
    rec.source_document_id = doc.id
    rec.status = "Verified"
    return {"table": "production_records", "column": f.record_column, "before": before, "after": num}


def _refresh_document(db: Session, doc: Document) -> None:
    fields = db.query(ExtractedField).filter_by(document_id=doc.id).all()
    pending_pages = {f.page_number for f in fields if f.status == "pending"}
    for ch in db.query(KnowledgeChunk).filter_by(document_id=doc.id).all():
        ch.verified = ch.page_number not in pending_pages
    if not pending_pages and doc.status in ("Validation Required", "Processed"):
        doc.status = "Approved"


def _get(db: Session, field_id: int, user: dict) -> tuple[ExtractedField, Document]:
    f = db.get(ExtractedField, field_id)
    doc = db.get(Document, f.document_id) if f else None
    if f is None or doc is None or doc.owner_id != user["id"]:  # users only act on their own workspace
        raise ValidationError("Field not found")
    return f, doc


def approve(db: Session, field_id: int, user: dict, comment: str = "") -> ExtractedField:
    f, doc = _get(db, field_id, user)
    prev = effective_value(f)
    f.status = "approved"
    f.validated_by = user["name"]
    f.validated_at = datetime.utcnow()
    db.add(ValidationRecord(field_id=f.id, action="approve", previous_value=prev, new_value=prev,
                            reason=comment, user=user["name"]))
    wb = _write_back(db, doc, f)
    corrected = f.human_value not in (None, "") and f.human_value != f.ai_value
    audit_service.log(
        db, user=user["name"], role=user["role"],
        action=f"Approved {'corrected' if corrected else 'extracted'} value — {f.label}",
        category="validation", status="Approved", document=doc, source=f"Source page {f.page_number}",
        details={"field": f.label, "original_value": f.original_text, "ai_value": f"{f.ai_value} {f.unit}".strip(),
                 "human_value": f"{f.human_value} {f.unit}".strip() if corrected else None,
                 "confidence": f.confidence, "source_page": f.page_number, "model": "Entity extractor v2 (simulated)",
                 "write_back": wb, "comment": comment},
    )
    _refresh_document(db, doc)
    if doc.status == "Approved":
        audit_service.log(db, user=user["name"], role=user["role"], action="Document fully validated and published to knowledge base",
                          category="validation", status="Approved", document=doc, source="Knowledge base",
                          details={"verified_fields": len([x for x in doc_fields(db, doc) if x.status in ("approved", "auto_accepted")])})
    db.commit()
    return f


def edit(db: Session, field_id: int, user: dict, value: str, reason: str = "") -> ExtractedField:
    value = (value or "").strip()
    if not value:
        raise ValidationError("Corrected value cannot be empty")
    if len(value) > 120:
        raise ValidationError("Corrected value is too long")
    f, doc = _get(db, field_id, user)
    if _numeric(f.ai_value) is not None and _numeric(value) is None:
        raise ValidationError(f"'{f.label}' expects a numeric value (e.g. {f.ai_value})")
    prev = effective_value(f)
    f.human_value = value if value.replace(",", "") != f.ai_value.replace(",", "") else None
    f.status = "pending"
    db.add(ValidationRecord(field_id=f.id, action="edit", previous_value=prev, new_value=value, reason=reason, user=user["name"]))
    same = value.replace(",", "") == f.ai_value.replace(",", "")
    audit_service.log(
        db, user=user["name"], role=user["role"],
        action=f"{'Verified against source' if same else 'Corrected extracted value'} — {f.label}", category="validation",
        status="Confirmed" if same else "Corrected", document=doc, source=f"Source page {f.page_number}",
        details={"field": f.label, "original_value": f.original_text, "ai_value": f"{f.ai_value} {f.unit}".strip(),
                 "human_value": None if same else f"{value} {f.unit}".strip(), "confidence": f.confidence,
                 "source_page": f.page_number, "model": "Entity extractor v2 (simulated)", "reason": reason},
    )
    db.commit()
    return f


def reject(db: Session, field_id: int, user: dict, reason: str = "") -> ExtractedField:
    f, doc = _get(db, field_id, user)
    prev = effective_value(f)
    f.status = "rejected"
    f.validated_by = user["name"]
    f.validated_at = datetime.utcnow()
    db.add(ValidationRecord(field_id=f.id, action="reject", previous_value=prev, new_value="", reason=reason, user=user["name"]))
    audit_service.log(
        db, user=user["name"], role=user["role"], action=f"Rejected extracted value — {f.label}", category="validation",
        status="Rejected", document=doc, source=f"Source page {f.page_number}",
        details={"field": f.label, "original_value": f.original_text, "ai_value": f"{f.ai_value} {f.unit}".strip(),
                 "confidence": f.confidence, "source_page": f.page_number, "reason": reason,
                 "model": "Entity extractor v2 (simulated)"},
    )
    _refresh_document(db, doc)
    db.commit()
    return f


def doc_fields(db: Session, doc: Document) -> list[ExtractedField]:
    return db.query(ExtractedField).filter_by(document_id=doc.id).order_by(ExtractedField.order).all()
