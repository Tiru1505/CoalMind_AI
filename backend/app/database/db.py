"""Database engine and session management.

SQLite is used for the prototype. Set DATABASE_URL to a PostgreSQL URL
(e.g. postgresql+psycopg://user:pass@host/coalmind) to switch engines;
the models are engine-agnostic. pgvector can then replace the JSON
embedding column used by the in-process vector search.
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB = f"sqlite:///{(BASE_DIR / 'coalmind.db').as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
