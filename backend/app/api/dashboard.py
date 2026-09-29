from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.serializers import audit, report
from app.database.db import get_db
from app.database.demo_data import DISPLAY_TOTALS, FINANCIAL_YEARS, LATEST_VERIFIED_FY, PROVISIONAL_FYS
from app.models.models import AIQuery, AuditLog, Document, ExtractedField, Mine, ProductionRecord, Report, SystemMeta
from app.services import consistency_service
from app.utils.security import current_user

router = APIRouter(prefix="/api", tags=["dashboard"])

PROCESSED = ["Processed", "Approved", "Validation Required"]


def baseline(db: Session, uid: int) -> dict:
    return (db.get(SystemMeta, f"baseline:{uid}") or SystemMeta(value={})).value


def pending_fields(db: Session, uid: int) -> int:
    return (db.query(ExtractedField).join(Document, Document.id == ExtractedField.document_id)
            .filter(Document.owner_id == uid, ExtractedField.status == "pending").count())


def live_totals(db: Session, uid: int) -> dict:
    """Organisation-archive headline totals plus this user's live activity since their workspace was provisioned."""
    base = baseline(db, uid)
    docs = db.query(Document).filter_by(owner_id=uid).all()
    processed = sum(1 for d in docs if d.status in PROCESSED)
    fields = sum(d.fields_extracted for d in docs)
    pending = pending_fields(db, uid)
    reports = db.query(Report).filter_by(owner_id=uid).count()
    queries = db.query(AIQuery).filter_by(owner_id=uid).count()
    return {
        "documents_processed": DISPLAY_TOTALS["documents_processed"] + processed - base.get("processed_docs", 0),
        "fields_extracted": DISPLAY_TOTALS["fields_extracted"] + fields - base.get("fields", 0),
        "pending_validation": DISPLAY_TOTALS["pending_validation"] + pending - base.get("pending_fields", 0),
        "reports_generated": DISPLAY_TOTALS["reports_generated"] + reports - base.get("reports", 0),
        "ai_queries": DISPLAY_TOTALS["ai_queries"] + queries - base.get("ai_queries", 0),
        "extraction_accuracy": DISPLAY_TOTALS["extraction_accuracy"],
        "live_pending_fields": pending,
        "my": {"documents": len(docs), "processed": processed, "pending_fields": pending, "reports": reports, "queries": queries,
               "uploaded": sum(1 for d in docs if d.status == "Uploaded"), "failed": sum(1 for d in docs if d.status == "Failed")},
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    uid = user["id"]
    t = live_totals(db, uid)
    kpis = [
        {"key": "documents", "label": "Documents Processed", "value": t["documents_processed"], "delta": "+18.4%", "note": "vs last qtr", "tone": "up"},
        {"key": "fields", "label": "Data Fields Extracted", "value": t["fields_extracted"], "delta": "+12.1%", "note": "structured", "tone": "up"},
        {"key": "pending", "label": "Pending Validation", "value": t["pending_validation"], "delta": None, "note": "Needs attention", "tone": "warn"},
        {"key": "reports", "label": "Reports Generated", "value": t["reports_generated"], "delta": None, "note": "This month", "tone": "neutral"},
        {"key": "queries", "label": "AI Queries", "value": t["ai_queries"], "delta": None, "note": "This month", "tone": "neutral"},
        {"key": "accuracy", "label": "Extraction Accuracy", "value": t["extraction_accuracy"], "suffix": "%", "delta": None, "note": "Human validated", "tone": "good"},
    ]
    korba = db.query(Mine).filter(Mine.code.in_(["GEV", "KUS", "DIP", "MNK", "KOR"])).order_by(Mine.id).all()
    ids = [m.id for m in korba]
    trend = []
    for fy in FINANCIAL_YEARS:
        recs = db.query(ProductionRecord).filter(ProductionRecord.owner_id == uid, ProductionRecord.mine_id.in_(ids),
                                                 ProductionRecord.financial_year == fy).all()
        p = sum(r.coal_production_mt for r in recs); tg = sum(r.target_mt for r in recs)
        if tg:
            trend.append({"fy": f"FY {fy}", "production": round(p, 1), "target": round(tg, 1), "achievement": round(p / tg * 100, 1),
                          "provisional": fy in PROVISIONAL_FYS})
    mine_wise = []
    for m in korba:
        r = db.query(ProductionRecord).filter_by(owner_id=uid, mine_id=m.id, financial_year=LATEST_VERIFIED_FY).first()
        if r:
            mine_wise.append({"mine": m.short_name, "code": m.code, "production": r.coal_production_mt, "target": r.target_mt,
                              "achievement": round(r.coal_production_mt / r.target_mt * 100, 1), "land": r.land_reclaimed_ha,
                              "overburden": r.overburden_mm3, "safety": r.safety_incidents})
    counts = {s: db.query(Document).filter_by(owner_id=uid, status=s).count() for s in ["Uploaded", "Processing", "Validation Required", "Failed"]}
    vr = 18 + counts["Validation Required"]
    failed = 11 + counts["Failed"]
    pending = 42 + counts["Uploaded"] + counts["Processing"]
    doc_status = [
        {"name": "Processed", "value": t["documents_processed"] - vr}, {"name": "Pending", "value": pending},
        {"name": "Validation Required", "value": vr}, {"name": "Failed", "value": failed},
    ]
    recent = (db.query(AuditLog).filter(AuditLog.owner_id == uid, AuditLog.category != "auth")
              .order_by(AuditLog.timestamp.desc()).limit(8).all())
    demo_doc = db.query(Document).filter_by(owner_id=uid, is_demo_target=True).first()
    scan = consistency_service.scan(db, uid)
    reports = db.query(Report).filter_by(owner_id=uid).order_by(Report.created_at.desc()).limit(6).all()
    latest = next((x for x in reversed(trend) if not x["provisional"]), None)
    return {
        "user": user, "kpis": kpis, "production_trend": trend, "mine_wise": mine_wise, "mine_wise_fy": f"FY {LATEST_VERIFIED_FY}",
        "document_status": doc_status, "recent_activity": [audit(a) for a in recent],
        "demo_document": {"id": demo_doc.id, "title": demo_doc.title, "status": demo_doc.status} if demo_doc else None,
        "workspace": t["my"],
        "consistency": {k: scan[k] for k in ("score", "open_conflicts", "high_severity", "resolved_count", "cross_checked", "agree_count")}
                       | {"top": [{"key": c["key"], "label": c["label"], "mine": c["mine"], "fy": c["financial_year"], "severity": c["severity"],
                                   "values": [cl["display"] for cl in c["clusters"]]} for c in scan["conflicts"][:3]]},
        "reports": [report(r) for r in reports],
        "headline": latest,
        "seeded_at": baseline(db, uid).get("seeded_at"),
    }
