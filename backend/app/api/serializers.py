"""Model -> JSON helpers shared by the routers."""
from __future__ import annotations

from app.models.models import AuditLog, Document, DocumentPage, ExtractedField, Report
from app.services.validation_service import band, effective_value


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def document(d: Document) -> dict:
    return {
        "id": d.id, "filename": d.filename, "title": d.title, "file_type": d.file_type, "category": d.doc_category,
        "mine_id": d.mine_id, "mine": d.mine_label, "financial_year": d.financial_year, "language": d.language,
        "source_kind": d.source_kind, "pages": d.pages, "size_kb": d.size_kb, "uploaded_by": d.uploaded_by,
        "uploaded_at": iso(d.uploaded_at), "status": d.status, "confidence": d.confidence,
        "fields_extracted": d.fields_extracted, "tables_detected": d.tables_detected, "topics": d.topics or [],
        "error": d.error, "is_demo_target": d.is_demo_target,
    }


def field(f: ExtractedField) -> dict:
    return {
        "id": f.id, "document_id": f.document_id, "key": f.field_key, "label": f.label, "original_text": f.original_text,
        "ai_value": f.ai_value, "human_value": f.human_value, "value": effective_value(f), "unit": f.unit,
        "confidence": f.confidence, "band": band(f.confidence), "page": f.page_number, "anchor": f.anchor,
        "warning": f.warning, "status": f.status, "validated_by": f.validated_by, "validated_at": iso(f.validated_at),
        "maps_to": f"production_records.{f.record_column}" if f.record_column else None,
    }


def page(p: DocumentPage) -> dict:
    return {"page_number": p.page_number, "title": p.title, "blocks": p.blocks, "ocr_confidence": p.ocr_confidence}


def report(r: Report, full: bool = False) -> dict:
    out = {"id": r.id, "report_no": r.report_no, "title": r.title, "report_type": r.report_type, "scope": r.scope,
           "financial_year": r.financial_year, "date_range": r.date_range, "sections": r.sections, "status": r.status,
           "generated_by": r.generated_by, "approved_by": r.approved_by, "created_at": iso(r.created_at)}
    if full:
        out["content"] = r.content
    return out


def audit(a: AuditLog) -> dict:
    return {"id": a.id, "timestamp": iso(a.timestamp), "owner_id": a.owner_id, "user": a.user, "role": a.role, "action": a.action, "category": a.category,
            "document_id": a.document_id, "document": a.document_label, "status": a.status, "source": a.source, "details": a.details}
