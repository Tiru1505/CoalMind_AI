"""Generates realistic document page layouts, knowledge chunks and extracted
fields from the structured demo dataset.

In a production deployment this module does not exist: pages come from the
OCR/layout pipeline and fields from the entity extractor. For the prototype
it stands in for "what the OCR engine would have read" so that the preview,
highlighting, citations and validation all refer to the same text.
"""
from __future__ import annotations

from app.database.demo_data import GEOLOGY, MINES, PRODUCTION

MINE_INFO = {m[0]: {"code": m[0], "name": m[1], "short": m[2], "type": m[3], "subsidiary": m[4], "area": m[5]} for m in MINES}
SECL_KORBA = ["GEV", "KUS", "DIP", "MNK", "KOR"]
GEOLOGY_CODES = set(GEOLOGY)


def fy_short(fy: str) -> str:
    """'2024-25' -> 'FY 24-25' (the way many scanned reports print it)."""
    a, b = fy.split("-")
    return f"FY {a[2:]}-{b}"


def prev_fy(fy: str) -> str:
    a = int(fy[:4]) - 1
    return f"{a}-{str(a + 1)[2:]}"


def metrics(code: str, fy: str) -> dict:
    prod, target, ob, land, manpower, safety = PRODUCTION[code][fy]
    return {
        "prod": prod, "target": target, "ob": ob, "land": land, "manpower": manpower, "safety": safety,
        "ach": prod / target * 100, "sr": ob / prod, "dispatch": round(prod * 0.99, 2),
        "oms": prod * 1e6 / (manpower * 300), "drilling": round(ob * 2150),
    }


def page_text(blocks: list[dict]) -> str:
    lines: list[str] = []
    for b in blocks:
        t = b["type"]
        if t in ("heading", "subheading", "para", "note"):
            lines.append(b["text"])
        elif t == "kv":
            lines.extend(f"{k}: {v}" for k, v in b["items"])
        elif t == "table":
            if b.get("caption"):
                lines.append(b["caption"])
            lines.append(" | ".join(b["headers"]))
            lines.extend(" | ".join(str(c) for c in r) for r in b["rows"])
    return "\n".join(lines)


class Builder:
    """Accumulates pages, chunks and fields for one document."""

    def __init__(self) -> None:
        self.pages: list[dict] = []
        self.chunks: list[dict] = []
        self.fields: list[dict] = []
        self.tables = 0

    def page(self, number: int, title: str, blocks: list[dict], *, chunk: dict | None = None, ocr: float = 97.5):
        self.pages.append({"page_number": number, "title": title, "blocks": blocks, "ocr_confidence": ocr})
        self.tables += sum(1 for b in blocks if b["type"] == "table")
        if chunk is not None:
            self.chunks.append({
                "page_number": number, "section": title, "content": page_text(blocks),
                "mine_codes": chunk.get("mines", []), "financial_year": chunk.get("fy", ""),
                "topic": chunk.get("topic", ""), "metrics": chunk.get("metrics", []),
            })

    def field(self, key, label, original, ai_value, unit, conf, page, anchor=None, warning=None, column=None):
        self.fields.append({
            "field_key": key, "label": label, "original_text": original, "ai_value": ai_value, "unit": unit,
            "confidence": conf, "page_number": page, "anchor": anchor or original, "warning": warning,
            "record_column": column, "order": len(self.fields),
        })

    def result(self, fields_total: int | None = None) -> dict:
        return {"pages": self.pages, "chunks": self.chunks, "fields": self.fields, "tables": self.tables,
                "fields_total": fields_total or max(len(self.fields) * 4, len(self.fields))}


# --------------------------------------------------------------------------- builders

def production_report(code: str, fy: str, demo: bool = False) -> dict:
    """Mine annual production report. `demo=True` injects the OCR ambiguities
    used in the jury walkthrough (Gevra FY 2024-25)."""
    mi = MINE_INFO[code]
    m = metrics(code, fy)
    pfy = prev_fy(fy)
    pm = metrics(code, pfy) if pfy in PRODUCTION[code] else None
    fs = fy_short(fy)
    tonnes = f"{int(round(m['prod'] * 1e6)):,}"
    b = Builder()
    title = f"{mi['short'].upper()} MINE — ANNUAL PRODUCTION REPORT"
    ctx = {"mines": [code], "fy": fy}

    b.page(1, "Cover", [
        {"type": "heading", "text": title},
        {"type": "para", "text": f"{'South Eastern Coalfields Limited' if mi['subsidiary']=='SECL' else mi['subsidiary']} (A Subsidiary of Coal India Limited)"},
        {"type": "kv", "items": [
            ["Report No.", f"{mi['subsidiary']}/{mi['area'].split()[0].upper()}/PR/{fy}/017"],
            ["Financial Year", fs], ["Mine", mi["name"]], ["Area", mi["area"]],
            ["Prepared by", "Area Planning & Projects Section"], ["Classification", "Restricted — Internal Use"],
        ]},
    ], ocr=98.9 if demo else 99.2)

    trend_word = "an increase" if pm and m["prod"] >= pm["prod"] else "a decline"
    change = abs(m["prod"] - pm["prod"]) / pm["prod"] * 100 if pm else 0
    reason = ("The shortfall against target is attributed primarily to an extended monsoon (July–September) "
              "and delay in land possession for the southern dump extension." if m["ach"] < 100 else
              "The target was exceeded on the back of improved HEMM availability, additional contractual OB "
              "patches and uninterrupted rake availability.")
    b.page(3, "Executive Summary", [
        {"type": "heading", "text": "1. Executive Summary"},
        {"type": "para", "text": (f"During {fs}, {mi['short']} Mine recorded coal production of {m['prod']:.1f} MT "
                                  f"against the annual target of {m['target']:.1f} MT, an achievement of {m['ach']:.1f}%. "
                                  f"Overburden removal stood at {m['ob']} Mm³ with a stripping ratio of {m['sr']:.2f} m³/t.")},
        {"type": "para", "text": (f"Production registered {trend_word} of {change:.1f}% over FY {pfy} ({pm['prod']:.1f} MT). " if pm else "") + reason},
        {"type": "para", "text": f"Land reclaimed during the year was {m['land']} hectares and the mine deployed a workforce of {m['manpower']:,}."},
    ], chunk={**ctx, "topic": "production-output", "metrics": ["summary"]})

    rows = [
        ["Coal Production", f"{m['target']:.1f} Million Tonnes", f"{tonnes} tonnes", f"{m['ach']:.2f} %"],
    ]
    if pm:
        rows.append([f"Production {fy_short(pfy)} (for reference)", f"{pm['target']:.1f} Million Tonnes", f"{pm['prod']:.1f} MT", f"{pm['ach']:.2f} %"])
    b.page(23, "Production Performance", [
        {"type": "heading", "text": "4. Production Performance"},
        {"type": "table", "caption": f"Table 4.1: Coal Production vs Annual Target — {mi['short']}, {fs}",
         "headers": ["Parameter", "Annual Target", "Actual", "Achievement (%)"], "rows": rows},
        {"type": "note", "text": "Source: Monthly MIS returns (April–March), reconciled with weighbridge dispatch records."},
    ], chunk={**ctx, "topic": "production-output", "metrics": ["coal_production", "target", "achievement", "dispatch"]},
        ocr=93.4 if demo else 98.1)

    b.page(24, "Coal Dispatch", [
        {"type": "heading", "text": "4.3 Coal Dispatch"},
        {"type": "table", "caption": "Table 4.3: Mode-wise coal dispatch (merged header in original)",
         "headers": ["Parameter", "Rail (MGR + Railway)", "Road", "Total"], "rows": [
             ["Coal Dispatch", f"{m['dispatch'] * 0.83:.2f} MT", f"{m['dispatch'] * 0.17:.2f} MT", f"{m['dispatch']:.2f} MT"],
         ]},
    ], chunk={**ctx, "topic": "production-output", "metrics": ["dispatch"]}, ocr=86.5 if demo else 97.8)

    b.page(27, "Overburden Removal", [
        {"type": "heading", "text": "5. Overburden Removal & Excavation"},
        {"type": "table", "caption": "Table 5.2: OB Removal and Stripping Ratio",
         "headers": ["Parameter", "Value", "Unit"], "rows": [
             ["Overburden Removal", f"{m['ob']} M.Cum", "Mm³"],
             ["Stripping Ratio", f"{m['sr']:.2f} Cum/T", "m³/t"],
             ["Blast-hole Drilling", f"{m['drilling']:,} m", "m"],
             ["Total Excavation", f"{m['ob'] + m['prod'] / 1.4:.1f} M.Cum", "Mm³"],
         ]},
        {"type": "para", "text": "OB removal was carried out departmentally (shovel-dumper combination) and through outsourced patches."},
    ], chunk={**ctx, "topic": "production-output", "metrics": ["overburden", "stripping_ratio", "drilling"]})

    land_display = f"{m['land']} ha*" if demo else f"{m['land']} ha"
    blocks = [
        {"type": "heading", "text": "7. Land Reclamation"},
        {"type": "kv", "items": [
            ["Land Reclaimed (Technical + Biological)", land_display],
            ["Area under Plantation", f"{round(m['land'] * 0.78)} ha"],
            ["Saplings Planted", f"{int(m['land'] * 2500):,}"],
        ]},
        {"type": "para", "text": f"Reclaimed land at {mi['short']} was stabilised through backfilling, topsoil spreading and biological reclamation with native species."},
    ]
    if demo:
        blocks.append({"type": "note", "text": "* Figure partially illegible in scanned original; handwritten correction mark present."})
    b.page(31, "Land Reclamation", blocks,
           chunk={**ctx, "topic": "land-reclamation", "metrics": ["land_reclaimed"]}, ocr=81.6 if demo else 97.0)

    b.page(35, "Manpower", [
        {"type": "heading", "text": "8. Manpower & Productivity"},
        {"type": "kv", "items": [
            ["Total Manpower on Roll", f"{m['manpower']:,}"],
            ["Departmental / Contractual", f"{round(m['manpower'] * 0.62):,} / {round(m['manpower'] * 0.38):,}"],
            ["Output per Man-Shift (OMS)", f"{m['oms']:.2f} t"],
        ]},
    ], chunk={**ctx, "topic": "manpower-productivity", "metrics": ["manpower", "productivity"]})

    b.page(40, "Safety", [
        {"type": "heading", "text": "9. Safety Performance"},
        {"type": "kv", "items": [
            ["Reportable Incidents", str(m["safety"])], ["Fatal Accidents", "Nil"],
            ["Internal Safety Audits Conducted", "4 (Quarterly)"], ["DGMS Inspections", "6"],
        ]},
        {"type": "para", "text": "Slope stability monitoring was carried out using slope stability radar at critical benches."},
    ], chunk={**ctx, "topic": "safety-compliance", "metrics": ["safety"]}, ocr=84.2 if demo else 97.3)

    b.field("report_name", "Report Name", title, f"{mi['short']} Mine Production Report", "", 99, 1)
    b.field("financial_year", "Financial Year", fs, f"FY {fy}", "", 97, 1)
    b.field("mine", "Mine", mi["name"], mi["name"], "", 99, 1)
    b.field("coal_production", "Coal Production", f"{tonnes} tonnes", f"{m['prod']:.1f}", "MT", 98, 23, column="coal_production_mt")
    b.field("production_target", "Production Target", f"{m['target']:.1f} Million Tonnes", f"{m['target']:.1f}", "MT", 97, 23, column="target_mt")
    b.field("achievement", "Achievement", f"{m['ach']:.2f} %", f"{m['ach']:.2f}", "%", 96, 23)
    b.field("coal_dispatch", "Coal Dispatch", f"{m['dispatch']:.2f} MT", f"{m['dispatch']:.2f}", "MT", 78 if demo else 95, 24,
            warning="Value sits under a merged table header — row alignment uncertain." if demo else None, column="dispatch_mt")
    b.field("overburden", "Overburden Removal", f"{m['ob']} M.Cum", f"{m['ob']}", "Mm³", 94, 27, column="overburden_mm3")
    b.field("stripping_ratio", "Stripping Ratio", f"{m['sr']:.2f} Cum/T", f"{m['sr']:.2f}", "m³/t", 89, 27, column="stripping_ratio")
    b.field("manpower", "Manpower", f"{m['manpower']:,}", f"{m['manpower']:,}", "", 91, 35, column="manpower")
    b.field("land_reclaimed", "Land Reclaimed", f"1 {str(m['land'])[1:]} ha*" if demo else f"{m['land']} ha", f"{m['land']}", "hectares",
            72 if demo else 96, 31, anchor=land_display,
            warning="Possible OCR ambiguity detected — scanned cell reads '1 42' with a handwritten correction mark." if demo else None,
            column="land_reclaimed_ha")
    b.field("safety_incidents", "Reportable Safety Incidents", str(m["safety"]), str(m["safety"]), "", 76 if demo else 97, 40,
            warning="Handwritten annotation detected adjacent to value; figure may have been amended." if demo else None,
            column="safety_incidents")
    return b.result(fields_total=48)


def production_summary(fy: str, codes: list[str], doc_title: str, page_no: int, subsidiary_label: str, topic_page: int = 3) -> dict:
    b = Builder()
    fs = f"FY {fy}"
    tot_p = sum(PRODUCTION[c][fy][0] for c in codes)
    tot_t = sum(PRODUCTION[c][fy][1] for c in codes)
    b.page(1, "Cover", [
        {"type": "heading", "text": doc_title.upper()},
        {"type": "kv", "items": [["Coverage", subsidiary_label], ["Period", f"April–March, {fs}"], ["Compiled by", "Production MIS Cell"]]},
    ])
    b.page(topic_page, "Summary", [
        {"type": "heading", "text": "Summary of Performance"},
        {"type": "para", "text": (f"Aggregate coal production of the covered mines in {fs} was {tot_p:.1f} MT against a combined target "
                                  f"of {tot_t:.1f} MT ({tot_p / tot_t * 100:.1f}%). Mine-wise details are given in the table on page {page_no}.")},
    ], chunk={"mines": codes, "fy": fy, "topic": "production-output", "metrics": ["coal_production", "target", "achievement", "aggregate"]})
    rows = []
    for c in codes:
        p, t, ob, *_ = PRODUCTION[c][fy]
        rows.append([MINE_INFO[c]["short"], f"{t:.1f}", f"{p:.1f}", f"{p / t * 100:.1f}", f"{ob}"])
    b.page(page_no, "Mine-wise Production", [
        {"type": "heading", "text": "Mine-wise Coal Production and OB Removal"},
        {"type": "table", "caption": f"Table: Mine-wise production vs target — {fs}",
         "headers": ["Mine", "Target (MT)", "Production (MT)", "Achievement (%)", "OB Removal (Mm³)"], "rows": rows},
    ], chunk={"mines": codes, "fy": fy, "topic": "production-output", "metrics": ["coal_production", "target", "achievement", "overburden"]})
    for i, c in enumerate(codes[:4]):
        p = PRODUCTION[c][fy][0]
        b.field(f"prod_{c.lower()}", f"Production — {MINE_INFO[c]['short']}", f"{p:.1f}", f"{p:.1f}", "MT", 98 - i * 0.5, page_no)
    b.field("aggregate_production", "Aggregate Production", f"{tot_p:.1f} MT", f"{tot_p:.1f}", "MT", 97, topic_page)
    return b.result(fields_total=36)


def multi_year_trend(codes: list[str], fys: list[str], title: str, page_no: int) -> dict:
    b = Builder()
    b.page(1, "Cover", [{"type": "heading", "text": title.upper()}, {"type": "para", "text": "South Eastern Coalfields Limited — Korba Group of Mines"}])
    headers = ["Mine"] + [f"FY {f}" for f in fys]
    rows = [[MINE_INFO[c]["short"]] + [f"{PRODUCTION[c][f][0]:.1f}" for f in fys] for c in codes]
    rows.append(["Total"] + [f"{sum(PRODUCTION[c][f][0] for c in codes):.1f}" for f in fys])
    b.page(page_no, "Production Trend", [
        {"type": "heading", "text": "Multi-year Production Trend (MT)"},
        {"type": "table", "caption": "Table: Coal production by mine and financial year (MT)", "headers": headers, "rows": rows},
        {"type": "para", "text": "Production of the Korba group has grown steadily, driven by capacity expansion at Gevra and Kusmunda."},
    ], chunk={"mines": codes, "fy": ",".join(fys), "topic": "production-output", "metrics": ["coal_production", "trend"]})
    fy = fys[-1]
    b.page(8, "Mine-wise Production", [
        {"type": "heading", "text": f"Mine-wise Coal Production — FY {fy}"},
        {"type": "table", "caption": f"Table 3.1: Production vs target — FY {fy}",
         "headers": ["Mine", "Target (MT)", "Production (MT)", "Achievement (%)"],
         "rows": [[MINE_INFO[c]["short"], f"{PRODUCTION[c][fy][1]:.1f}", f"{PRODUCTION[c][fy][0]:.1f}",
                   f"{PRODUCTION[c][fy][0] / PRODUCTION[c][fy][1] * 100:.1f}"] for c in codes]},
    ], chunk={"mines": codes, "fy": fy, "topic": "production-output", "metrics": ["coal_production", "target", "achievement"]})
    b.field("total_production", f"Total Production FY {fy}", rows[-1][-1], rows[-1][-1], "MT", 97, page_no)
    return b.result(fields_total=44)


def geological_assessment(code: str, bilingual: bool = False) -> dict:
    mi = MINE_INFO[code]
    yr, gr, er, seams, thick, grade, gcv, bh, drill, depth = GEOLOGY[code]
    b = Builder()
    b.page(1, "Cover", [
        {"type": "heading", "text": f"GEOLOGICAL ASSESSMENT REPORT — {mi['short'].upper()} BLOCK"},
        {"type": "para", "text": "Central Mine Planning & Design Institute Ltd. (CMPDI), Regional Institute-V, Bilaspur"},
        {"type": "kv", "items": [["Assessment Year", yr], ["Coalfield", "Korba Coalfield" if mi["subsidiary"] == "SECL" else "—"]]},
    ])
    kv = [["Geological Reserves", f"{gr:,.1f} MT"], ["Extractable Reserves", f"{er:,.1f} MT"],
          ["Principal Seams", seams], ["Average Seam Thickness", f"{thick} m"], ["Coal Grade", grade], ["Average GCV", f"{gcv:,} kcal/kg"]]
    blocks = [{"type": "heading", "text": "3. Reserve Estimation"}]
    if bilingual:
        blocks.append({"type": "para", "text": f"भूवैज्ञानिक भंडार (Geological Reserves): {gr:,.1f} मिलियन टन | निष्कर्षण योग्य भंडार (Extractable Reserves): {er:,.1f} मिलियन टन"})
    blocks.append({"type": "kv", "items": kv})
    b.page(5, "Reserve Estimation", blocks,
           chunk={"mines": [code], "fy": yr, "topic": "geological-exploration", "metrics": ["reserves", "seam", "grade"]}, ocr=91.8 if bilingual else 97.6)
    b.page(9, "Exploration", [
        {"type": "heading", "text": "4. Exploration & Drilling"},
        {"type": "table", "caption": "Table 4.3: Exploratory drilling summary", "headers": ["Parameter", "Value"],
         "rows": [["Boreholes Drilled", f"{bh}"], ["Total Drilling", f"{drill:,} m"], ["Maximum Depth Explored", f"{depth} m"], ["Core Recovery", "94.2 %"]]},
        {"type": "para", "text": f"The seams dip gently (3°–6°) towards the south-east. {seams} are correlated across the block using geophysical logs."},
    ], chunk={"mines": [code], "fy": yr, "topic": "geological-exploration", "metrics": ["drilling", "boreholes", "seam"]})
    b.field("geological_reserves", "Geological Reserves", f"{gr:,.1f} MT", f"{gr:,.1f}", "MT", 97, 5)
    b.field("extractable_reserves", "Extractable Reserves", f"{er:,.1f} MT", f"{er:,.1f}", "MT", 96, 5)
    b.field("seam_thickness", "Average Seam Thickness", f"{thick} m", f"{thick}", "m", 93, 5)
    b.field("coal_grade", "Coal Grade", grade, grade, "", 95, 5)
    b.field("boreholes", "Boreholes Drilled", f"{bh}", f"{bh}", "", 94, 9)
    b.field("drilling", "Total Drilling", f"{drill:,} m", f"{drill:,}", "m", 94, 9)
    return b.result(fields_total=41)


def land_reclamation_report(fy: str) -> dict:
    b = Builder()
    codes = SECL_KORBA
    tot = sum(PRODUCTION[c][fy][3] for c in codes)
    bio = round(tot * 0.64)
    saplings = int(tot * 2500)
    b.page(1, "Cover", [{"type": "heading", "text": "LAND RECLAMATION & ECO-RESTORATION REPORT 2025"},
                        {"type": "para", "text": f"Korba Group of Mines — progress during FY {fy} (period ending March 2025)"}])
    b.page(4, "Reclamation Summary", [
        {"type": "heading", "text": "2. Mine-wise Land Reclamation"},
        {"type": "table", "caption": f"Table 2.1: Land reclaimed during FY {fy} (hectares)",
         "headers": ["Mine", "Technical Reclamation (ha)", "Biological Reclamation (ha)", "Total (ha)"],
         "rows": [[MINE_INFO[c]["short"], f"{PRODUCTION[c][fy][3] - round(PRODUCTION[c][fy][3] * 0.64)}",
                   f"{round(PRODUCTION[c][fy][3] * 0.64)}", f"{PRODUCTION[c][fy][3]}"] for c in codes] + [["Total", f"{tot - bio}", f"{bio}", f"{tot}"]]},
        {"type": "para", "text": f"A total of {tot} hectares of mined-out land was reclaimed across the Korba group in FY {fy}, an increase of 9.2% over the previous year."},
    ], chunk={"mines": codes, "fy": fy, "topic": "land-reclamation", "metrics": ["land_reclaimed"]}, ocr=88.1)
    b.page(9, "Plantation", [
        {"type": "heading", "text": "3. Plantation & Biological Reclamation"},
        {"type": "kv", "items": [["Saplings Planted", f"{saplings:,}"], ["Survival Rate", "81 %"], ["Species", "Sal, Karanj, Neem, Bamboo, Arjun"]]},
        {"type": "para", "text": "An eco-park has been developed on the reclaimed external dump at Gevra; seed-ball plantation trials were undertaken at Kusmunda."},
    ], chunk={"mines": codes, "fy": fy, "topic": "land-reclamation", "metrics": ["plantation", "land_reclaimed"]}, ocr=79.4)
    b.field("total_land_reclaimed", "Total Land Reclaimed", f"{tot} ha", f"{tot}", "hectares", 95, 4)
    b.field("gevra_land", "Land Reclaimed — Gevra OC", f"{PRODUCTION['GEV'][fy][3]}", f"{PRODUCTION['GEV'][fy][3]}", "hectares", 93, 4)
    b.field("bio_reclamation", "Biological Reclamation Area", f"{bio} ha", f"{bio}", "hectares", 86, 4,
            warning="Column total does not match the sum of mine-wise rows by 1 ha (rounding or OCR error).")
    b.field("saplings", "Saplings Planted", f"{saplings:,}".replace(",", " "), f"{saplings:,}", "", 74, 9,
            anchor=f"{saplings:,}", warning="Digit grouping inconsistent in scanned text — value may be misread.")
    b.field("survival_rate", "Plantation Survival Rate", "81 %", "81", "%", 77, 9,
            warning="Handwritten figure overwritten in scanned copy; printed value partially obscured.")
    return b.result(fields_total=29)


def monthly_mis(month: str, fy: str, factor: float, hindi: bool = False) -> dict:
    b = Builder()
    codes = SECL_KORBA
    rows = []
    for c in codes:
        p = PRODUCTION[c][fy][0] / 12 * factor
        t = PRODUCTION[c][fy][1] / 12
        rows.append([MINE_INFO[c]["short"], f"{t:.2f}", f"{p:.2f}", f"{p / t * 100:.1f}", f"{PRODUCTION[c][fy][2] / 12 * factor:.2f}"])
    if hindi:
        headers = ["खदान (Mine)", "लक्ष्य (Target, MT)", "कोयला उत्पादन (Production, MT)", "उपलब्धि % (Achievement)", "ओबी (OB, Mm³)"]
        title = f"कोरबा क्षेत्र — मासिक प्रगति प्रतिवेदन ({month}) | Korba Area Monthly Progress Report"
    else:
        headers = ["Mine", "Target (MT)", "Production (MT)", "Achievement (%)", "OB (Mm³)"]
        title = f"Korba Area — Monthly MIS ({month})"
    b.page(1, "Sheet: Production", [
        {"type": "heading", "text": title},
        {"type": "table", "caption": f"{'मासिक उत्पादन' if hindi else 'Monthly production'} — {month}", "headers": headers, "rows": rows},
    ], chunk={"mines": codes, "fy": fy, "topic": "production-output", "metrics": ["coal_production", "monthly", "target", "overburden"]}, ocr=94.0 if hindi else 99.5)
    b.page(2, "Sheet: Dispatch & Manpower", [
        {"type": "heading", "text": "Dispatch and Manpower" if not hindi else "प्रेषण एवं जनशक्ति (Dispatch & Manpower)"},
        {"type": "table", "caption": "", "headers": ["Mine", "Dispatch (MT)", "Manpower"],
         "rows": [[MINE_INFO[c]["short"], f"{PRODUCTION[c][fy][0] / 12 * factor * 0.99:.2f}", f"{PRODUCTION[c][fy][4]:,}"] for c in codes]},
    ], chunk={"mines": codes, "fy": fy, "topic": "manpower-productivity", "metrics": ["dispatch", "manpower", "monthly"]})
    b.field("month", "Reporting Month", month, month, "", 99, 1)
    b.field("gevra_month_prod", "Gevra OC Monthly Production", rows[0][2], rows[0][2], "MT", 97, 1)
    b.field("kusmunda_month_prod", "Kusmunda OC Monthly Production", rows[1][2], rows[1][2], "MT", 97, 1)
    return b.result(fields_total=64)


def safety_audit() -> dict:
    b = Builder()
    fy = "2024-25"
    b.page(1, "Cover", [{"type": "heading", "text": "SECL SAFETY AUDIT REPORT — Q3 (OCT–DEC 2024)"},
                        {"type": "para", "text": "Internal Safety Organisation (ISO), South Eastern Coalfields Limited"}])
    b.page(6, "Incident Summary", [
        {"type": "heading", "text": "2. Incident Summary (April–December 2024)"},
        {"type": "table", "caption": "Table 2.1: Reportable incidents by mine", "headers": ["Mine", "Reportable Incidents", "Fatal", "Near-miss Reports"],
         "rows": [[MINE_INFO[c]["short"], f"{PRODUCTION[c][fy][5]}", "0", f"{12 + i * 3}"] for i, c in enumerate(SECL_KORBA)]},
        {"type": "para", "text": "No fatal accident was reported in the Korba group during the period. Slope stability radar alerts were acted upon within SOP timelines."},
    ], chunk={"mines": SECL_KORBA, "fy": fy, "topic": "safety-compliance", "metrics": ["safety"]})
    b.page(11, "DGMS Compliance", [
        {"type": "heading", "text": "4. Statutory (DGMS) Compliance"},
        {"type": "kv", "items": [["DGMS Circulars Complied", "46 of 48"], ["Pending Items", "2 (dump slope benching, haul-road berm height)"], ["Compliance Rate", "95.8 %"]]},
    ], chunk={"mines": SECL_KORBA, "fy": fy, "topic": "safety-compliance", "metrics": ["compliance"]})
    b.field("compliance_rate", "DGMS Compliance Rate", "95.8 %", "95.8", "%", 96, 11)
    b.field("fatal", "Fatal Accidents", "0", "0", "", 98, 6)
    return b.result(fields_total=22)


def environment_compliance() -> dict:
    b = Builder()
    b.page(1, "Cover", [{"type": "heading", "text": "ENVIRONMENTAL CLEARANCE COMPLIANCE REPORT — GEVRA OCP (2024)"},
                        {"type": "para", "text": "Half-yearly compliance submitted to MoEF&CC Regional Office, Raipur"}])
    b.page(7, "Air Quality", [
        {"type": "heading", "text": "5. Ambient Air Quality"},
        {"type": "table", "caption": "Table 5.1: Average PM10 / PM2.5 (µg/m³)", "headers": ["Station", "PM10", "PM2.5", "Standard (PM10)"],
         "rows": [["Core Zone — Haul Road", "212", "71", "300 (coal mine)"], ["Buffer — Gevra Village", "88", "39", "100"], ["Buffer — Dipka Colony", "81", "36", "100"]]},
        {"type": "para", "text": "Dust suppression is carried out using 18 mobile water sprinklers, fog cannons and a fixed sprinkler network along 14 km of haul roads."},
    ], chunk={"mines": ["GEV"], "fy": "2024-25", "topic": "environment", "metrics": ["air_quality"]})
    b.page(10, "Green Belt", [
        {"type": "heading", "text": "6. Green Belt & Afforestation"},
        {"type": "kv", "items": [["Plantation (cumulative)", "2.94 million saplings"], ["Green Belt Area", "612 ha"], ["Water Recycled for Sprinkling", "68 %"]]},
    ], chunk={"mines": ["GEV"], "fy": "2024-25", "topic": "environment", "metrics": ["plantation"]})
    b.field("pm10_core", "PM10 — Core Zone", "212", "212", "µg/m³", 94, 7)
    b.field("green_belt", "Green Belt Area", "612 ha", "612", "hectares", 95, 10)
    return b.result(fields_total=26)


def mine_plan_review() -> dict:
    b = Builder()
    m = metrics("MNK", "2023-24")
    b.page(1, "Cover", [{"type": "heading", "text": "MANIKPUR OCP — MINE PLAN REVIEW 2023"}, {"type": "para", "text": "Review of the approved Mining Plan & Mine Closure Plan (5-year cycle)"}])
    b.page(4, "Capacity Review", [
        {"type": "heading", "text": "2. Capacity and Production Review"},
        {"type": "para", "text": f"Manikpur OCP produced {m['prod']} MT in FY 2023-24 against a target of {m['target']} MT. Rated capacity has been enhanced from 5.25 to 6.5 MTY subject to EC amendment."},
        {"type": "kv", "items": [["Rated Capacity", "6.5 MTY"], ["Balance Life of Mine", "14 years"], ["Stripping Ratio (planned)", "3.10 m³/t"]]},
    ], chunk={"mines": ["MNK"], "fy": "2023-24", "topic": "production-output", "metrics": ["coal_production", "capacity"]})
    b.field("rated_capacity", "Rated Capacity", "6.5 MTY", "6.5", "MTY", 96, 4)
    b.field("life_of_mine", "Balance Life of Mine", "14 years", "14", "years", 92, 4)
    return b.result(fields_total=18)


BUILDERS = {
    "production_report": production_report,
    "production_summary": production_summary,
    "multi_year_trend": multi_year_trend,
    "geological_assessment": geological_assessment,
    "land_reclamation_report": land_reclamation_report,
    "monthly_mis": monthly_mis,
    "safety_audit": safety_audit,
    "environment_compliance": environment_compliance,
    "mine_plan_review": mine_plan_review,
}


def build(builder: str, args: dict) -> dict:
    return BUILDERS[builder](**args)
