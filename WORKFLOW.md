# TRACE-X — IMPLEMENTATION WORKFLOW (48 Hours)
### Hand this to Antigravity alongside BLUEPRINT.md and RESEARCH_AND_DEVELOPMENT.md

---

## HOW TO USE THIS FILE

Each block below is a self-contained work unit an agent (or a team member paired with an agent) can execute independently once its **Depends on** items are done. Blocks are grouped by day/hour to match the original 48-hour plan, but the dependency graph is what actually gates order — if running solo with an agent, follow dependencies, not the clock.

Status legend to use when updating `10_TASK_BOARD.md`: `☐ pending` · `▶ in progress` · `✅ done` · `⚠ blocked`

---

## DAY 1 — FOUNDATION (Hours 0–24)

### Block 1 · Environment (Hours 0–4)
**Owner:** Chaitanya · **Depends on:** nothing
- [ ] `docker-compose.yml` with services: `postgres`, `neo4j`, `backend` (FastAPI), `frontend` (Vite dev server)
- [ ] `.env.example` with all required vars (DB URLs, JWT secret, Google OAuth client id/secret placeholders)
- [ ] Alembic initialized, first migration = schema from BLUEPRINT.md §3
- [ ] Health-check endpoint `/health` returning DB + Neo4j connectivity status
- **Deliverable:** `docker compose up` brings up all 4 services cleanly.

### Block 2 · Auth (Hours 4–8)
**Owner:** Chaitanya · **Depends on:** Block 1
- [ ] `users` table + password hashing (bcrypt/argon2)
- [ ] `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- [ ] Google OAuth flow (`POST /auth/google`)
- [ ] RBAC middleware: role check decorator for `admin / senior_investigator / investigator / auditor`
- **Deliverable:** Can log in via email/password and Google, receive JWT, hit a protected route.

### Block 3 · Case Management (Hours 8–12)
**Owner:** Suyash + Member 6 · **Depends on:** Block 2
- [ ] CRUD for `/api/v1/cases`
- [ ] Permission filtering (users see only cases they created or are assigned to, per role)
- [ ] Frontend: case list page + "new case" modal
- **Deliverable:** Create/list/view/edit/delete a case end-to-end through the UI.

### Block 4 · Evidence Upload (Hours 12–16)
**Owner:** Member 3 + Member 4 · **Depends on:** Block 3
- [ ] `POST /api/v1/cases/{id}/evidence` — file upload + `source_type` tagging
- [ ] Text extraction (PDF/image OCR if needed, else plain text ingestion for synthetic docs)
- [ ] Frontend: evidence upload widget with source-type selector
- **Deliverable:** Upload a synthetic FIR/CDR/financial record, see it listed on the case.

### Block 5 · Entity Extraction (Hours 16–20)
**Owner:** Member 5 + Member 6 · **Depends on:** Block 4
- [ ] spaCy + IndicBERT NER pipeline over `extracted_text`
- [ ] Write extracted entities into `entities` table (type: person/phone/vehicle/location/organization/event)
- **Deliverable:** Uploading evidence auto-populates candidate entities for the case.

### Block 6 · Entity Resolution (Hours 20–24)
**Owner:** Member 5 + Member 6 · **Depends on:** Block 5
- [ ] Dedupe + fuzzy matching to merge duplicate entity mentions
- [ ] Merge-suggestion review UI (or auto-merge above a similarity threshold, manual review below it)
- **Deliverable:** Same phone number mentioned in two evidence items resolves to one entity node.

---

## DAY 2 — GRAPH + CORE 3 INNOVATIONS (Hours 24–48)

### Block 7 · Graph Construction (Hours 24–28)
**Owner:** Chaitanya + Member 6 · **Depends on:** Block 6
- [ ] Sync resolved entities/relationships into Neo4j per schema in BLUEPRINT.md §3
- [ ] `GET /api/v1/cases/{id}/graph` returns nodes+edges JSON for the frontend
- **Deliverable:** Graph query returns a real subgraph for a populated case.

### Block 8 · Graph Visualization (Hours 28–32)
**Owner:** Suyash + Member 4 · **Depends on:** Block 7
- [ ] React Flow canvas rendering nodes (typed icons) and edges (labeled by predicate)
- [ ] Basic interactions: pan/zoom, click node → detail panel
- **Deliverable:** Interactive graph visible and navigable in the UI.

### Block 9 · Evidence Quality Graph — Innovation 1 (Hours 32–36)
**Owner:** Member 5 + Member 6 · **Depends on:** Block 4, Block 7
- [ ] Implement scoring algorithm from BLUEPRINT.md §2.1
- [ ] `evidence_quality_scores` populated on evidence create + recomputed on corroboration change
- [ ] `GET /evidence/{id}/quality`, `GET /cases/{id}/evidence-quality`
- [ ] Frontend: color-code graph nodes/evidence list by quality score, legend
- **Deliverable:** Every evidence item shows a quality score; graph reflects it visually.

### Block 10 · Competing Hypotheses Engine — Innovation 2 (Hours 36–40)
**Owner:** Chaitanya + Member 3 · **Depends on:** Block 9
- [ ] `hypotheses`, `evidence_hypothesis`, `hypothesis_scores` tables wired up
- [ ] Scoring algorithm from BLUEPRINT.md §2.2
- [ ] `POST /cases/{id}/hypotheses`, `GET /cases/{id}/hypotheses`, `POST /hypotheses/{id}/evidence`, `GET /hypotheses/{id}/compare`
- [ ] Frontend: create 2 hypotheses, link evidence as supporting/contradicting, side-by-side comparison view with confidence badges
- **Deliverable:** Two competing hypotheses with different confidence scores, visibly driven by evidence quality.

### Block 11 · Information Gain Prioritizer — Innovation 3 (Hours 40–44)
**Owner:** Member 3 + Member 4 · **Depends on:** Block 10
- [ ] `investigative_actions`, `action_outcomes` tables
- [ ] Scoring algorithm from BLUEPRINT.md §2.3 (needs a minimal inline evidence-gap heuristic)
- [ ] `POST /cases/{id}/actions/prioritize`, `POST /actions/{id}/complete`
- [ ] Frontend: ranked action table with gain visualization and "why this action" explanation
- **Deliverable:** Case shows a ranked list of next actions with justification.

### Block 12 · Reports, Audit, Testing, Demo Prep (Hours 44–48)
**Owner:** All · **Depends on:** Blocks 9–11
- [ ] `POST /cases/{id}/reports` generates a PDF (case summary + evidence quality + hypothesis comparison + action recommendations)
- [ ] Audit logging confirmed on all mutating endpoints
- [ ] Smoke test pass across full demo flow (see below)
- [ ] Demo data seeded, dry run rehearsed at least twice
- **Deliverable:** Full 5-minute demo runs without errors, PDF report downloads correctly.

---

## DEMO REHEARSAL CHECKLIST (5 minutes — run before presenting)

| Step | Time | Must show |
|---|---|---|
| 1. Login (Google OAuth) | 0:30 | Auth works live |
| 2. Create case, upload synthetic FIR/CDR/financial evidence | 1:00 | Upload + source tagging |
| 3. Graph with quality-scored nodes | 1:00 | Color coding, point to a high vs. low score |
| 4. Two competing hypotheses with evidence support/contradiction | 1:30 | Confidence scores differ, tie back to evidence quality |
| 5. Evidence gaps + ranked action recommendations | 1:00 | Explain why top action has highest gain |
| 6. Generate PDF report | 0:30 | Report opens cleanly |

---

## POST-BLOCK HOUSEKEEPING (do after every block, not just at hour 48)

After completing any block above:
1. Update `00_PROJECT_STATE.md` (status/blockers/next task)
2. Append to `09_CHANGELOG.md`
3. Mark task status in `10_TASK_BOARD.md`
4. Log any test results/gaps in `11_TEST_STATUS.md`
5. Log new issues in `17_KNOWN_ISSUES.md`
6. If handing off to a different session/agent, write a note in `18_HANDOFF.md`

---

## RISK / FALLBACK NOTES

- If entity extraction (Block 5) underperforms on synthetic Indian-context data, fall back to rule/regex-based extraction for demo-critical entity types (phone numbers, names from a controlled synthetic vocabulary) rather than blocking downstream blocks.
- If Neo4j sync (Block 7) proves flaky under time pressure, the graph view can temporarily read directly from PostgreSQL `relationships` table — swap in Neo4j once stable, since Blocks 9–11 depend on the API contract, not the storage engine.
- Blocks 9 → 10 → 11 are strictly sequential (each scoring model consumes the previous one's output) — do not parallelize across different people without a shared score-schema freeze first.
