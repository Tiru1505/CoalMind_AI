#!/usr/bin/env bash
# CoalMind AI - local demo (macOS / Linux)
set -e
cd "$(dirname "$0")"
[ -d backend/.venv ] || { python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt; }
[ -d frontend/node_modules ] || (cd frontend && npm install)
(cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000) &
(cd frontend && npm run dev) &
wait
