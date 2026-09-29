"""Consistency Guard — cross-source figure reconciliation (CoalMind AI's star feature).

The same official figure (e.g. Gevra OC coal production, FY 2024-25) is
usually printed in several documents: the mine's annual report, the
subsidiary summary, the CIL MIS, provisional monthly returns… When those
disagree, a wrong number can reach a Parliament reply or Ministry brief.

Every processed document registers the figures it states as `facts`.
This service groups facts by (mine, financial year, metric), clusters the
values, detects conflicts, recommends the authoritative value with an
explanation, and records the officer's resolution — which is then written to
the verified structured record and exposed in AI answers and reports.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import Document, Fact, FactResolution, Mine, ProductionRecord
from app.services import audit_service

SEARCHABLE = ("Processed", "Approved", "Validation Required")
REL_TOL, ABS_TOL = 0.004, 0.05

METRICS = {
    "coal_production": ("Coal production", "coal_production_mt"),
    "target": ("Production target", "target_mt"),
    "overburden": ("Overburden removal", "overburden_mm3"),
    "land_reclaimed": ("Land reclaimed", "land_reclaimed_ha"),
    "manpower": ("Manpower", "manpower"),
    "dispatch": ("Coal dispatch", "dispatch_mt"),
}


def _same(a: float, b: float) -> bool:
    return abs(a - b) <= max(ABS_TOL, REL_TOL * max(abs(a), abs(b)))


def _facts(db: Session, owner_id: int, mine: str | None = None, fy: str | None = None, metric: str | None = None):
    q = (db.query(Fact, Document).join(Document, Document.id == Fact.document_id)
         .filter(Fact.owner_id == owner_id, Document.status.in_(SEARCHABLE)))
    if mine:
        q = q.filter(Fact.mine_code == mine)
    if fy:
        q = q.filter(Fact.financial_year == fy)
    if metric:
        q = q.filter(Fact.metric == metric)
    return q.all()


def _weight(f: Fact, d: Document) -> float:
    w = 0.4 if f.provisional else 1.0
    if d.doc_category == "Production Report":
        w += 0.5  # primary, mine-level source
    if d.status == "Approved":
        w += 0.2  # human validated
    return w


def _fmt(v: float, unit: str) -> str:
    if unit in ("persons", "hectares") and float(v).is_integer():
        s = f"{int(v):,}"
    else:
        s = f"{v:,.2f}".rstrip("0").rstrip(".")
    return f"{s} {unit}" if unit != "persons" else s


def evaluate(rows: list[tuple[Fact, Document]], resolution: FactResolution | None) -> dict:
    """Cluster the values stated by different documents for a single figure."""
    seen: set[int] = set()
    uniq = []
    for f, d in rows:
        if d.id not in seen:  # one statement per document
            seen.add(d.id)
            uniq.append((f, d))
    clusters: list[dict] = []
    for f, d in sorted(uniq, key=lambda x: -_weight(*x)):
        c = next((c for c in clusters if _same(c["value"], f.value)), None)
        src = {"fact_id": f.id, "document_id": d.id, "title": d.title, "filename": d.filename, "page": f.page_number,
               "snippet": f.snippet, "provisional": f.provisional, "doc_status": d.status, "category": d.doc_category}
        if c is None:
            clusters.append({"value": f.value, "weight": _weight(f, d), "sources": [src]})
        else:
            c["weight"] += _weight(f, d)
            c["sources"].append(src)
    clusters.sort(key=lambda c: -c["weight"])
    f0 = uniq[0][0]
    unit = f0.unit
    firm = [c for c in clusters if any(not s["provisional"] for s in c["sources"])]
    status = "single" if len(uniq) == 1 else "agree" if len(clusters) == 1 else "resolved" if resolution else "conflict"
    severity = None
    if len(clusters) > 1:
        severity = "high" if len(firm) > 1 else "low"
    rec = clusters[0]
    n_rec, n_all = len(rec["sources"]), len(uniq)
    primary = any(s["category"] == "Production Report" for s in rec["sources"])
    why = [f"{n_rec} of {n_all} sources report {_fmt(rec['value'], unit)}"]
    if primary:
        why.append("includes the mine's own annual production report (primary source)")
    if any(s["doc_status"] == "Approved" for s in rec["sources"]):
        why.append("backed by human-validated extraction")
    others = clusters[1:]
    if others and all(all(s["provisional"] for s in c["sources"]) for c in others):
        why.append("differing value comes only from provisional returns, which are superseded by final figures")
    return {
        "mine_code": f0.mine_code, "financial_year": f0.financial_year, "metric": f0.metric,
        "label": METRICS.get(f0.metric, (f0.metric.replace("_", " ").capitalize(),))[0], "unit": unit,
        "status": status, "severity": severity, "source_count": n_all,
        "agreeing": n_rec, "consensus_value": rec["value"], "consensus_display": _fmt(rec["value"], unit),
        "recommended": {"value": rec["value"], "display": _fmt(rec["value"], unit), "reason": "; ".join(why) + "."},
        "clusters": [{"value": c["value"], "display": _fmt(c["value"], unit), "sources": c["sources"]} for c in clusters],
        "resolution": None if not resolution else {
            "value": resolution.value, "display": _fmt(resolution.value, unit), "reason": resolution.reason,
            "user": resolution.user, "timestamp": resolution.timestamp.isoformat() + "Z"},
    }


def _resolutions(db: Session, owner_id: int) -> dict[tuple, FactResolution]:
    out = {}
    for r in db.query(FactResolution).filter_by(owner_id=owner_id).order_by(FactResolution.timestamp).all():
        out[(r.mine_code, r.financial_year, r.metric)] = r
    return out


def check(db: Session, owner_id: int, mine: str, fy: str, metric: str) -> dict | None:
    rows = _facts(db, owner_id, mine, fy, metric)
    if not rows:
        return None
    return evaluate(rows, _resolutions(db, owner_id).get((mine, fy, metric)))


def scan(db: Session, owner_id: int) -> dict:
    groups: dict[tuple, list] = defaultdict(list)
    for f, d in _facts(db, owner_id):
        groups[(f.mine_code, f.financial_year, f.metric)].append((f, d))
    res = _resolutions(db, owner_id)
    mines = {m.code: m.short_name for m in db.query(Mine).all()}
    items = []
    for key, rows in groups.items():
        e = evaluate(rows, res.get(key))
        e["mine"] = mines.get(key[0], key[0])
        e["key"] = "|".join(key)
        items.append(e)
    multi = [i for i in items if i["status"] != "single"]
    conflicts = sorted([i for i in multi if i["status"] == "conflict"], key=lambda i: (i["severity"] != "high", i["mine"]))
    resolved = [i for i in multi if i["status"] == "resolved"]
    agree = [i for i in multi if i["status"] == "agree"]
    score = round((len(agree) + len(resolved)) / len(multi) * 100, 1) if multi else 100.0
    return {
        "score": score, "figures_checked": len(items), "cross_checked": len(multi),
        "statements": sum(i["source_count"] for i in items),
        "documents": len({s["document_id"] for i in items for c in i["clusters"] for s in c["sources"]}),
        "open_conflicts": len(conflicts), "high_severity": sum(1 for c in conflicts if c["severity"] == "high"),
        "resolved_count": len(resolved), "agree_count": len(agree),
        "conflicts": conflicts, "resolved": resolved,
        "agreements": sorted(agree, key=lambda i: (-i["source_count"], i["mine"]))[:40],
    }


class ConsistencyError(ValueError):
    pass


def resolve(db: Session, owner_id: int, user: dict, key: str, value: float, reason: str, document_id: int | None = None) -> dict:
    try:
        mine, fy, metric = key.split("|")
    except ValueError:
        raise ConsistencyError("Invalid figure key")
    current = check(db, owner_id, mine, fy, metric)
    if current is None:
        raise ConsistencyError("Figure not found in your workspace")
    if not any(_same(c["value"], value) for c in current["clusters"]):
        raise ConsistencyError("The chosen value must be one of the values stated by the source documents")
    if len(reason.strip()) < 5:
        raise ConsistencyError("Please record a reason for the decision (min. 5 characters)")
    db.add(FactResolution(owner_id=owner_id, mine_code=mine, financial_year=fy, metric=metric, value=value,
                          chosen_document_id=document_id, reason=reason.strip()[:300], user=user["name"], timestamp=datetime.utcnow()))
    write_back = None
    col = METRICS.get(metric, (None, None))[1]
    m = db.query(Mine).filter_by(code=mine).first()
    rec = db.query(ProductionRecord).filter_by(owner_id=owner_id, mine_id=m.id, financial_year=fy).first() if m else None
    if rec is not None and col:
        before = getattr(rec, col)
        setattr(rec, col, int(value) if isinstance(before, int) else value)
        if metric in ("coal_production", "overburden") and rec.coal_production_mt:
            rec.stripping_ratio = round(rec.overburden_mm3 / rec.coal_production_mt, 2)
        write_back = {"table": "production_records", "column": col, "before": before, "after": value}
    others = [c["display"] for c in current["clusters"] if not _same(c["value"], value)]
    audit_service.log(db, owner_id=owner_id, user=user["name"], role=user["role"],
                      action=f"Resolved cross-source conflict — {current['label']}, {m.short_name if m else mine}, FY {fy}",
                      category="validation", status="Resolved", document_label=f"{current['source_count']} source documents",
                      source="Consistency Guard",
                      details={"field": current["label"], "chosen_value": _fmt(value, current["unit"]), "rejected_values": others,
                               "reason": reason.strip(), "write_back": write_back, "model": "Consistency Guard (cross-source reconciliation)"})
    db.commit()
    return check(db, owner_id, mine, fy, metric)
