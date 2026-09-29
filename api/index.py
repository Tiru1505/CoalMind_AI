"""Vercel serverless entry point: exposes the FastAPI backend under /api/*.

The backend package lives in ../backend; the demo database is (re)built on
cold start (SQLite in /tmp) unless DATABASE_URL / POSTGRES_URL is configured.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from app.database.seed import ensure_seeded  # noqa: E402
from app.main import app  # noqa: E402,F401  (Vercel serves this ASGI app)

ensure_seeded()  # serverless runtimes may not run ASGI lifespan events
