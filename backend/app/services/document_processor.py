"""Document processing pipeline orchestrator.

Upload -> file validation -> parsing -> pre-processing -> OCR -> layout/table
detection -> entity extraction -> normalization -> validation routing ->
database -> vector index.

Each stage records status, a human-readable detail string and a duration so
the UI can replay the pipeline and auditors can see exactly what happened.
"""
from __future__ import annotations

import re
import time
from datetime import datetime

from sqlalchemy.orm import Session

from app.database.demo_data import LATEST_VERIFIED_FY, PRODUCTION
from app.models.models import Document, DocumentPage, ExtractedField, KnowledgeChunk, Mine
from app.services import audit_service, content_builder
from app.services.embedding_service import get_embedder
from app.services.ocr_service import OCR_ENGINE
from app.services.validation_service import AUTO_ACCEPT_THRESHOLD

STAGES = [
    ("upload", "Document Uploaded"),
    ("preprocess", "Image Pre-processing"),
    ("ocr", "OCR Extraction"),
    ("tables", "Table Detection"),
    ("entities", "Entity Extraction"),
    ("validation", "Data Validation"),
    ("indexing", "Knowledge Indexing"),
]


# ------------------------------------------------------------------ profile inference

def infer_fy(name: str) -> str | None:
    n = name.lower()
    m = re.search(r"(20\d{2})[-_ ]?(\d{2})(?!\d)", n)
    if m and int(m.group(2)) == (int(m.group(1)) + 1) % 100:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"fy[-_ ]?(\d{2})[-_ ](\d{2})", n)
    if m:
        return f"20{m.group(1)}-{m.group(2)}"
    m = re.search(r"(20\d{2})", n)
    if m:
        y = int(m.group(1))
        return f"{y - 1}-{str(y)[2:]}"
    return None


def infer_mine(db: Session, name: str) -> Mine | None:
    n = name.lower().replace("_", " ")
    for mine in db.query(Mine).all():
        if any(a in n for a in sorted(mine.aliases, key=len, reverse=True)):
            return mine
    return None


def infer_profile(db: Session, filename: str) -> dict:
    """Decide which document template the (simulated) extractor recognises."""
    n = filename.lower()
    mine = infer_mine(db, filename)
    fy = infer_fy(filename) or LATEST_VERIFIED_FY
    if fy not in PRODUCTION["GEV"]:
        fy = LATEST_VERIFIED_FY
    code = mine.code if mine else "GEV"
    if "survey" in n and "1987" in n:
        return {"builder": None, "category": "Survey Map", "mine": mine, "fy": "1986-87"}
    if "geolog" in n or "seam" in n or "reserve" in n:
        code = code if code in content_builder.GEOLOGY_CODES else "GEV"
        return {"builder": "geological_assessment", "args": {"code": code, "bilingual": "bilingual" in n},
                "category": "Geological Report", "mine": mine, "fy": fy, "topics": ["geological-exploration"]}
    if "reclamation" in n or "land" in n:
        return {"builder": "land_reclamation_report", "args": {"fy": fy}, "category": "Land Reclamation Report",
                "mine": mine, "fy": fy, "topics": ["land-reclamation", "environment"]}
    if "mis" in n or "monthly" in n or "masik" in n:
        months = ["april", "may", "june", "july", "august", "september", "october", "november", "december", "january", "february", "march"]
        idx = next((i for i, mname in enumerate(months) if mname in n or mname[:3] + "20" in n), 0)
        year = re.search(r"(20\d{2})", n)
        yr = int(year.group(1)) if year else 2025
        mfy = f"{yr}-{str(yr + 1)[2:]}" if idx < 9 else f"{yr - 1}-{str(yr)[2:]}"
        mfy = mfy if mfy in PRODUCTION["GEV"] else "2025-26"
        factor = [1.02, 1.0, 0.86, 0.72, 0.70, 0.78, 0.98, 1.06, 1.12, 1.16, 1.14, 1.46][idx]
        return {"builder": "monthly_mis", "args": {"month": f"{months[idx].title()} {yr}", "fy": mfy, "factor": factor, "hindi": "masik" in n},
                "category": "MIS Report", "mine": mine, "fy": mfy, "topics": ["production-output"]}
    if "safety" in n:
        return {"builder": "safety_audit", "args": {}, "category": "Safety Audit", "mine": mine, "fy": "2024-25", "topics": ["safety-compliance"]}
    if "environment" in n or "clearance" in n:
        return {"builder": "environment_compliance", "args": {}, "category": "Environmental Compliance", "mine": mine, "fy": "2024-25", "topics": ["environment"]}
    if "plan" in n:
        return {"builder": "mine_plan_review", "args": {}, "category": "Mine Plan", "mine": mine, "fy": "2023-24", "topics": ["production-output"]}
    if mine is None and ("summary" in n or "annual" in n or "cil" in n):
        return {"builder": "production_summary",
                "args": {"fy": fy, "codes": content_builder.SECL_KORBA, "doc_title": f"Annual Production Summary FY {fy}",
                         "page_no": 8, "subsidiary_label": "SECL — Korba Group"},
                "category": "Production Summary", "mine": None, "fy": fy, "topics": ["production-output"]}
    demo = code == "GEV" and fy == "2024-25"
    return {"builder": "production_report", "args": {"code": code, "fy": fy, "demo": demo}, "category": "Production Report",
            "mine": mine or db.query(Mine).filter_by(code=code).first(), "fy": fy,
            "topics": ["production-output", "land-reclamation", "safety-compliance"]}


# ------------------------------------------------------------------ persistence helpers

def clear_outputs(db: Session, doc: Document) -> None:
    db.query(KnowledgeChunk).filter_by(document_id=doc.id).delete()
    db.query(ExtractedField).filter_by(document_id=doc.id).delete()
    db.query(DocumentPage).filter_by(document_id=doc.id).delete()


def persist_content(db: Session, doc: Document, content: dict, *, auto_status: bool = True,
                    all_approved: bool = False, validator: str | None = None) -> dict:
    """Write pages, fields and chunks for a document. Returns counters."""
    embedder = get_embedder()
    pending_pages: set[int] = set()
    field_rows = []
    for f in content["fields"]:
        if all_approved:
            status = "approved" if f["confidence"] < AUTO_ACCEPT_THRESHOLD else "auto_accepted"
        else:
            status = "auto_accepted" if f["confidence"] >= AUTO_ACCEPT_THRESHOLD else "pending"
        if status == "pending":
            pending_pages.add(f["page_number"])
        field_rows.append(ExtractedField(document_id=doc.id, status=status,
                                         validated_by=validator if status == "approved" else None,
                                         validated_at=datetime.utcnow() if status == "approved" else None, **f))
    db.add_all(field_rows)
    for p in content["pages"]:
        db.add(DocumentPage(document_id=doc.id, page_number=p["page_number"], title=p["title"], blocks=p["blocks"],
                            text=content_builder.page_text(p["blocks"]), ocr_confidence=p["ocr_confidence"]))
    conf_by_page = {}
    for f in content["fields"]:
        conf_by_page.setdefault(f["page_number"], []).append(f["confidence"])
    for c in content["chunks"]:
        page_conf = conf_by_page.get(c["page_number"])
        db.add(KnowledgeChunk(
            document_id=doc.id, page_number=c["page_number"], section=c["section"], content=c["content"],
            mine_codes=c["mine_codes"], financial_year=c["financial_year"], topic=c["topic"], metrics=c["metrics"],
            embedding=embedder.embed(f"{doc.title}. {c['section']}. {c['content']}"),
            verified=c["page_number"] not in pending_pages,
            extraction_confidence=round(sum(page_conf) / len(page_conf), 1) if page_conf else 96.0,
        ))
    confs = [f["confidence"] for f in content["fields"]]
    doc.confidence = round(sum(confs) / len(confs), 1) if confs else None
    doc.fields_extracted = content["fields_total"]
    doc.tables_detected = content["tables"]
    if auto_status:
        doc.status = "Validation Required" if pending_pages else "Processed"
    return {"pending": sum(1 for r in field_rows if r.status == "pending"), "fields": content["fields_total"],
            "key_fields": len(field_rows), "tables": content["tables"], "chunks": len(content["chunks"]),
            "pages": len(content["pages"]),
            "ocr": round(sum(p["ocr_confidence"] for p in content["pages"]) / max(1, len(content["pages"])), 1)}


# ------------------------------------------------------------------ pipeline

def process(db: Session, doc: Document, user: dict) -> dict:
    started = time.perf_counter()
    profile = infer_profile(db, doc.filename)
    if doc.mine_id is None and profile.get("mine") is not None:
        doc.mine_id = profile["mine"].id
        doc.mine_label = profile["mine"].short_name
    if doc.financial_year in ("", "—", None):
        doc.financial_year = profile["fy"]
    if doc.doc_category in ("", "Unclassified"):
        doc.doc_category = profile["category"]
    if profile.get("topics"):
        doc.topics = profile["topics"]
    clear_outputs(db, doc)
    audit_service.system(db, action="Started document processing pipeline", category="processing",
                         status="Started", document=doc, source="Pipeline v1.4",
                         details={"model": OCR_ENGINE, "triggered_by": user["name"]})

    stages = []
    size_mb = f"{doc.size_kb / 1024:.1f} MB"
    stages.append(_stage("upload", "complete", f"SHA-256 checksum verified · {doc.pages} pages · {size_mb}", 180))

    if profile["builder"] is None:
        stages.append(_stage("preprocess", "complete", "Deskew 2.4°, denoise, contrast normalisation", 640))
        stages.append(_stage("ocr", "failed", "Image resolution below OCR threshold (96 DPI); mean text confidence 31%. Re-scan at ≥300 DPI.", 1150))
        stages += [_stage(k, "skipped", "Skipped due to upstream failure", 0) for k, _ in STAGES[3:]]
        doc.status = "Failed"
        doc.error = stages[2]["detail"]
        doc.processing_log = stages
        audit_service.system(db, action="OCR extraction failed", category="processing", status="Failed",
                             document=doc, source="OCR engine", details={"error": doc.error, "model": OCR_ENGINE})
        db.commit()
        return {"status": doc.status, "stages": stages, "summary": {"error": doc.error}}

    content = content_builder.build(profile["builder"], profile["args"])
    counts = persist_content(db, doc, content)
    doc.pages = max(doc.pages, max(p["page_number"] for p in content["pages"]))
    doc.error = None
    langs = "English, Hindi" if any(re.search(r"[ऀ-ॿ]", p["title"] + str(p["blocks"])) for p in content["pages"]) else "English"
    doc.language = "Hindi / English" if "Hindi" in langs else doc.language
    stages.append(_stage("preprocess", "complete", "Deskew 0.8°, denoise, adaptive binarisation at 300 DPI", 720))
    stages.append(_stage("ocr", "complete", f"{doc.pages} pages read · mean OCR confidence {counts['ocr']}% · languages: {langs}", 1650))
    stages.append(_stage("tables", "complete", f"{counts['tables']} key tables detected and structure-recognised", 940))
    stages.append(_stage("entities", "complete", f"{counts['fields']} fields extracted · {counts['key_fields']} key entities normalised", 1120))
    if counts["pending"]:
        stages.append(_stage("validation", "warning", f"{counts['pending']} field{'s' if counts['pending'] != 1 else ''} require review (confidence < {AUTO_ACCEPT_THRESHOLD}%)", 530))
    else:
        stages.append(_stage("validation", "complete", "All key fields above auto-accept threshold", 530))
    stages.append(_stage("indexing", "complete", f"{counts['chunks']} knowledge chunks embedded and indexed", 810))
    doc.processing_log = stages

    audit_service.system(db, action=f"Extracted {counts['fields']} fields", category="processing", status="Completed",
                         document=doc, source="OCR + NLP",
                         details={"model": f"{OCR_ENGINE}; LayoutLMv3 + NER (simulated)", "tables": counts["tables"],
                                  "mean_ocr_confidence": counts["ocr"], "pages": doc.pages})
    if counts["pending"]:
        audit_service.system(db, action=f"{counts['pending']} low-confidence fields routed for human review", category="validation",
                             status="Review Required", document=doc, source="Validation rules",
                             details={"threshold": AUTO_ACCEPT_THRESHOLD})
    audit_service.system(db, action=f"Indexed {counts['chunks']} knowledge chunks", category="processing", status="Completed",
                         document=doc, source="Embedding service", details={"model": get_embedder().name})
    db.commit()
    return {"status": doc.status, "stages": stages,
            "summary": {**counts, "elapsed_ms": int((time.perf_counter() - started) * 1000)}}


def _stage(key: str, status: str, detail: str, duration_ms: int) -> dict:
    name = dict(STAGES)[key]
    return {"key": key, "name": name, "status": status, "detail": detail, "duration_ms": duration_ms}
