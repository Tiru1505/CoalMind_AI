import html

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.database.db import get_db
from app.database.demo_data import FINANCIAL_YEARS
from app.models.models import Mine, Report
from app.schemas.schemas import ReportRequest
from app.services import audit_service, report_service
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/options")
def options(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    return {"report_types": report_service.REPORT_TYPES,
            "scopes": [{"code": "SECL-KORBA", "name": "SECL — Korba Group (all mines)"}] +
                      [{"code": m.code, "name": f"{m.short_name} ({m.subsidiary})"} for m in db.query(Mine).order_by(Mine.id).all()],
            "financial_years": FINANCIAL_YEARS, "months": report_service.MONTHS,
            "sections": [{"id": k, "name": v} for k, v in report_service.SECTIONS.items()]}


@router.post("/generate")
def generate(body: ReportRequest, db: Session = Depends(get_db), user: dict = Depends(require("generate_reports"))):
    try:
        rep = report_service.generate(db, body.model_dump(), user)
    except report_service.ReportError as e:
        raise HTTPException(422, str(e))
    return S.report(rep, full=True)


@router.get("")
def list_reports(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    return [S.report(r) for r in db.query(Report).order_by(Report.created_at.desc()).all()]


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    r = db.get(Report, report_id)
    if r is None:
        raise HTTPException(404, "Report not found")
    return S.report(r, full=True)


@router.post("/{report_id}/approve")
def approve(report_id: int, db: Session = Depends(get_db), user: dict = Depends(require("approve_reports"))):
    r = db.get(Report, report_id)
    if r is None:
        raise HTTPException(404, "Report not found")
    return S.report(report_service.approve(db, r, user), full=True)


@router.get("/{report_id}/download")
def download(report_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    r = db.get(Report, report_id)
    if r is None:
        raise HTTPException(404, "Report not found")
    audit_service.log(db, user=user["name"], role=user["role"], action="Downloaded report", category="report", status="Downloaded",
                      document_label=r.title, source=r.report_no, commit=True)
    return Response(render_html(r), media_type="text/html",
                    headers={"Content-Disposition": f'attachment; filename="{r.report_no.replace("/", "_")}.html"'})


def render_html(r: Report) -> str:
    c = r.content
    h = c["header"]
    e = html.escape
    parts = [f"""<!doctype html><html><head><meta charset="utf-8"><title>{e(r.title)}</title>
<style>body{{font-family:Georgia,serif;max-width:820px;margin:40px auto;color:#111;line-height:1.55}}h1{{font-size:22px;margin:0}}
h2{{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}}table{{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}}
td,th{{border:1px solid #bbb;padding:5px 8px;text-align:left}}th{{background:#f1f1f1}}.draft{{border:2px solid #b45309;color:#92400e;padding:8px 12px;font-family:Arial;font-size:13px}}
.meta{{font-family:Arial;font-size:12px;color:#555}}sup{{color:#1d4ed8}}</style></head><body>
<div class="meta">{e(h['org'])} · {e(h['classification'])}</div><h1>{e(h['title'])}</h1>
<p><b>{e(h['subject'])}</b> — {e(h['period'])}<br><span class="meta">{e(h['report_type'])} · {e(h['report_no'])} · Prepared by {e(h['prepared_by'])} · Status: {e(r.status)}</span></p>
<div class="draft">{'Approved by ' + e(r.approved_by or '') + ' for official use.' if r.status == 'Approved' else e(c['disclaimer'])}</div>
<p class="meta">{e(h['sample_data_note'])}</p>"""]
    for s in c["sections"]:
        cites = "".join(f"<sup>[{i}]</sup>" for i in s.get("cites", []))
        parts.append(f"<h2>{e(s['title'])}{cites}</h2>")
        for p in s.get("paragraphs", []):
            parts.append(f"<p>{e(p)}</p>")
        if s.get("bullets"):
            parts.append("<ul>" + "".join(f"<li>{e(b)}</li>" for b in s["bullets"]) + "</ul>")
        if s.get("facts"):
            parts.append("<table>" + "".join(f"<tr><th>{e(f['label'])}</th><td>{e(f['value'])}</td></tr>" for f in s["facts"]) + "</table>")
        if s.get("table"):
            t = s["table"]
            parts.append(f"<table><caption>{e(t.get('caption', ''))}</caption><tr>" + "".join(f"<th>{e(x)}</th>" for x in t["headers"]) + "</tr>"
                         + "".join("<tr>" + "".join(f"<td>{e(str(x))}</td>" for x in row) + "</tr>" for row in t["rows"]) + "</table>")
    parts.append("<h2>Key Statistics</h2><table>" + "".join(f"<tr><th>{e(k['label'])}</th><td>{e(k['value'])}</td></tr>" for k in c["key_statistics"]) + "</table>")
    parts.append("<h2>Source References</h2><ol>" + "".join(f"<li>{e(x['document_title'])} — page {x['page']} ({e(x['status'])})</li>" for x in c["references"]) + "</ol>")
    parts.append("</body></html>")
    return "\n".join(parts)
