# TRACE-X — DECISION LOG

| Decision ID | Date | Area | Decision | Context & Rationale | Status |
|---|---|---|---|---|---|
| DEC-001 | 2026-08-31 | Architecture | PostgreSQL as primary System of Record, Neo4j as derived projection | Ensures ACID compliance, audit trails, and reliable relational integrity, while Neo4j accelerates graph traversals and visual queries. | Accepted |
| DEC-002 | 2026-08-31 | Security & Scope | Synthetic data only policy | No real FIR, CDR, or PII data will be processed. Synthetic generators with realistic Indian contexts will be used. | Accepted |
| DEC-003 | 2026-08-31 | UI/UX | Green=High / Red=Low for Evidence Quality legend | Standard intuitive visual cues for investigative quality in UI dashboards. | Accepted |
