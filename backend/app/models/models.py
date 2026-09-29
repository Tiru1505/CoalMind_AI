"""SQLAlchemy ORM models for CoalMind AI."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(128))  # demo only: sha256 hash
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40))  # admin | geological_officer | management | viewer
    designation: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Mine(Base):
    __tablename__ = "mines"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(60))
    mine_type: Mapped[str] = mapped_column(String(40))  # Opencast | Underground | Area
    subsidiary: Mapped[str] = mapped_column(String(20))
    area: Mapped[str] = mapped_column(String(80))
    district: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(60))
    coalfield: Mapped[str] = mapped_column(String(80))
    lease_area_ha: Mapped[float] = mapped_column(Float)
    capacity_mty: Mapped[float] = mapped_column(Float)
    aliases: Mapped[list] = mapped_column(JSON, default=list)


class ProductionRecord(Base):
    __tablename__ = "production_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    mine_id: Mapped[int] = mapped_column(ForeignKey("mines.id"), index=True)
    financial_year: Mapped[str] = mapped_column(String(12), index=True)
    coal_production_mt: Mapped[float] = mapped_column(Float)
    target_mt: Mapped[float] = mapped_column(Float)
    overburden_mm3: Mapped[float] = mapped_column(Float)
    stripping_ratio: Mapped[float] = mapped_column(Float)
    dispatch_mt: Mapped[float] = mapped_column(Float)
    land_reclaimed_ha: Mapped[float] = mapped_column(Float)
    manpower: Mapped[int] = mapped_column(Integer)
    productivity_oms: Mapped[float] = mapped_column(Float)  # output per man-shift (t)
    drilling_m: Mapped[float] = mapped_column(Float)
    safety_incidents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="Verified")  # Verified | Provisional
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    mine: Mapped["Mine"] = relationship()


class GeologicalRecord(Base):
    __tablename__ = "geological_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    mine_id: Mapped[int] = mapped_column(ForeignKey("mines.id"), index=True)
    assessment_year: Mapped[str] = mapped_column(String(12))
    geological_reserves_mt: Mapped[float] = mapped_column(Float)
    extractable_reserves_mt: Mapped[float] = mapped_column(Float)
    principal_seams: Mapped[str] = mapped_column(String(160))
    avg_seam_thickness_m: Mapped[float] = mapped_column(Float)
    coal_grade: Mapped[str] = mapped_column(String(40))
    gcv_kcal_kg: Mapped[int] = mapped_column(Integer)
    boreholes: Mapped[int] = mapped_column(Integer)
    drilling_m: Mapped[float] = mapped_column(Float)
    max_depth_m: Mapped[float] = mapped_column(Float)
    mine: Mapped["Mine"] = relationship()


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(10))
    doc_category: Mapped[str] = mapped_column(String(60))  # Production Report, Geological Report, MIS...
    mine_id: Mapped[int | None] = mapped_column(ForeignKey("mines.id"), nullable=True)
    mine_label: Mapped[str] = mapped_column(String(120))
    financial_year: Mapped[str] = mapped_column(String(12))
    language: Mapped[str] = mapped_column(String(40), default="English")
    source_kind: Mapped[str] = mapped_column(String(40), default="Digital")  # Digital | Scanned
    pages: Mapped[int] = mapped_column(Integer, default=1)
    size_kb: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[str] = mapped_column(String(120))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(30), default="Uploaded")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    fields_extracted: Mapped[int] = mapped_column(Integer, default=0)
    tables_detected: Mapped[int] = mapped_column(Integer, default=0)
    topics: Mapped[list] = mapped_column(JSON, default=list)
    processing_log: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_path: Mapped[str | None] = mapped_column(String(400), nullable=True)
    is_demo_target: Mapped[bool] = mapped_column(Boolean, default=False)
    mine: Mapped["Mine | None"] = relationship()


class DocumentPage(Base):
    __tablename__ = "document_pages"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200), default="")
    blocks: Mapped[list] = mapped_column(JSON, default=list)  # [{type, text|headers/rows}]
    text: Mapped[str] = mapped_column(Text, default="")
    ocr_confidence: Mapped[float] = mapped_column(Float, default=0.0)


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    field_key: Mapped[str] = mapped_column(String(60))
    label: Mapped[str] = mapped_column(String(120))
    original_text: Mapped[str] = mapped_column(String(200))  # raw OCR string
    ai_value: Mapped[str] = mapped_column(String(200))  # normalized AI value
    unit: Mapped[str] = mapped_column(String(20), default="")
    human_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    confidence: Mapped[float] = mapped_column(Float)
    page_number: Mapped[int] = mapped_column(Integer)
    anchor: Mapped[str] = mapped_column(String(200), default="")  # text to highlight in the page
    warning: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending | auto_accepted | approved | rejected
    record_column: Mapped[str | None] = mapped_column(String(60), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    validated_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ValidationRecord(Base):
    __tablename__ = "validation_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("extracted_fields.id"), index=True)
    action: Mapped[str] = mapped_column(String(20))  # approve | edit | reject
    previous_value: Mapped[str] = mapped_column(String(200))
    new_value: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(String(300), default="")
    user: Mapped[str] = mapped_column(String(120))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    document_count: Mapped[int] = mapped_column(Integer)
    trend_pct: Mapped[float] = mapped_column(Float)
    keywords: Mapped[list] = mapped_column(JSON, default=list)  # [{term, weight}]
    yearly: Mapped[dict] = mapped_column(JSON, default=dict)  # {"2021": 60, ...}
    related_mines: Mapped[list] = mapped_column(JSON, default=list)
    statistics: Mapped[list] = mapped_column(JSON, default=list)  # [{label, value, unit}]
    color: Mapped[str] = mapped_column(String(20), default="#1d4ed8")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    section: Mapped[str] = mapped_column(String(160), default="")
    content: Mapped[str] = mapped_column(Text)
    mine_codes: Mapped[list] = mapped_column(JSON, default=list)  # mines this passage evidences
    financial_year: Mapped[str] = mapped_column(String(12), default="")
    topic: Mapped[str] = mapped_column(String(60), default="")
    metrics: Mapped[list] = mapped_column(JSON, default=list)  # metric keys this chunk evidences
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
    extraction_confidence: Mapped[float] = mapped_column(Float, default=95.0)
    document: Mapped["Document"] = relationship()


class AIQuery(Base):
    __tablename__ = "ai_queries"
    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(40))
    grounded: Mapped[bool] = mapped_column(Boolean, default=True)
    user: Mapped[str] = mapped_column(String(120))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    feedback: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AISource(Base):
    __tablename__ = "ai_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    query_id: Mapped[int] = mapped_column(ForeignKey("ai_queries.id"), index=True)
    chunk_id: Mapped[int] = mapped_column(ForeignKey("knowledge_chunks.id"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    page_number: Mapped[int] = mapped_column(Integer)
    relevance: Mapped[float] = mapped_column(Float)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_no: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(255))
    report_type: Mapped[str] = mapped_column(String(80))
    scope: Mapped[str] = mapped_column(String(120))
    financial_year: Mapped[str] = mapped_column(String(12))
    date_range: Mapped[str] = mapped_column(String(80), default="")
    sections: Mapped[list] = mapped_column(JSON, default=list)
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft | Approved
    generated_by: Mapped[str] = mapped_column(String(120))
    approved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    user: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(60), default="")
    action: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(40))  # upload | processing | validation | ai | report | auth | system
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    document_label: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(160), default="")
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class SystemMeta(Base):
    """Key/value store for seed baselines and demo settings."""
    __tablename__ = "system_meta"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
