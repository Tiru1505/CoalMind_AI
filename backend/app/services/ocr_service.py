"""File validation, parsing and OCR.

What is real in the prototype:
  * file-type validation by extension AND magic bytes, size limits
  * lightweight structural parsing (PDF page count, DOCX paragraphs, XLSX sheets)
What is simulated:
  * OCR text recognition, layout detection and table structure recognition.
    The simulated engine returns pages generated from the demo dataset
    (see content_builder) so previews and citations are consistent.

Production replacement: PaddleOCR (PP-OCRv4, with Hindi/Devanagari model)
as primary engine, Tesseract (`hin+eng`) as fallback, LayoutLMv3 for layout,
Table Transformer for table structure.
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass

ALLOWED = {
    "pdf": (b"%PDF",),
    "docx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "png": (b"\x89PNG",),
}
MAX_BYTES = 25 * 1024 * 1024

OCR_ENGINE = "PaddleOCR PP-OCRv4 (simulated) · fallback Tesseract hin+eng"


class FileValidationError(ValueError):
    pass


@dataclass
class ParseInfo:
    file_type: str
    pages: int
    source_kind: str  # Digital | Scanned
    detail: str


def validate_file(filename: str, data: bytes) -> str:
    if "." not in filename:
        raise FileValidationError("File has no extension. Supported: PDF, DOCX, XLSX, JPG, PNG.")
    ext = filename.rsplit(".", 1)[1].lower()
    if ext not in ALLOWED:
        raise FileValidationError(f"Unsupported file type '.{ext}'. Supported: PDF, DOCX, XLSX, JPG, PNG.")
    if len(data) == 0:
        raise FileValidationError("The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise FileValidationError("File exceeds the 25 MB limit for the demo environment.")
    if not any(data.startswith(sig) for sig in ALLOWED[ext]):
        raise FileValidationError(f"File content does not match the '.{ext}' extension (signature check failed).")
    if re.search(r"[\\/]|\.\.", filename):
        raise FileValidationError("Invalid file name.")
    return "jpg" if ext == "jpeg" else ext


def parse_structure(ext: str, data: bytes) -> ParseInfo:
    try:
        if ext == "pdf":
            pages = len(re.findall(rb"/Type\s*/Page[^s]", data)) or 1
            has_text = b"/Font" in data
            return ParseInfo(ext, pages, "Digital" if has_text else "Scanned",
                             f"{pages} page(s); {'text layer present' if has_text else 'no text layer — OCR required'}")
        if ext == "docx":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                xml = z.read("word/document.xml").decode("utf-8", "ignore")
            paras = xml.count("<w:p ") + xml.count("<w:p>")
            tables = xml.count("<w:tbl>")
            return ParseInfo(ext, max(1, paras // 40), "Digital", f"{paras} paragraphs, {tables} table(s)")
        if ext == "xlsx":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
            return ParseInfo(ext, max(1, len(sheets)), "Digital", f"{len(sheets)} worksheet(s)")
        return ParseInfo(ext, 1, "Scanned", "raster image — OCR required")
    except (zipfile.BadZipFile, KeyError):
        raise FileValidationError("The file appears to be corrupted and could not be parsed.")
