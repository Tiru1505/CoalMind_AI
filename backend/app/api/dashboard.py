from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.serializers import audit
from app.database.db import get_db
from app.database.demo_data import DISPLAY_TOTALS, FINANCIAL_YEARS, LATEST_VERIFIED_FY, PROVISIONAL_FYS
from app.models.models import AIQuery, AuditLog, Document, ExtractedField, Mine, ProductionRecord, Report, SystemMeta
from app.utils.security import current_user

router = APIRouter(prefix="/api", tags=["dashboard"])

PROCESSED = ["Processed", "Approved", "Validation Required"]


def live_totals(db: Session) -> dict:
    base = (db.get(SystemMeta, "baseline") or SystemMeta(value={})).value
    processed = db.query(Document).filter(Document.status.in_(PROCESSED)).count()
    fields = sum(d.fields_extracted for d in db.query(Document).all())
    pending = db.query(ExtractedField).filter_by(status="pending").count()
    reports = db.query(Report).count()
    queries = db.query(AIQuery).count()
    return {
        "documents_processed": DISPLAY_TOTALS["documents_processed"] + processed - base.get("processed_docs", 0),
        "fields_extracted": DISPLAY_TOTALS["fields_extracted"] + fields - base.get("fields", 0),
        "pending_validation": DISPLAY_TOTALS["pending_validation"] + pending - base.get("pending_fields", 0),
        "reports_generated": DISPLAY_TOTALS["reports_generated"] + reports - base.get("reports", 0),
        "ai_queries": DISPLAY_TOTALS["ai_queries"] + queries - base.get("ai_queries", 0),
        "extraction_accuracy": DISPLAY_TOTALS["extraction_accuracy"],
        "live_pending_fields": pending,
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    t = live_totals(db)
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
        recs = db.query(ProductionRecord).filter(ProductionRecord.mine_id.in_(ids), ProductionRecord.financial_year == fy).all()
        p = sum(r.coal_production_mt for r in recs); tg = sum(r.target_mt for r in recs)
        trend.append({"fy": f"FY {fy}", "production": round(p, 1), "target": round(tg, 1), "achievement": round(p / tg * 100, 1),
                      "provisional": fy in PROVISIONAL_FYS})
    mine_wise = []
    for m in korba:
        r = db.query(ProductionRecord).filter_by(mine_id=m.id, financial_year=LATEST_VERIFIED_FY).first()
        mine_wise.append({"mine": m.short_name, "code": m.code, "production": r.coal_production_mt, "target": r.target_mt,
                          "achievement": round(r.coal_production_mt / r.target_mt * 100, 1)})
    base = (db.get(SystemMeta, "baseline") or SystemMeta(value={})).value
    counts = {s: db.query(Document).filter(Document.status == s).count() for s in ["Processed", "Approved", "Uploaded", "Processing", "Validation Required", "Failed"]}
    vr = 18 + counts["Validation Required"]
    failed = 11 + counts["Failed"]
    pending = 42 + counts["Uploaded"] + counts["Processing"]
    processed = t["documents_processed"] - vr
    doc_status = [
        {"name": "Processed", "value": processed}, {"name": "Pending", "value": pending},
        {"name": "Validation Required", "value": vr}, {"name": "Failed", "value": failed},
    ]
    recent = db.query(AuditLog).filter(AuditLog.category != "auth").order_by(AuditLog.timestamp.desc()).limit(8).all()
    demo_doc = db.query(Document).filter_by(is_demo_target=True).first()
    return {
        "user": user, "kpis": kpis, "production_trend": trend, "mine_wise": mine_wise, "mine_wise_fy": f"FY {LATEST_VERIFIED_FY}",
        "document_status": doc_status, "recent_activity": [audit(a) for a in recent],
        "demo_document": {"id": demo_doc.id, "title": demo_doc.title, "status": demo_doc.status} if demo_doc else None,
        "seeded_at": base.get("seeded_at"),
    }
