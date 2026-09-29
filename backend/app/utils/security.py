"""Prototype session handling & role-based access control.

Stateless HMAC-signed tokens with expiry. This is intentionally simple and is
NOT a substitute for the organisation's SSO / LDAP integration, which would
replace `login` in a real deployment.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import User

SECRET = os.getenv("SECRET_KEY", "coalmind-demo-secret-change-me").encode()
TOKEN_TTL = int(os.getenv("SESSION_TTL_SECONDS", str(8 * 3600)))

PERMISSIONS = {
    "admin": {"manage_users", "upload", "process", "validate", "generate_reports", "approve_reports", "view_audit", "query_ai", "view_analytics", "export", "reset_demo"},
    "geological_officer": {"upload", "process", "validate", "query_ai", "generate_reports", "approve_reports", "view_audit", "view_analytics", "export", "reset_demo"},
    "management": {"query_ai", "view_analytics", "export", "view_audit", "approve_reports"},
    "viewer": set(),
}


def hash_password(pw: str) -> str:
    return hashlib.sha256(("cm$" + pw).encode()).hexdigest()


def make_token(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time()) + TOKEN_TTL}"
    sig = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode()


def read_token(token: str) -> int | None:
    try:
        uid, exp, sig = base64.urlsafe_b64decode(token.encode()).decode().split(":")
    except Exception:
        return None
    expected = hmac.new(SECRET, f"{uid}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected) or int(exp) < time.time():
        return None
    return int(uid)


def user_dict(u: User) -> dict:
    return {"id": u.id, "employee_id": u.employee_id, "name": u.name, "role": u.role, "designation": u.designation,
            "department": u.department, "email": u.email, "permissions": sorted(PERMISSIONS.get(u.role, set()))}


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    uid = read_token(token) if token else None
    user = db.get(User, uid) if uid else None
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in again.")
    return user_dict(user)


def require(permission: str):
    def checker(user: dict = Depends(current_user)) -> dict:
        if permission not in PERMISSIONS.get(user["role"], set()):
            raise HTTPException(status_code=403, detail=f"Your role ({user['designation']}) does not permit this action.")
        return user
    return checker
