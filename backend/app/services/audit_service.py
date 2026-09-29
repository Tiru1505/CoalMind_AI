"""Audit trail helper. Every material action goes through `log()`.

`owner_id` scopes the entry to a user's workspace (their own history).
When omitted it is inherited from the document the action concerns.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import AuditLog

ROLE_LABELS = {
    "admin": "Administrator",
    "geological_officer": "Geological Officer",
    "management": "Management",
    "viewer": "Viewer",
    "system": "System",
}


def log(db: Session, *, user: str, role: str, action: str, category: str, status: str,
        document=None, document_label: str = "", source: str = "", details: dict | None = None,
        timestamp: datetime | None = None, commit: bool = False, owner_id: int | None = None) -> AuditLog:
    if owner_id is None and document is not None:
        owner_id = document.owner_id
    entry = AuditLog(
        timestamp=timestamp or datetime.utcnow(), owner_id=owner_id, user=user, role=ROLE_LABELS.get(role, role), action=action,
        category=category, status=status, document_id=document.id if document is not None else None,
        document_label=document_label or (document.title if document is not None else ""), source=source,
        details=details or {},
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry


def for_user(db: Session, user: dict, **kw) -> AuditLog:
    """Log an action performed by the signed-in user in their own workspace."""
    return log(db, user=user["name"], role=user["role"], owner_id=user["id"], **kw)


def system(db: Session, **kw) -> AuditLog:
    return log(db, user="AI Processing Engine", role="system", **kw)
