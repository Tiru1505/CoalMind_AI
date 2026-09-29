"""CoalMind AI — FastAPI application entry point.

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, ai, analytics, audit, auth, consistency, dashboard, documents, knowledge, reports, system, topics, validation
from app.database.seed import ensure_seeded


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_seeded()
    yield


app = FastAPI(
    title="CoalMind AI API",
    description="Intelligent Geological & Mining Reporting Platform — SIH 2026 prototype (PS 26023, Team Tubelights).",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal error while processing the request. The event has been logged."})


for r in (auth, dashboard, documents, validation, knowledge, ai, topics, reports, analytics, audit, system, consistency, admin):
    app.include_router(r.router)
