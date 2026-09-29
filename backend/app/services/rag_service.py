"""Retrieval-Augmented Generation service.

    question
      -> query understanding (mine / financial year / metric / intent)
      -> structured lookup on VERIFIED records (production_records, geological_records)
      -> vector retrieval of supporting passages (verified chunks only, one per document)
      -> grounded draft composed from facts + passages
      -> LLM rewrite (optional; mock in demo mode)
      -> answer + citations + trust metadata

If no verified supporting passage is retrieved the service refuses to answer
instead of guessing.
"""
from __future__ import annotations

import re
import time
from contextvars import ContextVar
from datetime import datetime

from sqlalchemy.orm import Session

from app.database.demo_data import FINANCIAL_YEARS, LATEST_VERIFIED_FY, PROVISIONAL_FYS
from app.models.models import AIQuery, AISource, Document, GeologicalRecord, KnowledgeChunk, Mine, ProductionRecord
from app.services import audit_service, consistency_service, vector_search

# the workspace (user) the current question is answered from — every lookup is scoped to it
_OWNER: ContextVar[int] = ContextVar("rag_owner")
from app.services.embedding_service import get_embedder, tokenize
from app.services.llm_service import get_llm

NOT_FOUND = "I could not find sufficient verified information in the organizational knowledge base."

METRICS = {
    # key: (label, column, unit, chunk metric tags, keywords)
    "coal_production": ("coal production", "coal_production_mt", "MT", ["coal_production"],
                        ["production", "produce", "produced", "output", "उत्पादन"]),
    "target": ("production target", "target_mt", "MT", ["target"], ["target", "लक्ष्य"]),
    "overburden": ("overburden removal", "overburden_mm3", "Mm³", ["overburden"], ["overburden", " ob ", "ob removal"]),
    "stripping_ratio": ("stripping ratio", "stripping_ratio", "m³/t", ["stripping_ratio", "overburden"], ["stripping ratio", "stripping"]),
    "land_reclaimed": ("land reclaimed", "land_reclaimed_ha", "hectares", ["land_reclaimed"], ["reclam", "reclaim", "land reclaimed"]),
    "manpower": ("manpower", "manpower", "persons", ["manpower"], ["manpower", "workforce", "employees", "staff", "जनशक्ति"]),
    "dispatch": ("coal dispatch", "dispatch_mt", "MT", ["dispatch"], ["dispatch", "despatch", "offtake"]),
    "safety": ("reportable safety incidents", "safety_incidents", "incidents", ["safety"], ["safety", "incident", "accident"]),
    "productivity": ("output per man-shift (OMS)", "productivity_oms", "t", ["productivity", "manpower"], ["productivity", "oms", "per man"]),
}
METRIC_PRIORITY = ["stripping_ratio", "land_reclaimed", "overburden", "manpower", "dispatch", "safety", "productivity", "target", "coal_production"]


# ------------------------------------------------------------------ query understanding

def parse_fy(q: str) -> str | None:
    m = re.search(r"(20\d{2})\s*[-–/]\s*(20)?(\d{2})", q)
    if m:
        return f"{m.group(1)}-{m.group(3)}"
    m = re.search(r"fy\s*'?(\d{2})\s*[-–/]\s*(\d{2})", q, re.I)
    if m:
        return f"20{m.group(1)}-{m.group(2)}"
    m = re.search(r"\b(20\d{2})\b", q)
    if m:  # a bare calendar year refers to the FY ending in March of that year
        y = int(m.group(1))
        return f"{y - 1}-{str(y)[2:]}"
    return None


def parse_mines(db: Session, q: str) -> list[Mine]:
    ql = f" {q.lower()} "
    found = []
    for mine in db.query(Mine).all():
        if any(re.search(rf"(?<![a-z]){re.escape(a)}(?![a-z])", ql) for a in mine.aliases):
            found.append(mine)
    # "Korba" is also the district name of the other mines; drop it when a specific mine is named
    if len(found) > 1 and any(m.code == "KOR" for m in found) and "korba area" not in ql:
        found = [m for m in found if m.code != "KOR"] or found
    return found


def parse_metric(q: str) -> str | None:
    ql = f" {q.lower()} "
    for key in METRIC_PRIORITY:
        if any(k in ql for k in METRICS[key][4]):
            return key
    return None


def detect_intent(q: str, mines: list[Mine], metric: str | None) -> str:
    ql = q.lower()
    if re.search(r"exceed|surpass|above (the )?target|beat|met (their |the )?target|over-?achiev", ql):
        return "targets_exceeded"
    if re.search(r"trend|over the (last|past)|last \d+ years|past \d+ years|year[- ]on[- ]year|growth", ql):
        return "trend"
    if len(mines) >= 2 and re.search(r"compar|versus|\bvs\.?\b|difference between", ql):
        return "compare"
    if re.search(r"summar|overview|profile|brief on|about .* mine", ql) and mines:
        return "mine_summary"
    if re.search(r"highest|lowest|top|best|worst|maximum|minimum|largest|smallest|rank", ql):
        return "ranking"
    if re.search(r"reserve|geolog|seam|grade|gcv|borehole", ql):
        return "geology" if mines else "semantic"
    if metric == "land_reclaimed" and not mines:
        return "reclamation_overview"
    if metric and mines:
        return "metric_lookup"
    if metric and re.search(r"total|overall|aggregate|all mines|korba group|secl", ql):
        return "aggregate"
    return "semantic"


# ------------------------------------------------------------------ helpers

def fmt(v: float, unit: str = "") -> str:
    if isinstance(v, int) or unit in ("persons", "incidents") or (unit == "hectares" and float(v).is_integer()):
        s = f"{int(v):,}"
    else:
        s = f"{v:,.2f}" if abs(v) < 10 else f"{v:,.1f}"
    return f"{s} {unit}" if unit and unit not in ("persons", "incidents") else s


def record(db: Session, mine: Mine, fy: str) -> ProductionRecord | None:
    return db.query(ProductionRecord).filter_by(owner_id=_OWNER.get(), mine_id=mine.id, financial_year=fy).first()


def records_for_fy(db: Session, fy: str) -> list[ProductionRecord]:
    return (db.query(ProductionRecord).join(Mine)
            .filter(ProductionRecord.owner_id == _OWNER.get(), ProductionRecord.financial_year == fy).order_by(Mine.id).all())


def korba_group(db: Session) -> list[Mine]:
    return db.query(Mine).filter(Mine.code.in_(["GEV", "KUS", "DIP", "MNK", "KOR"])).order_by(Mine.id).all()


def best_line(content: str, query: str, mines: list[Mine], fy: str | None, hints: list[str] | None = None,
              multi_mine: bool = True) -> str:
    q_tokens = set(tokenize(query))
    aliases = [a for m in mines for a in m.aliases]
    best, best_score = "", -1.0
    lines = [ln for ln in content.split("\n") if ln.strip()]
    for i, ln in enumerate(lines):
        low = ln.lower()
        score = len(q_tokens & set(tokenize(ln)))
        if multi_mine and any(a in low for a in aliases):
            score += 6
        if fy and (fy in ln or fy[2:] in ln):
            score += 1
        if "|" in ln:
            score += 0.5 if any(ch.isdigit() for ch in ln) else -4  # table header rows are poor evidence
        if low.startswith("table") or i == 0:
            score -= 5
        if hints and any(h in low for h in hints):
            score += 4
        if "for reference" in low:
            score -= 3
        if score > best_score:
            best, best_score = ln, score
    return best


def build_sources(db: Session, hits: list[vector_search.Hit], query: str, mines: list[Mine], fy: str | None,
                  hints: list[str] | None = None) -> list[dict]:
    if not hits:
        return []
    top = hits[0].score
    out = []
    for h in hits:
        if out and vector_search.relevance_pct(h, top) < 75:
            continue
        ch = h.chunk
        doc = db.get(Document, ch.document_id)
        out.append({
            "chunk_id": ch.id, "document_id": doc.id, "document_title": doc.title, "filename": doc.filename,
            "page": ch.page_number, "section": ch.section, "snippet": best_line(ch.content, query, mines, fy, hints, len(ch.mine_codes or []) != 1),
            "relevance": vector_search.relevance_pct(h, top), "similarity": round(h.similarity, 3),
            "extraction_confidence": ch.extraction_confidence, "verified": ch.verified,
            "validation_status": "Human validated" if doc.status == "Approved" else "Auto-accepted (≥80% confidence)",
            "financial_year": ch.financial_year, "doc_category": doc.doc_category,
        })
    return out


def retrieve(db: Session, query: str, *, mines: list[Mine] | None = None, fy: str | None = None,
             metric_tags: list[str] | None = None, k: int = 3, strict: bool = True) -> list[vector_search.Hit]:
    codes = [m.code for m in mines] if mines else None
    monthly = re.search(r"month|april|may|june|july|august|september|october|november|december|january|february|march", query.lower())
    return vector_search.search(db, query, owner_id=_OWNER.get(), k=k, mines=codes, fy=fy, metrics=metric_tags, require_filter=strict,
                                verified_only=True, one_per_document=True, exclude_metrics=None if monthly else ["monthly"])


# ------------------------------------------------------------------ intent handlers
# each returns (draft, hits, extras) ; extras may contain facts / table / chart

def h_metric_lookup(db, q, mines, fy, metric):
    mine = mines[0]
    fy = fy or LATEST_VERIFIED_FY
    rec = record(db, mine, fy)
    label, col, unit, tags, _ = METRICS[metric]
    hits = retrieve(db, q, mines=[mine], fy=fy, metric_tags=tags)
    if rec is None or not hits:
        return None, hits, {}
    val = getattr(rec, col)
    provisional = " (provisional)" if rec.status == "Provisional" else ""
    kind = "verified production report" if any(db.get(Document, h.chunk.document_id).doc_category == "Production Report" for h in hits) else "verified organisational records"
    facts = [{"label": label.capitalize(), "value": fmt(val, unit)}]
    if metric in ("coal_production", "target"):
        ach = rec.coal_production_mt / rec.target_mt * 100
        draft = (f"According to the {kind}, {mine.short_name} Mine recorded approximately {fmt(rec.coal_production_mt, 'MT')} "
                 f"of coal production in FY {fy}{provisional} against a target of {rec.target_mt:.1f} MT, achieving approximately "
                 f"{ach:.1f}% of its target.")
        facts = [{"label": "Coal production", "value": fmt(rec.coal_production_mt, "MT")},
                 {"label": "Target", "value": f"{rec.target_mt:.1f} MT"},
                 {"label": "Achievement", "value": f"{ach:.1f}%"}]
        if re.search(r"[ऀ-ॿ]", q):
            draft += (f"\n\nहिंदी सारांश: वित्त वर्ष {fy} में {mine.short_name} खदान का कोयला उत्पादन लगभग "
                      f"{rec.coal_production_mt:.1f} मिलियन टन रहा, जो {rec.target_mt:.1f} मिलियन टन लक्ष्य का {ach:.1f}% है।")
    elif metric == "stripping_ratio":
        draft = (f"According to the {kind}, the stripping ratio at {mine.short_name} in FY {fy}{provisional} was "
                 f"{rec.stripping_ratio:.2f} m³/t, with overburden removal of {fmt(rec.overburden_mm3, 'Mm³')} against coal production of "
                 f"{fmt(rec.coal_production_mt, 'MT')}.")
    elif metric == "land_reclaimed":
        draft = (f"According to the {kind}, {mine.short_name} reclaimed {fmt(rec.land_reclaimed_ha, 'hectares')} of mined-out land "
                 f"(technical and biological reclamation) in FY {fy}{provisional}.")
    elif metric == "safety":
        draft = (f"According to the {kind}, {mine.short_name} recorded {rec.safety_incidents} reportable safety incident"
                 f"{'s' if rec.safety_incidents != 1 else ''} in FY {fy}{provisional}, with no fatal accident reported.")
    else:
        draft = f"According to the {kind}, the {label} of {mine.short_name} in FY {fy}{provisional} was {fmt(val, unit)}."
    return draft, hits, {"facts": facts}


def h_targets_exceeded(db, q, mines, fy, metric):
    fy = fy or LATEST_VERIFIED_FY
    recs = records_for_fy(db, fy)
    hits = retrieve(db, "mine-wise coal production versus target achievement " + q, fy=fy, metric_tags=["achievement", "target"])
    if not recs or not hits:
        return None, hits, {}
    rows, exceeded, met = [], [], []
    for r in sorted(recs, key=lambda r: r.coal_production_mt / r.target_mt, reverse=True):
        ach = r.coal_production_mt / r.target_mt * 100
        status = "Exceeded" if ach > 100.05 else "Met" if ach >= 99.95 else "Below target"
        rows.append([r.mine.short_name, r.mine.subsidiary, f"{r.target_mt:.1f}", f"{r.coal_production_mt:.1f}", f"{ach:.1f}%", status])
        if status == "Exceeded":
            exceeded.append(f"{r.mine.short_name} ({ach:.1f}%)")
        elif status == "Met":
            met.append(r.mine.short_name)
    below = [r[0] for r in rows if r[5] == "Below target"]
    draft = (f"In FY {fy}, {len(exceeded)} of {len(recs)} tracked mines exceeded their production targets: "
             f"{', '.join(exceeded)}.")
    if met:
        draft += f" {', '.join(met)} met its target exactly."
    if below:
        draft += f" {', '.join(below)} remained below target."
    return draft, hits, {"table": {"headers": ["Mine", "Subsidiary", "Target (MT)", "Production (MT)", "Achievement", "Status"], "rows": rows}}


def h_trend(db, q, mines, fy, metric):
    metric = metric if metric in ("coal_production", "overburden", "land_reclaimed", "manpower") else "coal_production"
    label, col, unit, tags, _ = METRICS[metric]
    group = mines or korba_group(db)
    scope = group[0].short_name if len(group) == 1 else "the Korba group (Gevra, Kusmunda, Dipka, Manikpur, Korba)"
    series = []
    for f in FINANCIAL_YEARS:
        recs = [record(db, m, f) for m in group]
        recs = [r for r in recs if r]
        if not recs:
            continue
        val = sum(getattr(r, col) for r in recs)
        tgt = sum(r.target_mt for r in recs)
        series.append({"fy": f"FY {f}", "value": round(val, 1), "target": round(tgt, 1) if metric == "coal_production" else None,
                       "provisional": f in PROVISIONAL_FYS})
    hits = retrieve(db, "multi-year production trend by financial year " + q, mines=group if len(group) == 1 else None,
                    metric_tags=["trend", "coal_production", tags[0]], strict=True)
    if not series or not hits:
        return None, hits, {}
    first, last = series[0], series[-1]
    verified = [s for s in series if not s["provisional"]]
    lv = verified[-1]
    cagr = ((lv["value"] / first["value"]) ** (1 / max(1, len(verified) - 1)) - 1) * 100
    draft = (f"{label.capitalize()} of {scope} rose from {fmt(first['value'], unit)} in {first['fy']} to {fmt(lv['value'], unit)} in "
             f"{lv['fy']}, a compound annual growth of about {cagr:.1f}%.")
    if last["provisional"]:
        draft += f" Provisional figures for {last['fy']} indicate {fmt(last['value'], unit)}."
    dips = [f"{b['fy']}" for a, b in zip(series, series[1:]) if b["value"] < a["value"]]
    if dips:
        draft += f" A year-on-year decline was recorded in {', '.join(dips)}."
    return draft, hits, {"chart": {"type": "line", "unit": unit, "label": label.capitalize(), "data": series},
                         "table": {"headers": ["Financial Year", f"{label.capitalize()} ({unit})"] + (["Target (MT)"] if metric == "coal_production" else []),
                                   "rows": [[s["fy"] + (" (P)" if s["provisional"] else ""), f"{s['value']:.1f}"] + ([f"{s['target']:.1f}"] if metric == "coal_production" else []) for s in series]}}


def h_mine_summary(db, q, mines, fy, metric):
    mine = mines[0]
    fy = fy or LATEST_VERIFIED_FY
    rec = record(db, mine, fy)
    prev = record(db, mine, FINANCIAL_YEARS[FINANCIAL_YEARS.index(fy) - 1]) if fy in FINANCIAL_YEARS[1:] else None
    geo = db.query(GeologicalRecord).filter_by(mine_id=mine.id).first()
    hits = retrieve(db, f"{mine.short_name} executive summary production reserves " + q, mines=[mine], strict=True)
    if rec is None or not hits:
        return None, hits, {}
    ach = rec.coal_production_mt / rec.target_mt * 100
    change = (rec.coal_production_mt - prev.coal_production_mt) / prev.coal_production_mt * 100 if prev else None
    parts = [f"{mine.name} ({mine.subsidiary}, {mine.area}, {mine.coalfield}) is {'an' if mine.mine_type[0] in 'AEIOU' else 'a'} {mine.mine_type.lower()} operation with a rated capacity of {mine.capacity_mty:.1f} MTY."]
    parts.append(f"In FY {fy} it produced {fmt(rec.coal_production_mt, 'MT')} against a target of {rec.target_mt:.1f} MT ({ach:.1f}% achievement)"
                 + (f", {'up' if change >= 0 else 'down'} {abs(change):.1f}% year-on-year." if change is not None else "."))
    parts.append(f"Overburden removal was {fmt(rec.overburden_mm3, 'Mm³')} (stripping ratio {rec.stripping_ratio:.2f} m³/t), "
                 f"{fmt(rec.land_reclaimed_ha, 'hectares')} of land was reclaimed and the workforce stood at {rec.manpower:,}.")
    if geo:
        parts.append(f"Geological reserves are estimated at {geo.geological_reserves_mt:,.1f} MT ({geo.extractable_reserves_mt:,.1f} MT extractable), "
                     f"principally in {geo.principal_seams}, grade {geo.coal_grade}.")
    facts = [
        {"label": "Production", "value": fmt(rec.coal_production_mt, "MT")}, {"label": "Target", "value": f"{rec.target_mt:.1f} MT"},
        {"label": "Achievement", "value": f"{ach:.1f}%"}, {"label": "Overburden", "value": fmt(rec.overburden_mm3, "Mm³")},
        {"label": "Stripping ratio", "value": f"{rec.stripping_ratio:.2f} m³/t"}, {"label": "Land reclaimed", "value": f"{rec.land_reclaimed_ha:g} ha"},
        {"label": "Manpower", "value": f"{rec.manpower:,}"}, {"label": "Safety incidents", "value": str(rec.safety_incidents)},
    ]
    return " ".join(parts), hits, {"facts": facts}


def h_compare(db, q, mines, fy, metric):
    fy = fy or LATEST_VERIFIED_FY
    recs = [(m, record(db, m, fy)) for m in mines[:3]]
    recs = [(m, r) for m, r in recs if r]
    hits = retrieve(db, q, mines=[m for m, _ in recs], fy=fy, metric_tags=["coal_production", "target", "achievement"], k=3)
    if len(recs) < 2 or not hits:
        return None, hits, {}
    headers = ["Parameter"] + [m.short_name for m, _ in recs]
    rows = [
        ["Coal production (MT)"] + [f"{r.coal_production_mt:.1f}" for _, r in recs],
        ["Target (MT)"] + [f"{r.target_mt:.1f}" for _, r in recs],
        ["Achievement (%)"] + [f"{r.coal_production_mt / r.target_mt * 100:.1f}" for _, r in recs],
        ["Overburden (Mm³)"] + [f"{r.overburden_mm3:.1f}" for _, r in recs],
        ["Stripping ratio (m³/t)"] + [f"{r.stripping_ratio:.2f}" for _, r in recs],
        ["Land reclaimed (ha)"] + [f"{r.land_reclaimed_ha:g}" for _, r in recs],
        ["Manpower"] + [f"{r.manpower:,}" for _, r in recs],
        ["OMS (t)"] + [f"{r.productivity_oms:.1f}" for _, r in recs],
    ]
    lead = max(recs, key=lambda x: x[1].coal_production_mt)
    best = max(recs, key=lambda x: x[1].coal_production_mt / x[1].target_mt)
    draft = (f"In FY {fy}, {lead[0].short_name} had the higher coal production ({fmt(lead[1].coal_production_mt, 'MT')}), while "
             f"{best[0].short_name} recorded the better target achievement ({best[1].coal_production_mt / best[1].target_mt * 100:.1f}%). "
             "A parameter-wise comparison is shown below.")
    return draft, hits, {"table": {"headers": headers, "rows": rows}}


def h_ranking(db, q, mines, fy, metric):
    fy = fy or LATEST_VERIFIED_FY
    metric = metric or "coal_production"
    label, col, unit, tags, _ = METRICS[metric]
    recs = records_for_fy(db, fy)
    hits = retrieve(db, "mine-wise " + label + " " + q, fy=fy, metric_tags=tags)
    if not recs or not hits:
        return None, hits, {}
    lowest = bool(re.search(r"lowest|worst|minimum|smallest", q.lower()))
    ranked = sorted(recs, key=lambda r: getattr(r, col), reverse=not lowest)
    top = ranked[0]
    draft = (f"In FY {fy}, {top.mine.short_name} recorded the {'lowest' if lowest else 'highest'} {label} among tracked mines at "
             f"{fmt(getattr(top, col), unit)}, followed by {ranked[1].mine.short_name} ({fmt(getattr(ranked[1], col), unit)}) and "
             f"{ranked[2].mine.short_name} ({fmt(getattr(ranked[2], col), unit)}).")
    rows = [[str(i + 1), r.mine.short_name, r.mine.subsidiary, fmt(getattr(r, col), unit)] for i, r in enumerate(ranked)]
    return draft, hits, {"table": {"headers": ["Rank", "Mine", "Subsidiary", label.capitalize()], "rows": rows}}


def h_aggregate(db, q, mines, fy, metric):
    fy = fy or LATEST_VERIFIED_FY
    label, col, unit, tags, _ = METRICS[metric]
    group = korba_group(db)
    recs = [r for r in (record(db, m, fy) for m in group) if r]
    hits = retrieve(db, "aggregate summary " + q, fy=fy, metric_tags=tags + ["aggregate"])
    if not recs or not hits:
        return None, hits, {}
    total = sum(getattr(r, col) for r in recs)
    draft = f"The aggregate {label} of the Korba group of mines (Gevra, Kusmunda, Dipka, Manikpur, Korba) in FY {fy} was {fmt(total, unit)}."
    if metric == "coal_production":
        tgt = sum(r.target_mt for r in recs)
        draft += f" This is {total / tgt * 100:.1f}% of the combined target of {tgt:.1f} MT."
    return draft, hits, {"facts": [{"label": f"Total {label}", "value": fmt(total, unit)}]}


def h_reclamation(db, q, mines, fy, metric):
    fy = fy or LATEST_VERIFIED_FY
    group = korba_group(db)
    recs = [r for r in (record(db, m, fy) for m in group) if r]
    hits = retrieve(db, "land reclamation progress hectares reclaimed plantation " + q, fy=fy, metric_tags=["land_reclaimed", "plantation"])
    if not recs or not hits:
        return None, hits, {}
    total = sum(r.land_reclaimed_ha for r in recs)
    prev_fy = FINANCIAL_YEARS[FINANCIAL_YEARS.index(fy) - 1] if fy in FINANCIAL_YEARS[1:] else None
    prev_total = sum(r.land_reclaimed_ha for r in (record(db, m, prev_fy) for m in group) if r) if prev_fy else None
    draft = f"During FY {fy}, the Korba group of mines reclaimed a total of {total:g} hectares of mined-out land"
    if prev_total:
        draft += f", {((total - prev_total) / prev_total * 100):+.1f}% compared with FY {prev_fy} ({prev_total:g} ha)"
    top = max(recs, key=lambda r: r.land_reclaimed_ha)
    draft += (f". {top.mine.short_name} contributed the largest share ({top.land_reclaimed_ha:g} ha). "
              "Reclamation combined backfilling, topsoil spreading and biological reclamation with native species.")
    rows = [[r.mine.short_name, f"{r.land_reclaimed_ha:g}"] for r in sorted(recs, key=lambda r: -r.land_reclaimed_ha)]
    return draft, hits, {"table": {"headers": ["Mine", "Land reclaimed (ha)"], "rows": rows + [["Total", f"{total:g}"]]},
                         "facts": [{"label": "Total land reclaimed", "value": f"{total:g} ha"}]}


def h_geology(db, q, mines, fy, metric):
    mine = mines[0]
    geo = db.query(GeologicalRecord).filter_by(mine_id=mine.id).first()
    hits = retrieve(db, "geological reserves seams exploration " + q, mines=[mine], metric_tags=["reserves", "seam", "drilling", "boreholes"])
    if geo is None or not hits:
        return None, hits, {}
    draft = (f"As per the geological assessment ({geo.assessment_year}), {mine.short_name} holds geological reserves of "
             f"{geo.geological_reserves_mt:,.1f} MT, of which {geo.extractable_reserves_mt:,.1f} MT are extractable. The principal seams are "
             f"{geo.principal_seams} with an average thickness of {geo.avg_seam_thickness_m} m; coal is of grade {geo.coal_grade} "
             f"(average GCV {geo.gcv_kcal_kg:,} kcal/kg). Exploration comprised {geo.boreholes} boreholes totalling {geo.drilling_m:,.0f} m.")
    facts = [{"label": "Geological reserves", "value": f"{geo.geological_reserves_mt:,.1f} MT"},
             {"label": "Extractable reserves", "value": f"{geo.extractable_reserves_mt:,.1f} MT"},
             {"label": "Grade", "value": geo.coal_grade}, {"label": "Avg. seam thickness", "value": f"{geo.avg_seam_thickness_m} m"}]
    return draft, hits, {"facts": facts}


GENERIC = {"coal", "mine", "mines", "mining", "cil", "secl", "cmpdi", "india", "data", "information", "report"}


def h_semantic(db, q, mines, fy, metric):
    hits = vector_search.search(db, q, owner_id=_OWNER.get(), k=3, mines=[m.code for m in mines] or None, fy=fy, verified_only=True, one_per_document=True)
    specific = set(tokenize(q)) - GENERIC
    if not hits or not specific:
        return None, [], {}
    content_tokens = set(tokenize(hits[0].chunk.content + " " + hits[0].chunk.section))
    coverage = len(specific & content_tokens) / len(specific)
    if coverage < 0.6 or hits[0].similarity < 0.05:
        return None, [], {}
    hits = [h for h in hits if len(specific & set(tokenize(h.chunk.content))) / len(specific) >= 0.4]
    top = hits[0].chunk
    doc = db.get(Document, top.document_id)
    line = best_line(top.content, q, mines, fy)
    draft = (f"The most relevant verified passage is in {doc.title} (page {top.page_number}, {top.section}): "
             f"“{line.strip()}”. Please review the cited source for full context.")
    return draft, hits, {}


HANDLERS = {
    "metric_lookup": h_metric_lookup, "targets_exceeded": h_targets_exceeded, "trend": h_trend,
    "mine_summary": h_mine_summary, "compare": h_compare, "ranking": h_ranking, "aggregate": h_aggregate,
    "reclamation_overview": h_reclamation, "geology": h_geology, "semantic": h_semantic,
}


# ------------------------------------------------------------------ entry point

CHECKABLE = {"coal_production", "target", "overburden", "land_reclaimed", "manpower", "dispatch"}


def cross_check(db: Session, mine: Mine, fy: str, metric: str) -> dict | None:
    """Consistency Guard summary for the figure an answer is built on."""
    c = consistency_service.check(db, _OWNER.get(), mine.code, fy, metric)
    if c is None or c["status"] == "single":
        return None
    minority = [cl for cl in c["clusters"][1:]]
    return {
        "key": f"{mine.code}|{fy}|{metric}", "status": c["status"], "severity": c["severity"], "label": c["label"],
        "source_count": c["source_count"], "agreeing": c["agreeing"], "consensus": c["consensus_display"],
        "differing": [{"value": cl["display"], "sources": [f"{s['title']} p.{s['page']}" for s in cl["sources"]],
                       "provisional": all(s["provisional"] for s in cl["sources"])} for cl in minority],
        "resolution": c["resolution"],
    }


def answer(db: Session, question: str, user: dict) -> dict:
    _OWNER.set(user["id"])
    t0 = time.perf_counter()
    q = question.strip()
    mines = parse_mines(db, q)
    fy = parse_fy(q)
    metric = parse_metric(q)
    intent = detect_intent(q, mines, metric)
    if intent == "metric_lookup" and metric is None:
        intent = "semantic"
    draft, hits, extras = HANDLERS[intent](db, q, mines, fy, metric)
    if draft is None and intent != "semantic":
        draft, hits, extras = h_semantic(db, q, mines, fy, metric)
        intent = "semantic" if draft else intent
    grounded = draft is not None and bool(hits)
    consistency = None
    if grounded and mines and intent in ("metric_lookup", "mine_summary"):
        m_key = metric if (intent == "metric_lookup" and metric in CHECKABLE) else "coal_production" if intent == "mine_summary" or metric == "target" else None
        if m_key:
            consistency = cross_check(db, mines[0], fy or LATEST_VERIFIED_FY, m_key)
        if consistency and consistency["status"] == "conflict":
            d = consistency["differing"][0]
            kind = "provisional source reports" if d["provisional"] else "source reports"
            draft += (f"\n\nCross-source check: {consistency['agreeing']} of {consistency['source_count']} documents agree on "
                      f"{consistency['consensus']}; {len(d['sources'])} {kind} {d['value']}. Review it in Consistency Guard before official use.")
        elif consistency and consistency["status"] == "resolved":
            draft += (f"\n\nCross-source check: a disagreement between sources was resolved by {consistency['resolution']['user']} "
                      f"({consistency['resolution']['display']} confirmed as authoritative).")
    hints = [METRICS[metric][0].split(" (")[0]] if metric else None
    sources = build_sources(db, hits, q, mines, fy, hints) if grounded else []
    llm = get_llm()
    if grounded:
        ctx = [{"title": s["document_title"], "page": s["page"], "text": s["snippet"]} for s in sources]
        text = llm.generate(q, draft, ctx)
    else:
        text = NOT_FOUND
        extras = {}
    latency = int((time.perf_counter() - t0) * 1000)
    total_chunks = vector_search_count(db)
    rec = AIQuery(owner_id=user["id"], question=q, answer=text, intent=intent, grounded=grounded, user=user["name"], latency_ms=latency)
    db.add(rec)
    db.flush()
    for s in sources:
        db.add(AISource(query_id=rec.id, chunk_id=s["chunk_id"], document_id=s["document_id"], page_number=s["page"], relevance=s["relevance"]))
    audit_service.for_user(db, user, action="AI query answered" if grounded else "AI query — no verified source found",
                      category="ai", status="Answered" if grounded else "No Source", document_label=sources[0]["document_title"] if sources else "—",
                      source=f"{len(sources)} source(s) retrieved",
                      details={"question": q, "intent": intent, "sources": [f"{s['filename']} p.{s['page']}" for s in sources],
                               "model": llm.name, "embedding": get_embedder().name, "latency_ms": latency,
                               "consistency": consistency["status"] if consistency else None})
    understanding = {"intent": intent.replace("_", " "), "mines": [m.short_name for m in mines],
                     "financial_year": f"FY {fy}" if fy else f"FY {LATEST_VERIFIED_FY} (default: latest verified)" if intent != "trend" else "FY 2021-22 → 2025-26",
                     "metric": METRICS[metric][0] if metric else None}
    payload = {
        "id": rec.id, "question": q, "answer": text, "intent": intent, "grounded": grounded,
        "sources": sources, "sources_count": len(sources), **extras,
        "consistency": consistency,
        "understanding": understanding,
        "trust": {"label": "Grounded in verified organizational data" if grounded else "No verified source found",
                  "verified_only": True, "llm": llm.name, "embedding_model": get_embedder().name,
                  "chunks_searched": total_chunks, "latency_ms": latency},
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    rec.payload = payload  # stored so the user's query history can be replayed exactly
    db.commit()
    return payload


def vector_search_count(db: Session) -> int:
    return db.query(KnowledgeChunk).filter(KnowledgeChunk.owner_id == _OWNER.get(), KnowledgeChunk.verified.is_(True)).count()
