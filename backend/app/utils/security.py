"""Prototype session handling & role-based access control.

Stateless HMAC-signed tokens with expiry. This is intentionally simple and is
NOT a substitute for the organisation's SSO / LDAP integration, which would
replace `login` in a real deployment.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import User

SECRET = os.getenv("SECRET_KEY", "coalmind-demo-secret-change-me").encode()
TOKEN_TTL = int(os.getenv("SESSION_TTL_SECONDS", str(8 * 3600)))

PERMISSIONS = {
    "admin": {"manage_users", "view_all_audit", "upload", "process", "validate", "resolve_conflicts", "generate_reports",
              "approve_reports", "view_audit", "query_ai", "view_analytics", "export", "reset_demo"},
    "geological_officer": {"upload", "process", "validate", "resolve_conflicts", "query_ai", "generate_reports", "approve_reports",
                           "view_audit", "view_analytics", "export", "reset_demo"},
    "management": {"query_ai", "view_analytics", "export", "view_audit", "approve_reports", "resolve_conflicts", "reset_demo"},
    "viewer": {"reset_demo"},
}
ROLE_SLUG = {"geological_officer": "officer", "management": "management", "admin": "admin", "viewer": "viewer"}
ROLE_DESIGNATION = {"geological_officer": "Geological Officer", "management": "Manager", "admin": "System Administrator", "viewer": "Viewer"}

# ---- mobile OTP (demo: the OTP is displayed on screen because no SMS gateway is configured)
OTP_TTL = 300
OTP_MAX_ATTEMPTS = 5
OTP_COOLDOWN = 30
OTP_WINDOW_LIMIT = 5  # requests per 10 minutes per mobile
SHOW_DEMO_OTP = os.getenv("DEMO_SHOW_OTP", "1") == "1"


def normalize_mobile(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if re.fullmatch(r"[6-9]\d{9}", digits) else None


def mask_mobile(m: str | None) -> str:
    return f"+91 {m[:2]}•••••{m[-3:]}" if m else ""


def new_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def otp_hash(mobile: str, code: str) -> str:
    return hmac.new(SECRET, f"otp:{mobile}:{code}".encode(), hashlib.sha256).hexdigest()


def hash_password(pw: str) -> str:
    return hashlib.sha256(("cm$" + pw).encode()).hexdigest()


def sign_payload(data: dict, ttl: int) -> str:
    """Compact HMAC-signed token (payload is signed, not encrypted — never put secrets in it)."""
    body = base64.urlsafe_b64encode(json.dumps({**data, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()).decode()
    sig = hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()[:40]
    return f"{body}.{sig}"


def read_payload(token: str) -> dict | None:
    try:
        body, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(sig, hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()[:40]):
            return None
        data = json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:
        return None
    return data if data.get("exp", 0) >= time.time() else None


def make_token(user: User) -> str:
    # The session carries the user's identity so a fresh serverless instance can
    # re-create the account (and its workspace) if its local demo database was reset.
    return sign_payload({"uid": user.id, "mob": user.mobile, "emp": user.employee_id, "role": user.role,
                         "name": user.name, "dept": user.department}, TOKEN_TTL)


def _resolve_user(db: Session, data: dict) -> User | None:
    user = db.get(User, data.get("uid"))
    if user is not None and (user.mobile or None) == (data.get("mob") or None) and user.employee_id == data.get("emp"):
        return user
    if data.get("mob"):
        user = db.query(User).filter_by(mobile=data["mob"]).first()
    elif data.get("emp"):
        user = db.query(User).filter_by(employee_id=data["emp"]).first()
    if user is not None or not data.get("mob") or data.get("role") not in PERMISSIONS:
        return user
    # account not present on this instance (serverless cold start) — restore it with a fresh workspace
    from app.database.seed import provision_workspace
    user = User(employee_id=data.get("emp") or f"CM{secrets.randbelow(900000) + 100000}", mobile=data["mob"],
                password=hash_password(secrets.token_hex(16)), name=data.get("name") or "User", role=data["role"],
                designation=ROLE_DESIGNATION[data["role"]], department=data.get("dept") or "CMPDI", email="")
    db.add(user)
    db.flush()
    provision_workspace(db, user, with_history=False)
    return user


def user_dict(u: User) -> dict:
    return {"id": u.id, "employee_id": u.employee_id, "name": u.name, "role": u.role, "designation": u.designation,
            "department": u.department, "email": u.email, "mobile": mask_mobile(u.mobile),
            "dashboard": f"/dashboard/{ROLE_SLUG.get(u.role, 'viewer')}",
            "permissions": sorted(PERMISSIONS.get(u.role, set()))}


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    data = read_payload(token) if token else None
    user = _resolve_user(db, data) if data else None
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in again.")
    return user_dict(user)


def require(permission: str):
    def checker(user: dict = Depends(current_user)) -> dict:
        if permission not in PERMISSIONS.get(user["role"], set()):
            raise HTTPException(status_code=403, detail=f"Your role ({user['designation']}) does not permit this action.")
        return user
    return checker
