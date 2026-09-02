# TRACE-X — TASK BOARD (ALL 12 BLOCKS COMPLETE)

Status legend: `☐ pending` · `▶ in progress` · `✅ done` · `⚠ blocked`

---

## Sprint 1: Foundation (Day 1) — ✅ COMPLETED (Hours 0–24)

### Block 1 · Environment & Infrastructure (Hours 0–4)
- [x] `docker-compose.yml` with postgres, neo4j, backend, frontend services
- [x] `.env.example` with DB, JWT, OAuth, and API configs
- [x] Alembic setup + initial PostgreSQL migration for full schema
- [x] Backend health check `/health` verifying DB & Neo4j connectivity
- [x] Frontend Vite + React + TS + Tailwind boilerplate setup

### Block 2 · Auth & RBAC (Hours 4–8)
- [x] `users` table, password hashing (native bcrypt)
- [x] `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/google`
- [x] RBAC middleware for `admin`, `senior_investigator`, `investigator`, `auditor`
- [x] Frontend API client automatic refresh token interceptor

### Block 3 · Case Management (Hours 8–12)
- [x] CRUD API for `/api/v1/cases` with RBAC scoping
- [x] Case assignment and status transition endpoints (`/status`, `/assign`)
- [x] Frontend: Case dossier list with status tabs, search, and "New Case" modal

### Block 4 · Evidence Ingestion (Hours 12–16)
- [x] `POST /api/v1/cases/{id}/evidence/upload` with multipart file upload & source-type metadata
- [x] Synthetic text, CSV (CDR), and JSON document parser with heuristic entity tagging
- [x] Frontend: Evidence upload modal with file picker, format tags, and raw text input

### Block 5 · Entity Extraction (Hours 16–20)
- [x] NER pipeline for Person, Phone, Vehicle, Location, Org, Event entities (`ner_service.py`)
- [x] Candidate entity auto-population in `entities` table on evidence ingestion
- [x] Batch entity extraction endpoint (`POST /cases/{id}/extract-entities`)

### Block 6 · Entity Resolution (Hours 20–24)
- [x] Deduplication and similarity matching (Jaro-Winkler, phone/vehicle normalization)
- [x] Entity merge logic repointing relationships & auto-resolve endpoint

---

## Sprint 2: Graph & Core 3 Innovations (Day 2) — ✅ COMPLETED (Hours 24–48)

### Block 7 · Graph Construction (Hours 24–28)
- [x] PostgreSQL to Neo4j synchronizer (`sync_case_to_neo4j`)
- [x] `GET /api/v1/cases/{id}/graph` unified topology builder with evidence mentions & quality filtering
- [x] `GET /api/v1/cases/{id}/graph/stats` topological graph metrics endpoint

### Block 8 · Graph Visualization (Hours 28–32)
- [x] React Flow canvas with custom nodes (typed icons, quality rings)
- [x] Edge predicates, detail inspector panel, pan/zoom/filter controls
- [x] Minimum Quality slider ($0\%$ to $90\%$), entity type multi-selector, and canvas triggers

### Block 9 · Innovation 1: Evidence Quality Graph (Hours 32–36)
- [x] 4-Dimensional mathematical scoring engine: $Q(e) = 0.35S + 0.20T + 0.30C + 0.15D$
- [x] Temporal exponential decay with 30-day half-life ($\lambda \approx 0.0231$)
- [x] Cross-source corroboration ($C(e)$) & graph confidence propagation
- [x] `POST /api/v1/cases/{id}/evidence-quality/recalculate` & `GET /api/v1/cases/{id}/evidence-quality/summary`

### Block 10 · Innovation 2: Competing Hypotheses Engine (Hours 36–40)
- [x] `hypotheses`, `evidence_hypothesis`, `hypothesis_scores` tables & API
- [x] Evidence-weighted hypothesis scoring engine (supports vs contradicts * $Q(e)$)
- [x] Heuer ACH $1.5\times$ contradiction penalty & sigmoid likelihood calibration
- [x] Side-by-side comparison UI with diagnostic evidence highlights

### Block 11 · Innovation 3: Information Gain Prioritizer (Hours 40–44)
- [x] `investigative_actions`, `action_outcomes` tables & API
- [x] Expected information gain calculation ($\text{EIG} = \text{Base} \cdot \mu_{\text{gap}} \cdot \mu_{\text{hyp}} \cdot \phi$)
- [x] UI ranked action matrix with "Why this action" explanation tooltips and complete outcome logger

### Block 12 · Reporting, Audit & Demo Polish (Hours 44–48)
- [x] `POST /api/v1/cases/{id}/reports` official PDF export with ReportLab
- [x] Scoped audit log queries (`GET /cases/{id}/audit-logs`)
- [x] End-to-end realistic demo seeding script (`backend/scripts/seed_demo_case.py`)
- [x] Final smoke testing and full platform build verification
