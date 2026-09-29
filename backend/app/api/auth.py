from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import User
from app.schemas.schemas import LoginRequest
from app.services import audit_service
from app.utils.security import current_user, hash_password, make_token, user_dict, TOKEN_TTL

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == body.employee_id.strip().upper()).first()
    if user is None or user.password != hash_password(body.password):
        audit_service.log(db, user=body.employee_id.strip().upper()[:32], role="", action="Failed sign-in attempt", category="auth",
                          status="Rejected", source="Invalid credentials", commit=True)
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password.")
    user.last_login = datetime.utcnow()
    audit_service.log(db, user=user.name, role=user.role, action="Signed in", category="auth", status="Success",
                      source=f"Employee ID {user.employee_id}", commit=True)
    return {"token": make_token(user.id), "expires_in": TOKEN_TTL, "user": user_dict(user)}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user


@router.post("/logout")
def logout(user: dict = Depends(current_user), db: Session = Depends(get_db)):
    audit_service.log(db, user=user["name"], role=user["role"], action="Signed out", category="auth", status="Success", commit=True)
    return {"ok": True}


@router.get("/demo-accounts")
def demo_accounts(db: Session = Depends(get_db)):
    """Only exposed because this is a demo build (role switching for the jury)."""
    pw = {"ADMIN001": "admin123"}
    return [{"employee_id": u.employee_id, "password": pw.get(u.employee_id, "demo123"), "name": u.name, "role": u.role,
             "designation": u.designation} for u in db.query(User).order_by(User.id).all()]
