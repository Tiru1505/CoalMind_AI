from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.serializers import iso
from app.database.db import get_db
from app.models.models import AIQuery, AISource
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
    "What was the overburden removal of Kusmunda OC Mine in FY 2024-25?",
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
def history(limit: int = 30, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    """The signed-in user's own question history."""
    rows = db.query(AIQuery).filter_by(owner_id=user["id"]).order_by(AIQuery.created_at.desc()).limit(min(limit, 100)).all()
    return [{"id": r.id, "question": r.question, "grounded": r.grounded, "intent": r.intent, "feedback": r.feedback,
             "created_at": iso(r.created_at), "sources": db.query(AISource).filter_by(query_id=r.id).count()} for r in rows]


@router.get("/history/{query_id}")
def history_item(query_id: int, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    q = db.get(AIQuery, query_id)
    if q is None or q.owner_id != user["id"]:
        raise HTTPException(404, "Query not found")
    return q.payload or {"id": q.id, "question": q.question, "answer": q.answer, "grounded": q.grounded, "sources": [], "sources_count": 0}


@router.post("/{query_id}/feedback")
def feedback(query_id: int, body: FeedbackRequest, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    q = db.get(AIQuery, query_id)
    if q is None or q.owner_id != user["id"]:
        raise HTTPException(404, "Query not found")
    q.feedback = body.feedback
    audit_service.for_user(db, user, action=f"AI answer marked {'helpful' if body.feedback == 'up' else 'not helpful'}",
                           category="ai", status="Feedback", document_label=q.question[:200], source=f"Query #{q.id}", commit=True)
    return {"ok": True}
