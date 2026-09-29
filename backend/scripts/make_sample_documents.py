"""Generate small, valid sample files for the live upload demo.

Usage (from backend/):  python -m scripts.make_sample_documents
Creates ../sample_documents/ with PDF, XLSX and an intentionally invalid file.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database.demo_data import PRODUCTION  # noqa: E402
from app.utils.exporters import to_xlsx  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "sample_documents"


def make_pdf(lines: list[str]) -> bytes:
    """Minimal single-page PDF with a text layer (no external libraries)."""
    esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    y, ops = 780, ["BT", "/F1 11 Tf"]
    for i, ln in enumerate(lines):
        size = 15 if i == 0 else 11
        ops.append(f"/F1 {size} Tf 1 0 0 1 60 {y} Tm ({esc(ln)}) Tj")
        y -= 24 if i == 0 else 17
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{off:010d} 00000 n \n".encode() for off in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def main():
    OUT.mkdir(exist_ok=True)
    p, t, ob, land, mp, _ = PRODUCTION["DIP"]["2023-24"]
    (OUT / "Dipka_OCP_Production_Report_FY2023-24.pdf").write_bytes(make_pdf([
        "DIPKA OC MINE - ANNUAL PRODUCTION REPORT (SAMPLE)",
        "South Eastern Coalfields Limited - Dipka Area - FY 23-24",
        f"Coal production: {int(p * 1e6):,} tonnes against target of {t} Million Tonnes",
        f"Overburden removal: {ob} M.Cum",
        f"Land reclaimed: {land} ha    Manpower on roll: {mp:,}",
        "SAMPLE DEMONSTRATION DOCUMENT - NOT AN OFFICIAL CIL RECORD",
    ]))
    p, t, ob, land, mp, _ = PRODUCTION["MNK"]["2024-25"]
    (OUT / "Manikpur_OCP_Production_Report_FY2024-25.pdf").write_bytes(make_pdf([
        "MANIKPUR OC MINE - ANNUAL PRODUCTION REPORT (SAMPLE)",
        "South Eastern Coalfields Limited - Korba Area - FY 24-25",
        f"Coal production: {int(p * 1e6):,} tonnes against target of {t} Million Tonnes",
        f"Overburden removal: {ob} M.Cum   Land reclaimed: {land} ha",
        "SAMPLE DEMONSTRATION DOCUMENT - NOT AN OFFICIAL CIL RECORD",
    ]))
    rows = [[c, round(PRODUCTION[c]["2025-26"][0] / 12, 2), round(PRODUCTION[c]["2025-26"][1] / 12, 2)] for c in ["GEV", "KUS", "DIP", "MNK", "KOR"]]
    (OUT / "Korba_Area_Monthly_MIS_May2025.xlsx").write_bytes(
        to_xlsx("Production", ["Mine code", "Production (MT)", "Target (MT)"], rows, title="Korba Area Monthly MIS - May 2025 (SAMPLE)"))
    (OUT / "Gevra_Site_Notes.txt").write_text("Unsupported file type - used to demonstrate upload validation.\n")
    (OUT / "Fake_Report_FY2024-25.pdf").write_bytes(b"This is not really a PDF - used to demonstrate signature validation.")
    print(f"Sample documents written to {OUT}")


if __name__ == "__main__":
    main()
