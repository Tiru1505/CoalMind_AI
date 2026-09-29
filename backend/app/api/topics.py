from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Topic
from app.services import topic_service
from app.utils.security import current_user

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("")
def list_topics(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    topics = db.query(Topic).order_by(Topic.document_count.desc()).all()
    years = sorted({y for t in topics for y in t.yearly})
    return {
        "topics": [topic_service.topic_to_dict(db, t, user["id"]) for t in topics],
        "trend": [{"year": y, **{t.name: t.yearly.get(y, 0) for t in topics}} for y in years],
        "keywords": topic_service.keyword_cloud(db, user["id"]),
        "model": topic_service.MODEL_INFO,
    }


@router.get("/{topic_id}")
def get_topic(topic_id: str, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    t = db.query(Topic).filter((Topic.slug == topic_id) | (Topic.id == (int(topic_id) if topic_id.isdigit() else -1))).first()
    if t is None:
        raise HTTPException(404, "Topic not found")
    return topic_service.topic_to_dict(db, t, user["id"], detail=True)
