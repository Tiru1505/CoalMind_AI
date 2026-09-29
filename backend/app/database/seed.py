"""Demo database builder.

Shared reference data: users, mines, geological records, topics.
Per-user workspace (each user has their OWN dataset and history):
documents (+ pages, fields, chunks, facts), production records, reports,
AI queries and audit history — all keyed by `owner_id`.

`reset_and_seed()`      drops and rebuilds everything (4 demo users).
`provision_workspace()` builds a fresh workspace for one user (new sign-ups).
`reset_workspace()`     "Load Demo Scenario" for the signed-in user only.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import demo_data as D
from app.database.db import Base, SessionLocal, engine
from app.models.models import (AIQuery, AISource, AuditLog, Document, DocumentPage, ExtractedField, Fact, FactResolution,
                               GeologicalRecord, KnowledgeChunk, Mine, ProductionRecord, Report, SystemMeta, Topic, User,
                               ValidationRecord)
from app.services import audit_service, report_service
from app.services import content_builder as CB
from app.services.document_processor import persist_content
from app.utils.security import hash_password, user_dict

ALL_CODES = [m[0] for m in D.MINES]
DEMO_MOBILES = {u[0]: m for u, m in zip(D.USERS, ["9876500001", "9876500002", "9876500003", "9876500004"])}

# Realistic cross-document discrepancies detected by Consistency Guard
PROVISIONAL_MIS_OVERRIDES = {"GEV|2024-25|coal_production": 52.1}   # provisional return, superseded by final figure
CIL_MIS_OVERRIDES = {"KUS|2024-25|overburden": 167.4}               # digit transposition (164.7 -> 167.4)
LAND_REPORT_OVERRIDES = {"DIP|2024-25|land_reclaimed": 86}           # differs from the mine's own report (89 ha)

# filename, title, category, mine, fy, language, kind, pages, size_kb, uploader, age_days, status, builder, args, topics
DOCUMENTS = [
    ("Gevra_OCP_Production_Report_FY2024-25.pdf", "Gevra OCP Production Report FY 2024-25", "Production Report", "GEV", "2024-25",
     "English", "Scanned", 48, 3280, None, 0.004, "Uploaded", None, None, ["production-output", "land-reclamation", "safety-compliance"]),
    ("Kusmunda_Geological_Assessment_2024.pdf", "Kusmunda Geological Assessment 2024", "Geological Report", "KUS", "2024-25",
     "English", "Digital", 64, 5120, "Dr. Anil Sharma", 21, "Approved", "geological_assessment", {"code": "KUS"}, ["geological-exploration"]),
    ("Korba_Mining_MIS_April2025.xlsx", "Korba Mining MIS — April 2025", "MIS Report", "KOR", "2025-26",
     "English", "Digital", 2, 186, "R. K. Verma", 2.2, "Approved", "monthly_mis", {"month": "April 2025", "fy": "2025-26", "factor": 0.93}, ["production-output", "manpower-productivity"]),
    ("Annual_Production_Report_FY2023-24.pdf", "Annual Production Report FY 2023-24", "Production Summary", None, "2023-24",
     "English", "Digital", 86, 7340, "Dr. Anil Sharma", 180, "Approved", "multi_year_trend",
     {"codes": CB.SECL_KORBA, "fys": ["2021-22", "2022-23", "2023-24"], "title": "Annual Production Report FY 2023-24", "page_no": 15}, ["production-output"]),
    ("Land_Reclamation_Report_2025.pdf", "Land Reclamation Report 2025", "Land Reclamation Report", None, "2024-25",
     "English", "Scanned", 38, 4410, "Dr. Anil Sharma", 3, "Validation Required", "land_reclamation_report",
     {"fy": "2024-25", "overrides": LAND_REPORT_OVERRIDES}, ["land-reclamation", "environment"]),
    ("Annual_Production_Summary_FY2024-25.pdf", "Annual Production Summary FY 2024-25", "Production Summary", None, "2024-25",
     "English", "Digital", 24, 1980, "R. K. Verma", 1.1, "Approved", "production_summary",
     {"fy": "2024-25", "codes": CB.SECL_KORBA, "doc_title": "Annual Production Summary FY 2024-25", "page_no": 8, "subsidiary_label": "SECL — Korba Group"}, ["production-output"]),
    ("CIL_Production_MIS_FY2024-25.xlsx", "CIL Production MIS FY 2024-25", "MIS Report", None, "2024-25",
     "English", "Digital", 14, 842, "Priya Menon", 9, "Approved", "production_summary",
     {"fy": "2024-25", "codes": ALL_CODES, "doc_title": "CIL Production MIS FY 2024-25", "page_no": 12, "subsidiary_label": "CIL — SECL, MCL, NCL (selected mines)",
      "topic_page": 4, "overrides": CIL_MIS_OVERRIDES}, ["production-output"]),
    ("Dipka_OCP_Production_Report_FY2024-25.pdf", "Dipka OCP Production Report FY 2024-25", "Production Report", "DIP", "2024-25",
     "English", "Digital", 44, 2890, "Dr. Anil Sharma", 12, "Approved", "production_report", {"code": "DIP", "fy": "2024-25"}, ["production-output", "land-reclamation"]),
    ("Kusmunda_OCP_Production_Report_FY2024-25.pdf", "Kusmunda OCP Production Report FY 2024-25", "Production Report", "KUS", "2024-25",
     "English", "Digital", 46, 3010, "Dr. Anil Sharma", 14, "Approved", "production_report", {"code": "KUS", "fy": "2024-25"}, ["production-output", "land-reclamation"]),
    ("Gevra_OCP_Production_Report_FY2023-24.pdf", "Gevra OCP Production Report FY 2023-24", "Production Report", "GEV", "2023-24",
     "English", "Digital", 47, 3150, "Dr. Anil Sharma", 190, "Approved", "production_report", {"code": "GEV", "fy": "2023-24"}, ["production-output", "land-reclamation"]),
    ("Manikpur_Mine_Plan_Review_2023.docx", "Manikpur Mine Plan Review 2023", "Mine Plan", "MNK", "2023-24",
     "English", "Digital", 22, 640, "Priya Menon", 240, "Processed", "mine_plan_review", {}, ["production-output"]),
    ("SECL_Safety_Audit_Q3_2024.pdf", "SECL Safety Audit Q3 2024", "Safety Audit", None, "2024-25",
     "English", "Digital", 31, 2230, "R. K. Verma", 60, "Approved", "safety_audit", {}, ["safety-compliance"]),
    ("Gevra_Geological_Report_Bilingual_2022.pdf", "Gevra Geological Report (Hindi–English) 2022", "Geological Report", "GEV", "2023-24",
     "Hindi / English", "Scanned", 72, 9120, "Dr. Anil Sharma", 400, "Approved", "geological_assessment", {"code": "GEV", "bilingual": True}, ["geological-exploration"]),
    ("Environmental_Clearance_Compliance_Gevra_2024.pdf", "Environmental Clearance Compliance — Gevra 2024", "Environmental Compliance", "GEV", "2024-25",
     "English", "Digital", 28, 1760, "Priya Menon", 35, "Processed", "environment_compliance", {}, ["environment"]),
    ("Korba_Kshetra_Masik_Pratibedan_Mar2025.pdf", "Korba Area Monthly Progress Report (Hindi) — March 2025", "MIS Report", "KOR", "2024-25",
     "Hindi / English", "Scanned", 2, 412, "Neha Kulkarni", 170, "Approved", "monthly_mis", {"month": "March 2025", "fy": "2024-25", "factor": 1.46, "hindi": True}, ["production-output"]),
    ("SECL_Production_MIS_FY2025-26_Provisional.xlsx", "SECL Production MIS FY 2025-26 (Provisional)", "MIS Report", None, "2025-26",
     "English", "Digital", 9, 520, "R. K. Verma", 6, "Processed", "multi_year_trend",
     {"codes": CB.SECL_KORBA, "fys": D.FINANCIAL_YEARS, "title": "SECL Production MIS FY 2025-26 (Provisional)", "page_no": 4,
      "provisional": True, "overrides": PROVISIONAL_MIS_OVERRIDES}, ["production-output"]),
    ("Old_Survey_Map_Korba_1987.jpg", "Old Survey Map — Korba (1987)", "Survey Map", "KOR", "1986-87",
     "English", "Scanned", 1, 2140, "Neha Kulkarni", 4, "Failed", None, None, []),
]
FAILED_ERROR = "Image resolution below OCR threshold (96 DPI); mean text confidence 31%. Re-scan at ≥300 DPI."


# ------------------------------------------------------------------ reference data

def _reference_data(db: Session) -> None:
    for code, name, short, mtype, sub, area, dist, state, cf, lease, cap, aliases in D.MINES:
        db.add(Mine(code=code, name=name, short_name=short, mine_type=mtype, subsidiary=sub, area=area, district=dist, state=state,
                    coalfield=cf, lease_area_ha=lease, capacity_mty=cap, aliases=aliases))
    db.flush()
    mines = {m.code: m for m in db.query(Mine).all()}
    for code, (yr, gr, er, seams, th, grade, gcv, bh, drill, depth) in D.GEOLOGY.items():
        db.add(GeologicalRecord(mine_id=mines[code].id, assessment_year=yr, geological_reserves_mt=gr, extractable_reserves_mt=er,
                                principal_seams=seams, avg_seam_thickness_m=th, coal_grade=grade, gcv_kcal_kg=gcv, boreholes=bh,
                                drilling_m=drill, max_depth_m=depth))
    for t in D.TOPICS:
        db.add(Topic(slug=t["slug"], name=t["name"], description=t["description"], document_count=t["document_count"],
                     trend_pct=t["trend_pct"], keywords=[list(k) for k in t["keywords"]], yearly=t["yearly"],
                     related_mines=t["related_mines"], color=t["color"]))


# ------------------------------------------------------------------ per-user workspace

def provision_workspace(db: Session, user: User, with_history: bool = False) -> dict:
    """Give `user` their own copy of the demo dataset (documents, records, facts…)."""
    now = datetime.utcnow()
    uid = user.id
    ud = user_dict(user)
    mines = {m.code: m for m in db.query(Mine).all()}
    roles = {u[2]: u[3] for u in D.USERS}

    for code, years in D.PRODUCTION.items():
        for fy, (p, t, ob, land, mp, safety) in years.items():
            db.add(ProductionRecord(
                owner_id=uid, mine_id=mines[code].id, financial_year=fy, coal_production_mt=p, target_mt=t, overburden_mm3=ob,
                stripping_ratio=round(ob / p, 2), dispatch_mt=round(p * 0.99, 2), land_reclaimed_ha=land, manpower=mp,
                productivity_oms=round(p * 1e6 / (mp * 300), 2), drilling_m=round(ob * 2150), safety_incidents=safety,
                status="Provisional" if fy in D.PROVISIONAL_FYS else "Verified"))

    for (fn, title, cat, code, fy, lang, kind, pages, size, uploader, age, status, builder, args, topics) in DOCUMENTS:
        uploaded = now - timedelta(days=age)
        uploader = uploader or user.name
        mine = mines.get(code) if code else None
        doc = Document(owner_id=uid, filename=fn, title=title, file_type=fn.rsplit(".", 1)[1], doc_category=cat,
                       mine_id=mine.id if mine else None,
                       mine_label=mine.short_name if mine else ("CIL — Multiple" if "CIL" in fn else "SECL — Korba Group"),
                       financial_year=fy, language=lang, source_kind=kind, pages=pages, size_kb=size, uploaded_by=uploader,
                       uploaded_at=uploaded, status=status, topics=topics, is_demo_target=builder is None and status == "Uploaded")
        db.add(doc)
        db.flush()
        role = roles.get(uploader, user.role)
        if builder:
            content = CB.build(builder, args)
            persist_content(db, doc, content, auto_status=False, all_approved=status == "Approved",
                            validator=uploader if status == "Approved" else None)
            doc.processing_log = _historic_log(content, status)
            if with_history:
                audit_service.log(db, owner_id=uid, user=uploader, role=role, action="Uploaded document", category="upload",
                                  status="Uploaded", document=doc, source=f"{doc.file_type.upper()} · {size / 1024:.1f} MB", timestamp=uploaded)
                audit_service.system(db, owner_id=uid, action=f"Extracted {content['fields_total']} fields", category="processing",
                                     status="Completed", document=doc, source="OCR + NLP", timestamp=uploaded + timedelta(minutes=3),
                                     details={"model": "PaddleOCR PP-OCRv4 (simulated); LayoutLMv3 + NER (simulated)", "tables": content["tables"]})
                if status == "Approved":
                    audit_service.log(db, owner_id=uid, user=uploader, role=role, action="Approved extracted data", category="validation",
                                      status="Approved", document=doc, source="All key fields", timestamp=uploaded + timedelta(hours=2),
                                      details={"model": "Human review", "fields": len(content["fields"])})
                elif status == "Validation Required":
                    pending = sum(1 for f in content["fields"] if f["confidence"] < 80)
                    audit_service.system(db, owner_id=uid, action=f"{pending} low-confidence fields detected", category="validation",
                                         status="Review Required", document=doc, source="Validation rules",
                                         timestamp=uploaded + timedelta(minutes=4), details={"threshold": 80})
        elif status == "Failed":
            doc.error = FAILED_ERROR
            doc.processing_log = [
                {"key": "upload", "name": "Document Uploaded", "status": "complete", "detail": "Checksum verified", "duration_ms": 170},
                {"key": "preprocess", "name": "Image Pre-processing", "status": "complete", "detail": "Deskew 2.4°, denoise", "duration_ms": 640},
                {"key": "ocr", "name": "OCR Extraction", "status": "failed", "detail": FAILED_ERROR, "duration_ms": 1150},
            ]
            if with_history:
                audit_service.system(db, owner_id=uid, action="OCR extraction failed", category="processing", status="Failed",
                                     document=doc, source="OCR engine", timestamp=uploaded + timedelta(minutes=2), details={"error": FAILED_ERROR})
        else:  # the personal demo target, awaiting processing
            audit_service.log(db, owner_id=uid, user=user.name, role=user.role, action="Uploaded document", category="upload",
                              status="Uploaded", document=doc, source="PDF · 3.2 MB · scanned", timestamp=uploaded,
                              details={"checksum": "sha256:7f3c…a91e", "pages": pages})
    db.flush()

    for doc in db.query(Document).filter_by(owner_id=uid, doc_category="Production Report", status="Approved").all():
        rec = db.query(ProductionRecord).filter_by(owner_id=uid, mine_id=doc.mine_id, financial_year=doc.financial_year).first()
        if rec:
            rec.source_document_id = doc.id

    if with_history and user.role != "viewer":
        history = [
            ({"report_type": "Parliamentary Query Response", "scope": "SECL-KORBA", "financial_year": "2024-25",
              "sections": ["executive_summary", "production", "land_reclamation", "key_observations"],
              "query_text": "coal production and land reclamation in Korba district"}, 1.2, "Approved"),
            ({"report_type": "Monthly Production Report", "scope": "SECL-KORBA", "financial_year": "2025-26", "month": "April",
              "sections": ["executive_summary", "production", "mining_performance"]}, 2.1, "Approved"),
            ({"report_type": "Geological Summary", "scope": "KUS", "financial_year": "2024-25",
              "sections": ["executive_summary", "geological", "key_observations"]}, 6, "Draft"),
        ]
        for payload, age, status in history:
            rep = report_service.generate(db, payload, ud)
            rep.created_at = now - timedelta(days=age)
            rep.status = status
            rep.approved_by = user.name if status == "Approved" else None
            for log in db.query(AuditLog).filter_by(owner_id=uid, category="report", document_label=rep.title).all():
                log.timestamp = rep.created_at
        audit_service.log(db, owner_id=uid, user=user.name, role=user.role, action="Parliamentary query answered", category="report",
                          status="Approved", document_label="Draft Reply — Parliament Question: SECL — Korba Group of Mines",
                          source="Lok Sabha unstarred question (demo)", timestamp=now - timedelta(days=1.15))
    if with_history:
        audit_service.log(db, owner_id=uid, user="Priya Menon", role="admin", action="Nightly knowledge index refresh", category="system",
                          status="Completed", source="Vector index", timestamp=now - timedelta(hours=9),
                          details={"model": "hashing-bow-384 (Sentence-BERT stand-in)"})
    else:
        audit_service.log(db, owner_id=uid, user=user.name, role=user.role, action="Workspace provisioned with sample dataset",
                          category="system", status="Completed", source=f"{len(DOCUMENTS)} documents · Demo Mode", timestamp=now)
    db.flush()

    def owned_fields():
        return db.query(ExtractedField).join(Document, Document.id == ExtractedField.document_id).filter(Document.owner_id == uid)

    docs = db.query(Document).filter_by(owner_id=uid).all()
    baseline = {
        "processed_docs": sum(1 for d in docs if d.status in ("Processed", "Approved", "Validation Required")),
        "fields": sum(d.fields_extracted for d in docs),
        "pending_fields": owned_fields().filter(ExtractedField.status == "pending").count(),
        "field_rows": owned_fields().count(),
        "reports": db.query(Report).filter_by(owner_id=uid).count(),
        "ai_queries": db.query(AIQuery).filter_by(owner_id=uid).count(),
        "chunks": db.query(KnowledgeChunk).filter_by(owner_id=uid).count(),
        "verified_fields": owned_fields().filter(ExtractedField.status.in_(["approved", "auto_accepted"])).count(),
        "tables": sum(d.tables_detected for d in docs),
        "max_doc_id": max(d.id for d in docs),
        "seeded_at": now.isoformat() + "Z",
    }
    meta = db.get(SystemMeta, f"baseline:{uid}")
    if meta:
        meta.value = baseline
    else:
        db.add(SystemMeta(key=f"baseline:{uid}", value=baseline))
    db.commit()
    return {"documents": len(DOCUMENTS), "chunks": baseline["chunks"]}


def clear_workspace(db: Session, uid: int) -> None:
    doc_ids = [d.id for d in db.query(Document.id).filter_by(owner_id=uid).all()]
    field_ids = [f.id for f in db.query(ExtractedField.id).filter(ExtractedField.document_id.in_(doc_ids)).all()] if doc_ids else []
    query_ids = [q.id for q in db.query(AIQuery.id).filter_by(owner_id=uid).all()]
    if query_ids:
        db.query(AISource).filter(AISource.query_id.in_(query_ids)).delete(synchronize_session=False)
    db.query(AIQuery).filter_by(owner_id=uid).delete(synchronize_session=False)
    if field_ids:
        db.query(ValidationRecord).filter(ValidationRecord.field_id.in_(field_ids)).delete(synchronize_session=False)
    if doc_ids:
        for model in (ExtractedField, DocumentPage):
            db.query(model).filter(model.document_id.in_(doc_ids)).delete(synchronize_session=False)
    for model in (FactResolution, Fact, KnowledgeChunk, Report, AuditLog, ProductionRecord, Document):
        db.query(model).filter(model.owner_id == uid).delete(synchronize_session=False)
    db.flush()


def reset_workspace(db: Session, user: User) -> dict:
    clear_workspace(db, user.id)
    return provision_workspace(db, user, with_history=user.mobile in DEMO_MOBILES.values())


def reset_and_seed() -> dict:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _reference_data(db)
        users = []
        for emp, pw, name, role, desig, dept, email in D.USERS:
            u = User(employee_id=emp, mobile=DEMO_MOBILES[emp], password=hash_password(pw), name=name, role=role,
                     designation=desig, department=dept, email=email)
            db.add(u)
            users.append(u)
        db.flush()
        for u in users:
            provision_workspace(db, u, with_history=True)
        db.add(SystemMeta(key="schema", value={"version": SCHEMA_VERSION}))
        db.commit()
        return {"users": len(users), "documents_per_user": len(DOCUMENTS), "audit_logs": db.query(AuditLog).count()}
    finally:
        db.close()


def _historic_log(content: dict, status: str) -> list[dict]:
    pending = sum(1 for f in content["fields"] if f["confidence"] < 80)
    return [
        {"key": "upload", "name": "Document Uploaded", "status": "complete", "detail": "Checksum verified", "duration_ms": 160},
        {"key": "preprocess", "name": "Image Pre-processing", "status": "complete", "detail": "Deskew, denoise, binarisation", "duration_ms": 610},
        {"key": "ocr", "name": "OCR Extraction", "status": "complete", "detail": f"{len(content['pages'])} key pages read", "duration_ms": 1480},
        {"key": "tables", "name": "Table Detection", "status": "complete", "detail": f"{content['tables']} tables detected", "duration_ms": 880},
        {"key": "entities", "name": "Entity Extraction", "status": "complete", "detail": f"{content['fields_total']} fields extracted", "duration_ms": 1020},
        {"key": "validation", "name": "Data Validation", "status": "warning" if status == "Validation Required" else "complete",
         "detail": f"{pending} fields require review" if status == "Validation Required" else "All key fields validated", "duration_ms": 500},
        {"key": "indexing", "name": "Knowledge Indexing", "status": "complete", "detail": f"{len(content['chunks'])} chunks indexed", "duration_ms": 760},
    ]


SCHEMA_VERSION = 2  # bump when models change; older demo databases are rebuilt automatically


def ensure_seeded() -> None:
    db = SessionLocal()
    try:
        meta = db.get(SystemMeta, "schema")
        current = bool(meta and meta.value.get("version") == SCHEMA_VERSION and db.query(User).count())
    except Exception:  # missing tables / columns from an older prototype version
        current = False
    finally:
        db.close()
    if not current:
        reset_and_seed()
