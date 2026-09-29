"""Authentication: mobile number + one-time password, with the role chosen on the login page.

Flow
  1. POST /api/auth/otp/request {mobile, role}
       - existing number: the selected role must match the registered role
       - new number: a new account with the selected role will be created on verification
  2. POST /api/auth/otp/verify {mobile, role, otp, name?}
       - returns a session token and the role's dashboard path
New accounts get their own workspace (dataset + history).
Demo mode: no SMS gateway is configured, so the OTP is returned for on-screen display.
"""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import OTPChallenge, User
from app.schemas.schemas import LoginRequest, OTPRequest, OTPVerify
from app.services import audit_service
from app.utils.security import (OTP_COOLDOWN, OTP_MAX_ATTEMPTS, OTP_TTL, OTP_WINDOW_LIMIT, ROLE_DESIGNATION, SHOW_DEMO_OTP, TOKEN_TTL,
                                current_user, hash_password, make_token, mask_mobile, new_otp, normalize_mobile, otp_hash, read_payload,
                                sign_payload, user_dict)

router = APIRouter(prefix="/api/auth", tags=["auth"])
ROLE_NAMES = {"admin": "Administrator", "geological_officer": "Geological Officer", "management": "Management", "viewer": "Viewer"}


def _check_role(user: User | None, role: str) -> None:
    if role not in ROLE_NAMES:
        raise HTTPException(422, "Please select a valid role.")
    if user is not None and user.role != role:
        raise HTTPException(409, f"This mobile number is registered as {ROLE_NAMES[user.role]}. Please select the {ROLE_NAMES[user.role]} role.")
    if user is not None and not user.active:
        raise HTTPException(403, "This account is disabled. Contact your administrator.")


@router.post("/otp/request")
def request_otp(body: OTPRequest, db: Session = Depends(get_db)):
    mobile = normalize_mobile(body.mobile)
    if not mobile:
        raise HTTPException(422, "Enter a valid 10-digit Indian mobile number (starting with 6–9).")
    user = db.query(User).filter_by(mobile=mobile).first()
    _check_role(user, body.role)
    now = datetime.utcnow()
    recent = db.query(OTPChallenge).filter(OTPChallenge.mobile == mobile, OTPChallenge.created_at > now - timedelta(minutes=10)) \
        .order_by(OTPChallenge.created_at.desc()).all()
    if recent and (now - recent[0].created_at).total_seconds() < OTP_COOLDOWN:
        wait = OTP_COOLDOWN - int((now - recent[0].created_at).total_seconds())
        raise HTTPException(429, f"Please wait {wait} seconds before requesting a new OTP.")
    if len(recent) >= OTP_WINDOW_LIMIT:
        raise HTTPException(429, "Too many OTP requests. Please try again in 10 minutes.")
    for old in recent:
        old.consumed = True  # only the latest OTP is valid
    code = new_otp()
    db.add(OTPChallenge(mobile=mobile, role=body.role, code_hash=otp_hash(mobile, code), expires_at=now + timedelta(seconds=OTP_TTL)))
    db.commit()
    # signed challenge: lets verification succeed on a different serverless instance (holds only the HMAC of the code)
    challenge = sign_payload({"mob": mobile, "role": body.role, "h": otp_hash(mobile, code)}, OTP_TTL)
    out = {"sent": True, "challenge": challenge, "mobile": mask_mobile(mobile), "is_new_user": user is None, "expires_in": OTP_TTL,
           "resend_in": OTP_COOLDOWN, "name": user.name if user else None}
    if SHOW_DEMO_OTP:
        out["demo_otp"] = code  # demo only — would be delivered by SMS in production
    return out


@router.post("/otp/verify")
def verify_otp(body: OTPVerify, db: Session = Depends(get_db)):
    mobile = normalize_mobile(body.mobile)
    if not mobile:
        raise HTTPException(422, "Invalid mobile number.")
    user = db.query(User).filter_by(mobile=mobile).first()
    _check_role(user, body.role)
    ch = db.query(OTPChallenge).filter_by(mobile=mobile, consumed=False).order_by(OTPChallenge.created_at.desc()).first()
    signed = read_payload(body.challenge) if body.challenge else None
    if signed is not None and (signed.get("mob") != mobile or signed.get("role") != body.role):
        signed = None
    if ch is None and signed is None:
        raise HTTPException(400, "No active OTP (or it expired). Please request a new one.")
    if ch is not None:
        if ch.role != body.role:
            raise HTTPException(400, "The OTP was issued for a different role. Please request a new OTP.")
        if ch.expires_at < datetime.utcnow():
            ch.consumed = True
            db.commit()
            raise HTTPException(400, "OTP expired. Please request a new one.")
        if ch.attempts >= OTP_MAX_ATTEMPTS:
            ch.consumed = True
            db.commit()
            raise HTTPException(429, "Too many incorrect attempts. Please request a new OTP.")
    expected = ch.code_hash if ch is not None else signed["h"]
    if not secrets.compare_digest(expected, otp_hash(mobile, body.otp.strip())):
        if ch is None:
            raise HTTPException(401, "Incorrect OTP. Please try again.")
        ch.attempts += 1
        left = OTP_MAX_ATTEMPTS - ch.attempts
        audit_service.log(db, user=mask_mobile(mobile), role=body.role, action="Failed OTP verification", category="auth", status="Rejected",
                          source="Mobile OTP", owner_id=user.id if user else None, details={"attempts_left": left})
        db.commit()
        raise HTTPException(401, f"Incorrect OTP. {left} attempt{'s' if left != 1 else ''} left.")
    if ch is not None:
        ch.consumed = True

    created = False
    if user is None:
        name = (body.name or "").strip()
        if len(name) < 2:
            raise HTTPException(422, "Please enter your full name to create your account.")
        emp = f"CM{secrets.randbelow(900000) + 100000}"
        while db.query(User).filter_by(employee_id=emp).first():
            emp = f"CM{secrets.randbelow(900000) + 100000}"
        user = User(employee_id=emp, mobile=mobile, password=hash_password(secrets.token_hex(16)), name=name[:80], role=body.role,
                    designation=ROLE_DESIGNATION[body.role], department=(body.department or "CMPDI").strip()[:120] or "CMPDI", email="")
        db.add(user)
        db.flush()
        created = True
    user.last_login = datetime.utcnow()
    db.commit()
    if created:
        from app.database.seed import provision_workspace  # local import avoids a circular dependency
        provision_workspace(db, user, with_history=False)
        audit_service.log(db, owner_id=user.id, user=user.name, role=user.role, action="Account created via mobile OTP", category="auth",
                          status="Success", source=mask_mobile(mobile), details={"role": ROLE_NAMES[user.role]})
    audit_service.log(db, owner_id=user.id, user=user.name, role=user.role, action="Signed in", category="auth", status="Success",
                      source=f"Mobile OTP · {mask_mobile(mobile)}", commit=True)
    ud = user_dict(user)
    return {"token": make_token(user), "expires_in": TOKEN_TTL, "user": ud, "created": created, "redirect": ud["dashboard"]}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Legacy Employee-ID login (kept for API clients and the smoke test)."""
    user = db.query(User).filter(User.employee_id == body.employee_id.strip().upper()).first()
    if user is None or user.password != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password.")
    user.last_login = datetime.utcnow()
    audit_service.log(db, owner_id=user.id, user=user.name, role=user.role, action="Signed in", category="auth", status="Success",
                      source=f"Employee ID {user.employee_id}", commit=True)
    return {"token": make_token(user), "expires_in": TOKEN_TTL, "user": user_dict(user)}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user


@router.post("/logout")
def logout(user: dict = Depends(current_user), db: Session = Depends(get_db)):
    audit_service.for_user(db, user, action="Signed out", category="auth", status="Success", commit=True)
    return {"ok": True}


@router.get("/demo-accounts")
def demo_accounts(db: Session = Depends(get_db)):
    """Demo build only: seeded mobile numbers per role, shown on the login page."""
    from app.database.seed import DEMO_MOBILES
    users = db.query(User).filter(User.mobile.in_(list(DEMO_MOBILES.values()))).order_by(User.id).all()
    return [{"mobile": u.mobile, "name": u.name, "role": u.role, "designation": u.designation} for u in users]
