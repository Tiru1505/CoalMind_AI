"""Request schemas (input validation)."""
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    employee_id: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class ApproveRequest(BaseModel):
    comment: str = Field(default="", max_length=300)


class EditRequest(BaseModel):
    value: str = Field(min_length=1, max_length=120)
    reason: str = Field(default="", max_length=300)


class RejectRequest(BaseModel):
    reason: str = Field(default="", max_length=300)


class QueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class FeedbackRequest(BaseModel):
    feedback: str = Field(pattern="^(up|down)$")


class ReportRequest(BaseModel):
    report_type: str = Field(max_length=80)
    scope: str = Field(default="GEV", max_length=40)
    financial_year: str = Field(default="2024-25", max_length=12)
    date_range: str = Field(default="", max_length=80)
    month: str = Field(default="March", max_length=20)
    sections: list[str] = Field(default_factory=list, max_length=10)
    query_text: str = Field(default="", max_length=300)
