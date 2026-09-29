from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.serializers import iso
from app.database.db import get_db
from app.models.models import AIQuery, AISource, Document
from app.schemas.schemas import FeedbackRequest, QueryRequest
from app.services import audit_service, rag_service
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/ai", tags=["ai"])

SUGGESTIONS = [
    "What was the production of Gevra OC Mine in FY 2024-25?",
    "Which mines exceeded their production targets?",
    "What was the land reclamation progress in 2025?",
    "Show the trend of coal production over the last 5 years.",
    "Prepare a summary of Kusmunda mine.",
    "Compare Gevra and Dipka in FY 2024-25",
    "What are the geological reserves of Gevra?",
    "गेवरा खदान का वित्त वर्ष 2024-25 में कोयला उत्पादन कितना था?",
]


@router.get("/suggestions")
def suggestions(user: dict = Depends(current_user)):
    return SUGGESTIONS


@router.post("/query")
def query(body: QueryRequest, db: Session = Depends(get_db), user: dict = Depends(require("query_ai"))):
    return rag_service.answer(db, body.question, user)


@router.get("/history")
def history(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    rows = db.query(AIQuery).order_by(AIQuery.created_at.desc()).limit(20).all()
    return [{"id": r.id, "question": r.question, "grounded": r.grounded, "intent": r.intent, "user": r.user,
             "created_at": iso(r.created_at), "sources": db.query(AISource).filter_by(query_id=r.id).count()} for r in rows]


@router.post("/{query_id}/feedback")
def feedback(query_id: int, body: FeedbackRequest, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    q = db.get(AIQuery, query_id)
    if q is None:
        raise HTTPException(404, "Query not found")
    q.feedback = body.feedback
    audit_service.log(db, user=user["name"], role=user["role"], action=f"AI answer marked {'helpful' if body.feedback == 'up' else 'not helpful'}",
                      category="ai", status="Feedback", document_label=q.question[:200], source=f"Query #{q.id}", commit=True)
    return {"ok": True}
