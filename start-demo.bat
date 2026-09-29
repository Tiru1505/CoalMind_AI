@echo off
REM CoalMind AI - one-click local demo (Windows)
cd /d %~dp0
if not exist backend\.venv (
  python -m venv backend\.venv
  backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
)
if not exist frontend\node_modules ( cd frontend && npm install && cd .. )
start "CoalMind API" cmd /k "cd backend && .venv\Scripts\python -m uvicorn app.main:app --port 8000"
start "CoalMind UI" cmd /k "cd frontend && npm run dev"
timeout /t 6 >nul
start http://localhost:5173
