# TRACE-X — TECHNICAL BLUEPRINT
### AI-onboarding document for Antigravity / any coding agent
Version: 1.0 · Source: 00_PROJECT_BRIEF_FOR_AI.md · Scope: Core 3 Innovations (Phase 1 MVP)

---

## 0. READ-FIRST INSTRUCTIONS FOR THE AGENT

1. This is a **48-hour hackathon MVP** (SIH). Do not over-engineer. Prioritize P0 tasks.
2. Use **synthetic data only** — never real FIRs, CDRs, or financial records.
3. Stack is fixed: FastAPI + SQLAlchemy + Alembic (backend), React 18 + TypeScript + Vite + Tailwind + React Flow (frontend), PostgreSQL + Neo4j (data), Docker Compose (deploy). Do not swap frameworks without explicit approval.
4. Every claim in generated docs/demo copy must be a **safe claim** ("TRACE-X proposes...", not "TRACE-X achieves..."). Do not invent benchmark numbers — use the target ranges given in Section 6.
5. After any meaningful change, update: `00_PROJECT_STATE.md`, `09_CHANGELOG.md`, `10_TASK_BOARD.md`, `11_TEST_STATUS.md`, `17_KNOWN_ISSUES.md`, `18_HANDOFF.md`.
6. Build order is: Foundation (auth, cases, evidence, entities, graph) → Core 3 Innovations → Reports/Polish. Do not start an Innovation module before its data dependencies exist.

---

## 1. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│   (Vite + TS + Tailwind + React Flow graph canvas)            │
└───────────────────────────┬───────────────────────────────────┘
                             │ REST (JWT bearer)
┌───────────────────────────▼───────────────────────────────────┐
│                        FastAPI Backend                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │   Auth/    │ │  Cases /  │ │  AI Pipeline │ │  Innovation │ │
│  │   RBAC     │ │ Evidence  │ │ (NER/Resolve)│ │   Engines   │ │
│  └───────────┘ └───────────┘ └──────────────┘ └─────────────┘ │
└───────┬───────────────────────┬─────────────────────┬─────────┘
        │ SQLAlchemy/Alembic     │ Cypher driver        │
┌───────▼────────┐      ┌────────▼─────────┐   ┌────────▼────────┐
│  PostgreSQL     │      │      Neo4j        │   │  File storage   │
│ (relational,    │      │ (entities, edges,  │   │ (evidence docs, │
│  scores, audit) │      │  graph analytics)  │   │  reports)       │
└─────────────────┘      └───────────────────┘   └─────────────────┘
```

**Design principle:** PostgreSQL is the system of record for cases/evidence/scores/audit. Neo4j is a derived, queryable projection of entities and relationships for graph visualization and analytics (centrality, communities). Keep them in sync via the graph-construction service — Neo4j is never the sole source of truth.

---

## 2. CORE 3 INNOVATIONS — BLUEPRINTS

### 2.1 Evidence Quality Graph  (Innovation Score: 89/100)

**Problem:** All evidence is treated equally regardless of source reliability, freshness, or corroboration.

**Scoring model (rule-based, weighted average of 4 dimensions):**

| Dimension | Weight | Logic |
|---|---|---|
| Source Reliability | 0.35 | Lookup table: FIR=0.9, CDR=0.85, financial_records=0.8, cctv=0.75, witness_statement=0.5, anonymous_tip=0.2 |
| Temporal Freshness | 0.20 | Exponential decay: `score = exp(-λ * days_since_event)`, λ tuned so ~30 days → 0.5 |
| Cross-Source Corroboration | 0.30 | `min(1.0, 0.3 + 0.2 * independent_sources_confirming)` |
| Data Quality | 0.15 | Completeness heuristic: required fields present / total required fields |

`overall_quality_score = Σ (dimension_score × weight)`, clamped to [0,1].

**DB:** `evidence_quality_scores` (see Data Model doc / brief) — one row per evidence item, recomputed on evidence create/update and whenever corroborating evidence is added.

**API:**
- `GET /api/v1/evidence/{id}/quality` → single score breakdown
- `GET /api/v1/cases/{id}/evidence-quality` → all scores for a case, sorted desc

**Frontend:** Graph nodes color-coded by `overall_quality_score` (≥0.7 = high, 0.4–0.7 = medium, <0.4 = low). Note: brief's color legend (red=high/yellow=medium/green=low) is unconventional — confirm with team before implementing; a green=high/red=low scheme is more standard and safer for a live demo.

**Build order:** requires `evidence` table populated → compute scores → expose API → wire into graph viz.

---

### 2.2 Competing Hypotheses Engine  (Innovation Score: 93/100)

**Problem:** No structured way to test alternative explanations against evidence.

**Scoring model:**
```
raw_score = Σ(supporting_evidence.quality_score × relationship_strength)
          − Σ(contradicting_evidence.quality_score × relationship_strength)

normalized_score = sigmoid(raw_score / evidence_count)   # → [0,1]

confidence_level =
    "high"   if normalized_score ≥ 0.65
    "medium" if 0.4 ≤ normalized_score < 0.65
    "low"    if normalized_score < 0.4
```

**DB:** `hypotheses`, `evidence_hypothesis` (relationship_type: supports/contradicts, relationship_strength 0–1), `hypothesis_scores` (cached, recomputed on link change).

**API:**
- `POST /api/v1/cases/{id}/hypotheses` — create
- `GET /api/v1/cases/{id}/hypotheses` — list with cached scores
- `POST /api/v1/hypotheses/{id}/evidence` — link evidence (support/contradict + strength)
- `GET /api/v1/hypotheses/{id}/compare` — side-by-side vs. another hypothesis id passed as query param

**Frontend:** Side-by-side comparison cards, evidence chips colored by support/contradict, confidence badge.

**Build order:** requires Evidence Quality Graph (quality scores feed the weighting) → then hypotheses.

---

### 2.3 Information Gain Prioritizer  (Innovation Score: 87/100)

**Problem:** No systematic way to rank next investigative actions by expected value.

**Scoring model:**
```
expected_information_gain =
    base_gain[action_type]
    × gap_multiplier          # 1.5 if action fills an identified evidence gap, else 1.0
    × hypothesis_multiplier   # 1 + 0.5 × (# hypotheses this action could resolve/discriminate between)
    × feasibility_multiplier  # 0.5–1.0, based on action_type effort/access heuristics
```

`base_gain` starting table (tune during dev): obtain_cdr=0.6, interview_witness=0.5, obtain_financial_records=0.65, cctv_review=0.55, forensic_analysis=0.7.

**DB:** `investigative_actions` (status pending/in_progress/completed/cancelled, `priority_rank` recomputed on each prioritize/complete call), `action_outcomes` (logs whether the action actually produced new evidence — feeds the "Action Effectiveness" metric).

**API:**
- `POST /api/v1/cases/{id}/actions/prioritize` — (re)compute ranked list
- `POST /api/v1/actions/{id}/complete` — mark complete, log outcome, trigger re-prioritization

**Frontend:** Ranked list/table with gain bar-chart, "why this action" tooltip explaining which gap/hypothesis it addresses.

**Build order:** requires Hypotheses Engine (for hypothesis_multiplier) and an Evidence Gap Finder heuristic (can be a simple rule: "entity has no evidence of type X for N days" — full Gap Finder is Phase 2, but a minimal inline version is needed here).

---

## 3. DATA MODEL

Full PostgreSQL DDL and Neo4j schema are already finalized in the source brief (`03_DATABASE_SCHEMA.md`) — reuse verbatim:

- **PostgreSQL:** `users`, `cases`, `evidence`, `evidence_quality_scores`, `entities`, `relationships`, `hypotheses`, `evidence_hypothesis`, `hypothesis_scores`, `investigative_actions`, `audit_logs`.
- **Neo4j:** node labels `Person, Phone, Vehicle, Location, Organization, Event, Evidence`; relationship types `CALLS, OWNS, VISITED, MENTIONED_IN, CONNECTED_TO, TRANSFERRED_TO, PART_OF, LOCATED_AT, COMMUNICATED_WITH`.

Agent instruction: generate Alembic migrations directly from this schema; do not redesign it.

---

## 4. API CONTRACT (Full)

Reuse the endpoint list from the brief as-is (Auth, Cases, Evidence, Hypotheses, Actions, Graph, Reports). All endpoints require JWT bearer auth except `/auth/*`. All mutating endpoints must write an `audit_logs` row.

Standard error envelope:
```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

---

## 5. FRONTEND MAP

| Route | Purpose | Key components |
|---|---|---|
| `/login` | Google OAuth + email login | LoginForm |
| `/cases` | Case list | CaseTable, NewCaseModal |
| `/cases/:id/graph` | Main workspace | ReactFlowCanvas, EvidenceQualityLegend |
| `/cases/:id/hypotheses` | Hypothesis comparison | HypothesisCard ×2, EvidenceChipList |
| `/cases/:id/actions` | Prioritized actions | ActionRankTable, GainChart |
| `/cases/:id/reports` | Report generation/download | ReportBuilder |

---

## 6. SUCCESS METRICS (for validation, not marketing copy)

| Metric | Target | Note for agent |
|---|---|---|
| Evidence Quality Accuracy | ≥ 80% | Only claim if actually measured against a labeled synthetic set |
| Hypothesis Accuracy | ≥ 70% | Same caveat |
| Information Gain Accuracy | ≥ 70% | Same caveat |
| API Response Time | ≤ 500ms (p95) | Measure with synthetic load, don't assert without a test |
| Graph Query Response Time | ≤ 100ms (p95) | Same |

Never state these as achieved results unless a test actually produced them — report actual measured numbers instead.

---

## 7. GUARDRAILS FOR ANY AI ASSISTANT CONTINUING THIS PROJECT

1. Do not fabricate accuracy/performance statistics in docs, slides, or code comments.
2. Do not implement anything that ingests real police/personal data — synthetic generators only.
3. Keep scope to Core 3 for Phase 1; Phase 2 items (Alternative Explanation Generator, "What Would Change My Mind?" Engine, Gap Finder, Confirmation-Bias Guard, Multi-Source Corroboration, Investigation Memory, Dead-End Detection) are explicitly deferred.
4. Any architecture deviation from Section 1 must be logged in `08_DECISION_LOG.md` with rationale.
