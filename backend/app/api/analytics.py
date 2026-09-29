from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.demo_data import FINANCIAL_YEARS, PROVISIONAL_FYS
from app.models.models import Mine, ProductionRecord
from app.services import audit_service
from app.utils.exporters import to_csv, to_xlsx
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _filter(db: Session, subsidiary: str, mine: str):
    q = db.query(Mine)
    if subsidiary:
        q = q.filter(Mine.subsidiary == subsidiary)
    if mine:
        q = q.filter(Mine.code == mine)
    return q.order_by(Mine.id).all()


@router.get("")
def analytics(subsidiary: str = "", mine: str = "", fy: str = "2024-25", db: Session = Depends(get_db), user: dict = Depends(current_user)):
    mines = _filter(db, subsidiary, mine)
    ids = [m.id for m in mines]
    fy = fy if fy in FINANCIAL_YEARS else "2024-25"
    yearly = []
    for f in FINANCIAL_YEARS:
        recs = db.query(ProductionRecord).filter(ProductionRecord.mine_id.in_(ids), ProductionRecord.financial_year == f).all()
        if not recs:
            continue
        p = sum(r.coal_production_mt for r in recs); t = sum(r.target_mt for r in recs); ob = sum(r.overburden_mm3 for r in recs)
        mp = sum(r.manpower for r in recs)
        yearly.append({"fy": f"FY {f}", "production": round(p, 1), "target": round(t, 1), "achievement": round(p / t * 100, 1),
                       "overburden": round(ob, 1), "stripping_ratio": round(ob / p, 2), "land": round(sum(r.land_reclaimed_ha for r in recs), 1),
                       "manpower": mp, "oms": round(p * 1e6 / (mp * 300), 1), "safety": sum(r.safety_incidents for r in recs),
                       "dispatch": round(sum(r.dispatch_mt for r in recs), 1), "provisional": f in PROVISIONAL_FYS})
    by_mine = []
    for m in mines:
        r = db.query(ProductionRecord).filter_by(mine_id=m.id, financial_year=fy).first()
        if r:
            by_mine.append({"mine": m.short_name, "code": m.code, "subsidiary": m.subsidiary, "production": r.coal_production_mt,
                            "target": r.target_mt, "achievement": round(r.coal_production_mt / r.target_mt * 100, 1),
                            "overburden": r.overburden_mm3, "stripping_ratio": r.stripping_ratio, "land": r.land_reclaimed_ha,
                            "manpower": r.manpower, "oms": r.productivity_oms, "safety": r.safety_incidents, "dispatch": r.dispatch_mt,
                            "status": r.status})
    cur = next((y for y in yearly if y["fy"] == f"FY {fy}"), None)
    prev = next((y for y in yearly if FINANCIAL_YEARS.index(fy) > 0 and y["fy"] == f"FY {FINANCIAL_YEARS[FINANCIAL_YEARS.index(fy) - 1]}"), None)

    def delta(k):
        return round((cur[k] - prev[k]) / prev[k] * 100, 1) if cur and prev and prev[k] else None

    # simple least-squares linear forecast (illustrative only)
    forecast = [{"fy": y["fy"], "actual": y["production"], "forecast": None} for y in yearly]
    if len(yearly) >= 3:
        n = len(yearly); xs = list(range(n)); ys = [y["production"] for y in yearly]
        mx, my = sum(xs) / n, sum(ys) / n
        slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
        intercept = my - slope * mx
        forecast[-1]["forecast"] = forecast[-1]["actual"]
        last = int(FINANCIAL_YEARS[-1][:4])
        for i in (1, 2):
            forecast.append({"fy": f"FY {last + i}-{str(last + i + 1)[2:]}", "actual": None, "forecast": round(intercept + slope * (n - 1 + i), 1)})
    summary = None
    if cur:
        summary = {"production": cur["production"], "target": cur["target"], "achievement": cur["achievement"], "overburden": cur["overburden"],
                   "land": cur["land"], "manpower": cur["manpower"], "safety": cur["safety"], "oms": cur["oms"],
                   "deltas": {k: delta(k) for k in ["production", "overburden", "land", "manpower", "safety", "oms"]}}
    return {"filters": {"subsidiary": subsidiary, "mine": mine, "fy": fy},
            "options": {"subsidiaries": sorted({m.subsidiary for m in db.query(Mine).all()}),
                        "mines": [{"code": m.code, "name": m.short_name, "subsidiary": m.subsidiary} for m in db.query(Mine).order_by(Mine.id).all()],
                        "financial_years": FINANCIAL_YEARS},
            "summary": summary, "yearly": yearly, "by_mine": by_mine, "forecast": forecast,
            "note": "Sample demonstration data — not official CIL statistics. FY 2025-26 figures are provisional."}


@router.get("/export")
def export(format: str = Query("csv", pattern="^(csv|xlsx)$"), subsidiary: str = "", mine: str = "", fy: str = "2024-25",
           db: Session = Depends(get_db), user: dict = Depends(require("export"))):
    mines = _filter(db, subsidiary, mine)
    headers = ["Mine", "Subsidiary", "Financial Year", "Coal Production (MT)", "Target (MT)", "Achievement (%)", "Overburden (Mm3)",
               "Stripping Ratio (m3/t)", "Dispatch (MT)", "Land Reclaimed (ha)", "Manpower", "OMS (t)", "Safety Incidents", "Record Status"]
    rows = []
    for m in mines:
        for r in db.query(ProductionRecord).filter_by(mine_id=m.id).order_by(ProductionRecord.financial_year).all():
            if fy and fy != "all" and r.financial_year != fy:
                continue
            rows.append([m.short_name, m.subsidiary, f"FY {r.financial_year}", r.coal_production_mt, r.target_mt,
                         round(r.coal_production_mt / r.target_mt * 100, 2), r.overburden_mm3, r.stripping_ratio, r.dispatch_mt,
                         r.land_reclaimed_ha, r.manpower, r.productivity_oms, r.safety_incidents, r.status])
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    audit_service.log(db, user=user["name"], role=user["role"], action=f"Exported analytics ({format.upper()})", category="report",
                      status="Exported", document_label=f"{len(rows)} records", source="Analytics", commit=True,
                      details={"filters": {"subsidiary": subsidiary, "mine": mine, "fy": fy}})
    if format == "csv":
        return Response(to_csv(headers, rows), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="coalmind_analytics_{stamp}.csv"'})
    data = to_xlsx("Production", headers, rows, title="CoalMind AI — Production analytics (SAMPLE DEMO DATA)")
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="coalmind_analytics_{stamp}.xlsx"'})
