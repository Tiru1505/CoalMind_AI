from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.schemas import ResolveRequest
from app.services import consistency_service
from app.utils.security import current_user, require

router = APIRouter(prefix="/api/consistency", tags=["consistency"])


@router.get("")
def overview(db: Session = Depends(get_db), user: dict = Depends(current_user)):
    return consistency_service.scan(db, user["id"])


@router.get("/figure")
def figure(key: str, db: Session = Depends(get_db), user: dict = Depends(current_user)):
    try:
        mine, fy, metric = key.split("|")
    except ValueError:
        raise HTTPException(422, "Invalid figure key")
    result = consistency_service.check(db, user["id"], mine, fy, metric)
    if result is None:
        raise HTTPException(404, "No document in your workspace states this figure")
    return result


@router.post("/resolve")
def resolve(body: ResolveRequest, db: Session = Depends(get_db), user: dict = Depends(require("resolve_conflicts"))):
    try:
        return consistency_service.resolve(db, user["id"], user, body.key, body.value, body.reason, body.document_id)
    except consistency_service.ConsistencyError as e:
        raise HTTPException(422, str(e))
