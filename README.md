# CoalMind AI — Intelligent Geological & Mining Reporting Platform

**Smart India Hackathon 2026 · Problem Statement 26023 · Theme: Smart Automation · Category: Software · Team Tubelights**

> AI-Powered Geological, Mining and other Reporting Solution for CMPDI / CIL subsidiaries.

CoalMind AI turns scattered geological, mining and production records (scanned PDFs, Excel MIS, Word files, images, Hindi & English) into **validated, structured, searchable and source-grounded knowledge** — and uses it to answer questions and generate reports that can be traced back to the page they came from.

```
Documents → OCR/Extraction → Validation (human-in-the-loop) → Structured Data → Knowledge Base → RAG → AI Answers → Reports & Insights
```

> ⚠️ **All figures in this prototype are sample/demonstration data.** They are realistic in scale but are **not** official CIL, SECL or CMPDI statistics.

---

## 1. Project overview

| Intelligence layer | What it does in the prototype |
|---|---|
| **Reporting** | Report Studio assembles Annual / Monthly / Geological / Land-Reclamation / Management / Parliamentary / Ministry reports from verified records only, with section-level citations, validation checks, draft watermark and officer approval. |
| **Topic Intelligence** | Topics, keyword landscape (word cloud), topic trends over time and topic drill-downs with extracted statistics, related mines and recent documents. |
| **AI Query** | Natural-language questions (English & Hindi) answered from verified data with source cards (document, page, relevance, extraction confidence, validation status) and a *View Source* page viewer. Refuses to answer when no verified source exists. |

Cross-cutting differentiators, visible throughout the UI:

1. **Source-grounded AI** — every answer and report section links to document + page.
2. **Human-in-the-loop** — values below 80 % confidence are held back until an officer approves / edits / rejects them.
3. **Three intelligence layers** — Reporting, Topic Intelligence, AI Query.
4. **Historical knowledge utilisation** — old reports (FY 2021-22 onwards, bilingual scans) are searchable.
5. **Traceability** — audit trail with original OCR value → AI value → human-corrected value, model, confidence and source page.

## 2. Features

- Mock login with 4 roles and **live role switching** (Admin, Geological Officer, Management, Viewer) — enforced on the API *and* in the UI.
- Dashboard: 6 KPIs, production trend (production / target / achievement), mine-wise production, document-processing donut, recent activity, "document awaiting processing" call-out.
- Document Intelligence: drag-and-drop upload (PDF, DOCX, XLSX, JPG, PNG) with **real file validation** (extension allow-list, magic-byte signature check, 25 MB limit, filename sanitisation), document library with filters.
- Animated 7-stage processing pipeline (Upload → Pre-processing → OCR → Tables → Entities → Validation → Indexing), failure path (low-DPI scan) and re-processing.
- Extraction & Validation: paper-style document preview with highlighted extracted values (colour = review state), per-field confidence, warnings, OCR original vs AI value, **Approve / Edit / Reject**, data-normalisation panel (`52,400,000 tonnes → 52.4 MT`, `FY 24-25 → FY 2024-25`, `M.Cum → Mm³`).
- Approved values are written back to structured tables and the related knowledge chunks become *verified* — only then does AI Query use them.
- Knowledge Base: headline stats, hybrid semantic search with relevance, mine/FY interpretation, verified-only filter, source viewer.
- AI Query: chat with suggested questions, grounded answers, facts, tables, inline trend chart, 3 source cards, trust banner, "how this answer was produced" explainer, feedback, Hindi query support.
- Topic Intelligence: 6 topic cards, word cloud, topic frequency chart with focus, topic detail pages.
- Report Studio: 7 report types, scope/FY/month/sections, generation steps animation, professional preview, citations → source viewer, validation checks, **Approve for official use**, Print / Save as PDF, HTML download.
- Analytics: filters (subsidiary, mine, FY, report type), production, target vs achievement, overburden + stripping ratio, land reclamation, manpower + OMS, safety, forecast, mine comparison; **Export CSV / Excel (.xlsx) / PDF**.
- Audit & Traceability: filterable log, detail modal with value lineage, write-back record and document history, CSV export.
- Settings: profile, organisation, security controls, users & role permissions, AI configuration (target stack vs demo runtime), data sources, preferences, on-premise system information.
- Global search (Ctrl/⌘ + K) with suggestions, notification centre, **Load Demo Scenario** reset, loading / empty / error states everywhere, responsive down to phone width.

## 3. Architecture

```
                ┌──────────────────────── React + Vite + TypeScript + Tailwind + Recharts ────────────────────────┐
                │ Dashboard · Documents · Validation · Knowledge · AI Query · Topics · Reports · Analytics · Audit │
                └───────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                                │ /api (JSON, Bearer token)
┌───────────────────────────────────────────────────────────────▼──────────────────────────────────────────────────────┐
│ FastAPI                                                                                                              │
│  api/  auth · dashboard · documents · validation · knowledge · ai · topics · reports · analytics · audit · system    │
│  services/                                                                                                           │
│   ocr_service ──► document_processor ──► validation_service ──► (production_records write-back)                     │
│        │               │  content_builder (demo OCR output)                                                         │
│        │               └──► embedding_service ──► knowledge_chunks (vectors)                                         │
│   rag_service: query understanding → structured lookup → vector_search (verified only) → llm_service → citations    │
│   topic_service · report_service · audit_service                                                                     │
└───────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                                                │ SQLAlchemy
                                          SQLite (demo)  /  PostgreSQL + pgvector (production)
```

**Document pipeline:** Upload → file validation → parsing → pre-processing → OCR → layout / table detection → entity extraction → normalisation → confidence-based validation routing → database → vector index → analytics.

**RAG pipeline:** Document → chunking → embedding → vector search (+ metadata filters: mine, FY, metric) → relevant verified chunks → LLM (grounded draft) → answer → citations.

## 4. Technology stack

| Layer | Prototype | Production target |
|---|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, Recharts, Lucide icons, React Router | same |
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2, Pydantic 2 | same |
| Database | SQLite | PostgreSQL + **pgvector** |
| OCR | Simulated (real file validation & structure parsing) | **PaddleOCR** (Hindi + English), **Tesseract** fallback |
| Document understanding | Simulated | **LayoutLMv3**, **Table Transformer** |
| Embeddings | Deterministic hashed bag-of-words (384-d, offline) | **Sentence-BERT** (multilingual MiniLM) |
| LLM | Grounded template composer (offline) | Open-weight LLM (Llama 3.1 / Mistral / Qwen) via Ollama / vLLM, on-premise |
| Topic modelling | Curated taxonomy + live keyword weighting | **BERTopic** |

No paid API, API key or internet connection is required to run the demo.

## 5. Folder structure

```
CoalMind-AI/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (auth, documents, validation, ai, reports, …)
│   │   ├── database/       # engine/session, demo_data.py (sample dataset), seed.py
│   │   ├── models/         # SQLAlchemy models (users … audit_logs)
│   │   ├── schemas/        # Pydantic request schemas
│   │   ├── services/       # ocr, document_processor, validation, embedding, vector_search,
│   │   │                   # rag, llm, topic, report, audit, content_builder
│   │   ├── utils/          # security (tokens, RBAC), exporters (CSV/XLSX)
│   │   └── main.py
│   ├── scripts/            # seed_demo_data.py, make_sample_documents.py, smoke_test.py
│   ├── storage/uploads/    # uploaded files (demo)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Sidebar, Topbar, KpiCard, ChartCard, StatusBadge, DocumentTable, DocumentUpload,
│   │   │                   # ProcessingPipeline, ExtractionField, ConfidenceBadge, DocumentPreview, SourceCitation,
│   │   │                   # SourceViewer, AIChat, MessageBubble, TopicComponents, ReportPreview, AuditTable,
│   │   │                   # SearchBar, FilterDropdown, Modal, States (Loading/Empty/Error)
│   │   ├── context/        # AuthContext, ToastContext
│   │   ├── hooks/          # useApi, useDebounce
│   │   ├── layouts/        # AppLayout
│   │   ├── pages/          # one file per screen
│   │   ├── services/api.ts # typed API client
│   │   ├── types/          # shared TypeScript types
│   │   └── utils/          # formatting, chart styles
│   ├── Dockerfile · nginx.conf
├── sample_documents/       # files for the live upload demo (valid + intentionally invalid)
├── docker-compose.yml
├── .env.example
├── start-demo.bat / start-demo.sh
└── README.md
```

## 6. Setup instructions

Prerequisites: **Python 3.10+** and **Node.js 18+** (tested with Python 3.10 and Node 20).

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m scripts.seed_demo_data         # optional: the DB is auto-seeded on first start
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 (Vite proxies `/api` to port 8000).

### One-click (Windows)
Double-click `start-demo.bat` — it creates the venv, installs dependencies, starts both servers and opens the browser.

### Docker
```bash
docker compose up --build            # UI on http://localhost:8080, API on :8000
docker compose --profile llm up      # additionally starts a local Ollama server
```

## 7. Environment variables

See `.env.example`. All are optional for the demo.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | SQLite file `backend/coalmind.db` | Switch to PostgreSQL |
| `SECRET_KEY` | demo value | Signs session tokens — change for any shared deployment |
| `SESSION_TTL_SECONDS` | 28800 | Session expiry (8 h) |
| `CORS_ORIGINS` | localhost:5173 | Allowed browser origins |
| `LLM_PROVIDER` | `mock` | `openai_compatible` to use a local LLM server |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT` | Ollama defaults | LLM endpoint |
| `EMBEDDING_BACKEND` | `hashing` | `sbert` to use Sentence-BERT |
| `VITE_API_TARGET` | `http://127.0.0.1:8000` | Dev-server proxy target |

## 8. Demo credentials

| Role | Employee ID | Password | Can |
|---|---|---|---|
| **Geological Officer** (main demo) | `CMPDI001` | `demo123` | upload, process, validate, query AI, generate & approve reports, audit |
| Administrator | `ADMIN001` | `admin123` | everything incl. user management |
| Management | `MGMT001` | `demo123` | dashboards, analytics, reports, AI query, audit |
| Viewer | `VIEW001` | `demo123` | search, view dashboards and reports |

Credentials are shown as clickable cards on the login page; roles can be switched live from the user menu.

## 9. API documentation

Interactive OpenAPI docs at **`/docs`**. Main endpoints:

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in (returns token + user + permissions) |
| GET | `/api/dashboard` | KPIs, charts, recent activity |
| GET | `/api/documents` | Document library (filters: `q`, `status`, `file_type`) |
| POST | `/api/documents/upload` | Multipart upload with file validation |
| GET | `/api/documents/{id}` | Document detail, pipeline log, field summary |
| POST | `/api/documents/{id}/process` | Run the processing pipeline |
| GET | `/api/documents/{id}/extraction` | Fields, pages, normalisation |
| GET | `/api/documents/{id}/pages/{n}` | One page (source viewer) |
| GET | `/api/validation/queue` | Pending fields, stats, recent decisions |
| POST | `/api/validation/{field_id}/approve` · `/edit` · `/reject` | Human-in-the-loop decisions |
| GET | `/api/knowledge/stats` · `/api/knowledge/search?q=` | Knowledge base |
| POST | `/api/ai/query` | Grounded answer + sources + trust metadata |
| GET | `/api/topics` · `/api/topics/{slug}` | Topic intelligence |
| GET | `/api/reports/options` · `/api/reports` · `/api/reports/{id}` | Report Studio |
| POST | `/api/reports/generate` · `/api/reports/{id}/approve` | Generate / approve |
| GET | `/api/reports/{id}/download` | HTML report |
| GET | `/api/analytics` · `/api/analytics/export?format=csv\|xlsx` | Analytics & export |
| GET | `/api/audit-logs` · `/api/audit-logs/{id}` | Audit trail |
| GET | `/api/search?q=` · `/api/notifications` · `/api/system/info` | Global search, notifications, system info |
| POST | `/api/demo/reset` | Load Demo Scenario |

## 10. Database

Tables: `users`, `mines`, `production_records`, `geological_records`, `documents`, `document_pages`, `extracted_fields`, `validation_records`, `knowledge_chunks`, `topics`, `ai_queries`, `ai_sources`, `reports`, `audit_logs`, `system_meta`.

- The database is created and seeded automatically on first start.
- `python -m scripts.seed_demo_data` (or **Load Demo Scenario** in the UI) resets it.
- Dashboard / knowledge-base headline totals represent the organisation-wide archive (e.g. 1,248 documents); the demo library holds 17 individually indexed documents. Live actions increment the totals.

## 11. Demo workflow (5–10 minutes)

1. Sign in as **CMPDI001 / demo123** → Dashboard (KPIs, charts, *new document awaiting processing*).
2. **Documents** → open *Gevra OCP Production Report FY 2024-25* → **Process Document** → watch the 7-stage pipeline; stage 6 reports ⚠ *3 fields require review*.
3. **Review low-confidence fields** → extraction screen scrolls to *Land Reclaimed — 142 ha — 72 %* with the warning *Possible OCR ambiguity detected*. Show the OCR original `1 42 ha*` vs AI value, the normalisation panel and the highlighted page.
4. **Edit** → enter the value → **Save correction** → **Approve** → *Validated ✓*. Approve the other two (dispatch, safety) → document becomes *Approved* and is published to the knowledge base.
5. **Knowledge Base** → search *Gevra* → results with relevance, FY, mine and source.
6. **AI Query** → *What was the production of Gevra OC Mine in FY 2024-25?* → answer "…approximately 52.4 MT … against a target of 55.0 MT, achieving approximately 95.3%…" with 3 sources (Gevra report p.23, Annual Production Summary p.8, CIL Production MIS p.12) → **View Source** (cited row highlighted).
   Also try: *Which mines exceeded their production targets?*, *Show the trend of coal production over the last 5 years*, the Hindi question, and an unsupported one such as *What is the price of coal in Japan?* (→ *No verified source found*).
7. **Topic Intelligence** → topic cards, word cloud, trends → open *Land Reclamation*.
8. **Report Studio** → Annual Mining Report · Gevra OC · FY 2024-25 → **Generate Report** → preview with draft disclaimer, citations and validation checks → **Approve for official use** / **Print / Save PDF**.
9. **Analytics** → filters, charts, **Export Excel**.
10. **Audit Logs** → every step above is listed; open *Approved … Land Reclaimed* to show original → AI → human value, model, confidence and source page.

Tip: `sample_documents/` contains files for a live upload (valid PDFs / XLSX) plus `Gevra_Site_Notes.txt` and `Fake_Report_FY2024-25.pdf` to demonstrate upload rejection.

## 12. Future AI integration

The code is structured so each simulated component can be swapped without touching the API or UI:

| Replace | Where | How |
|---|---|---|
| OCR | `services/ocr_service.py`, `document_processor.process()` | Call PaddleOCR (`lang='hi'`/`'en'`) per page; Tesseract `hin+eng` fallback; output the same `pages[{page_number, blocks, ocr_confidence}]` structure instead of `content_builder`. |
| Layout / tables | `document_processor` | LayoutLMv3 for block types, Table Transformer for table cells → `blocks`. |
| Entity extraction | `document_processor` / new `entity_service.py` | NER / key-value model emitting `fields[{label, original_text, ai_value, unit, confidence, page_number, anchor}]`. |
| Embeddings | `services/embedding_service.py` | `EMBEDDING_BACKEND=sbert` (already wired; install `sentence-transformers`). |
| Vector DB | `services/vector_search.py` | Replace the JSON column with a `pgvector` column and an `ORDER BY embedding <=> :q` query; keep the metadata boosts. |
| LLM | `services/llm_service.py` | `LLM_PROVIDER=openai_compatible` + `LLM_BASE_URL` (Ollama/vLLM). The LLM only rewrites a grounded draft built from verified facts, and the service falls back to the draft on failure. |
| Topics | `services/topic_service.py` | Fit BERTopic on chunk embeddings nightly; use `topics_over_time()` for the trend chart. |

### Connecting a real LLM (example with Ollama, fully on-premise)
```bash
ollama pull llama3.1:8b-instruct
# backend/.env or shell
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1:8b-instruct
uvicorn app.main:app --port 8000
```
Settings → AI Configuration shows the active model.

## 13. Deployment

- **On-premise / private infrastructure**: `docker compose up --build` (nginx serves the UI and proxies `/api`), optional `ollama` profile for a local LLM. No external calls are made in Demo Mode.
- For production: PostgreSQL + pgvector, GPU node for OCR/LLM, TLS termination, SSO/LDAP instead of demo login, secrets in a vault, backups of the document store, VAPT and CERT-In-aligned hardening.

## Known limitations (prototype)

- OCR, layout, table and entity extraction are **simulated**: uploaded files are validated and structurally parsed for real, but extracted content comes from templates driven by the sample dataset (mine / FY / report type are inferred from the filename).
- Embeddings are a hashing stand-in for Sentence-BERT; retrieval quality on free-form questions is limited compared with a neural embedder.
- The AI assistant handles a defined set of intents (production / metric lookup, targets exceeded, trends, mine summary, comparison, ranking, reclamation, geology) plus extractive fallback; it refuses rather than guessing outside them.
- Authentication is a demo implementation (signed tokens, hashed demo passwords) — not SSO.
- Topic model statistics are seeded, not learned.
- PDF export uses the browser's print dialog.

## Smoke test

```bash
cd backend
python scripts/smoke_test.py      # exercises the full API flow against the demo database (resets it)
```
