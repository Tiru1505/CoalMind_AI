"""Database engine and session management.

SQLite is used for the prototype. Set DATABASE_URL (or POSTGRES_URL, as
provided by Vercel/Neon integrations) to a PostgreSQL URL to switch engines;
the models are engine-agnostic. pgvector can then replace the JSON embedding
column used by the in-process vector search.

On serverless hosts (VERCEL=1) the code directory is read-only, so the
SQLite demo database lives in /tmp and is rebuilt on each cold start.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[2]
SERVERLESS = bool(os.getenv("VERCEL"))
WRITABLE_DIR = Path("/tmp/coalmind") if SERVERLESS else BASE_DIR
WRITABLE_DIR.mkdir(parents=True, exist_ok=True)


def _database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or ""
    if not url:
        return f"sqlite:///{(WRITABLE_DIR / 'coalmind.db').as_posix()}"
    # hosted Postgres URLs come without a driver; use psycopg 3
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _database_url()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
