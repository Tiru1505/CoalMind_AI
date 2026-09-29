import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import BASE_DIR, get_db
from app.models.models import Document, DocumentPage, ExtractedField
from app.services import audit_service, document_processor
from app.services.ocr_service import FileValidationError, parse_structure, validate_file
from app.services.validation_service import doc_fields
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/documents", tags=["documents"])
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"


def _get(db: Session, doc_id: int, user: dict) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None or doc.owner_id != user["id"]:  # each user only sees their own workspace
        raise HTTPException(404, "Document not found")
    return doc


@router.get("")
def list_documents(q: str = "", status: str = "", file_type: str = "", db: Session = Depends(get_db), user: dict = Depends(current_user)):
    query = db.query(Document).filter(Document.owner_id == user["id"])
    if status:
        query = query.filter(Document.status == status)
    if file_type:
        query = query.filter(Document.file_type == file_type.lower())
    docs = query.order_by(Document.uploaded_at.desc()).all()
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in f"{d.title} {d.filename} {d.mine_label} {d.doc_category} {d.financial_year}".lower()]
    return [S.document(d) for d in docs]


@router.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db), user: dict = Depends(require("upload"))):
    data = await file.read()
    name = Path(file.filename or "").name
    try:
        ext = validate_file(name, data)
        info = parse_structure(ext, data)
    except FileValidationError as e:
        audit_service.for_user(db, user, action="Upload rejected by file validation", category="upload",
                          status="Rejected", document_label=name[:200], source="File validation", details={"reason": str(e)}, commit=True)
        raise HTTPException(status_code=422, detail=str(e))
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:180]
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / f"{uuid.uuid4().hex[:8]}_{safe}"
    path.write_bytes(data)
    profile = document_processor.infer_profile(db, safe)
    mine = profile.get("mine")
    title = re.sub(r"[_]+", " ", safe.rsplit(".", 1)[0]).strip()
    doc = Document(owner_id=user["id"], filename=safe, title=title, file_type=ext, doc_category=profile["category"], mine_id=mine.id if mine else None,
                   mine_label=mine.short_name if mine else "Unassigned", financial_year=profile["fy"], source_kind=info.source_kind,
                   pages=info.pages, size_kb=max(1, len(data) // 1024), uploaded_by=user["name"], status="Uploaded",
                   topics=profile.get("topics", []), storage_path=str(path.relative_to(BASE_DIR)))
    db.add(doc)
    db.flush()
    audit_service.for_user(db, user, action="Uploaded document", category="upload", status="Uploaded",
                      document=doc, source=f"{ext.upper()} · {info.detail}",
                      details={"size_bytes": len(data), "signature_check": "passed", "parsed": info.detail})
    db.commit()
    return S.document(doc)


@router.get("/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    doc = _get(db, doc_id, user)
    fields = doc_fields(db, doc)
    return {**S.document(doc), "processing_log": doc.processing_log or [],
            "field_summary": {"total": len(fields), "pending": sum(f.status == "pending" for f in fields),
                              "approved": sum(f.status == "approved" for f in fields),
                              "auto_accepted": sum(f.status == "auto_accepted" for f in fields),
                              "rejected": sum(f.status == "rejected" for f in fields)},
            "page_count_indexed": db.query(DocumentPage).filter_by(document_id=doc.id).count()}


@router.post("/{doc_id}/process")
def process_document(doc_id: int, db: Session = Depends(get_db), user: dict = Depends(require("process"))):
    doc = _get(db, doc_id, user)
    return document_processor.process(db, doc, user)


@router.get("/{doc_id}/extraction")
def extraction(doc_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    doc = _get(db, doc_id, user)
    fields = doc_fields(db, doc)
    pages = db.query(DocumentPage).filter_by(document_id=doc.id).order_by(DocumentPage.page_number).all()
    normalization = [
        {"field": f.label, "original": f.original_text, "normalized": _normalized(f), "rule": _rule(f)}
        for f in fields if f.original_text.strip() != _normalized(f)
    ]
    order = ["Unit conversion", "Date normalisation", "Unit standardisation: M.Cum", "OCR cleanup", "Unit standardisation: Million", "Title", "Format"]
    normalization.sort(key=lambda n: next((i for i, o in enumerate(order) if n["rule"].startswith(o)), 99))
    return {"document": S.document(doc), "fields": [S.field(f) for f in fields], "pages": [S.page(p) for p in pages],
            "normalization": normalization[:6]}


def _normalized(f: ExtractedField) -> str:
    if f.field_key == "financial_year" or f.unit == "":
        return f.ai_value
    return f"{f.ai_value} {f.unit}"


def _rule(f: ExtractedField) -> str:
    o = f.original_text.lower()
    if "tonnes" in o and f.unit == "MT":
        return "Unit conversion: tonnes → million tonnes (MT)"
    if "million tonnes" in o:
        return "Unit standardisation: Million Tonnes → MT"
    if "m.cum" in o or "cum/t" in o:
        return "Unit standardisation: M.Cum → Mm³, Cum/T → m³/t"
    if f.field_key == "financial_year":
        return "Date normalisation: short FY → FY YYYY-YY"
    if " ha" in o or "*" in o:
        return "OCR cleanup: stray whitespace / footnote marker removed"
    if "annual production report" in o:
        return "Title normalisation"
    return "Format standardisation"


@router.get("/{doc_id}/pages/{page_number}")
def get_page(doc_id: int, page_number: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    doc = _get(db, doc_id, user)
    p = db.query(DocumentPage).filter_by(document_id=doc.id, page_number=page_number).first()
    if p is None:
        raise HTTPException(404, "Page not indexed")
    fields = db.query(ExtractedField).filter_by(document_id=doc.id, page_number=page_number).all()
    return {"document": S.document(doc), "page": S.page(p), "fields": [S.field(f) for f in fields]}
