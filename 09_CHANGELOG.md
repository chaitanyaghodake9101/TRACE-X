# TRACE-X — CHANGELOG

All notable changes to the TRACE-X platform are documented in this file.

## [1.0.0] - 2026-08-31
### Added
- **Block 12: Reporting, Audit & Demo Polish (100% Sprint Completion)**:
  - Official Law Enforcement Investigation PDF Dossier generator ([app/services/report_service.py](file:///d:/Trace-X/backend/app/services/report_service.py)) with ReportLab:
    - Case Overview & Executive Summary.
    - Key Resolved Entity Network table with confidence scores.
    - 4-Dimensional Evidence Quality distribution table.
    - Richards Heuer Analysis of Competing Hypotheses (ACH) calibrated likelihood rankings.
    - Value-of-Information (VoI) Next Recommended Actions list.
    - Chain of Custody & Cryptographic Audit Sign-off block.
  - PDF Export and Audit Log endpoints (`POST /cases/{id}/reports`, `GET /cases/{id}/audit-logs`) in [app/api/v1/endpoints/reports.py](file:///d:/Trace-X/backend/app/api/v1/endpoints/reports.py).
  - Realistic Demonstration Case Seeder ([backend/scripts/seed_demo_case.py](file:///d:/Trace-X/backend/scripts/seed_demo_case.py)): "Operation Rupee Trail: Hawala & Shell Corporate Network" (FIR-2026-DEL-8841).
  - Integration test suite in [backend/tests/test_reports.py](file:///d:/Trace-X/backend/tests/test_reports.py) (**39 total tests passing across all 12 blocks**).
  - "Export PDF Dossier" trigger and download handler in [frontend/src/pages/CasesPage.tsx](file:///d:/Trace-X/frontend/src/pages/CasesPage.tsx).

## [0.12.0] - 2026-08-31
### Added
- **Block 11 Innovation 3: Information Gain Prioritizer**:
  - Value-of-Information (VoI) Expected Information Gain (EIG) Engine ([app/services/action_engine.py](file:///d:/Trace-X/backend/app/services/action_engine.py)):
    - Formula: $\text{EIG}(a) = \text{BaseGain}(a) \cdot \mu_{\text{gap}}(a) \cdot \mu_{\text{hyp}}(a) \cdot \phi_{\text{feasibility}}(a)$.
    - Dynamic Priority Rank assignment and action outcome completion feedback loop.
  - Interactive Action Planner UI ([frontend/src/pages/ActionsPage.tsx](file:///d:/Trace-X/frontend/src/pages/ActionsPage.tsx)).

## [0.11.0] - 2026-08-31
### Added
- **Block 10 Innovation 2: Competing Hypotheses (ACH) Engine**:
  - Heuer ACH support/contradiction scoring, $1.5\times$ contradiction diagnostic penalty, sigmoid likelihood calibration, and side-by-side comparison matrix.

## [0.10.0] - 2026-08-31
### Added
- **Block 9 Innovation 1: Evidence Quality Graph Engine**:
  - 4-Dimensional Scoring Service ($Q = 0.35S + 0.20T + 0.30C + 0.15D$), 30-day exponential decay, cross-source corroboration, and graph confidence propagation.

## [0.9.0] - 2026-08-31
### Added
- **Block 8 Graph Visualization & Interaction**:
  - Interactive React Flow canvas with custom nodes, quality rings, quality slider, entity multi-selector, and Node Inspector.

## [0.8.0] - 2026-08-31
### Added
- **Block 7 Graph Construction**:
  - Unified Graph Compiler, `MENTIONED_IN` link synthesis, topological statistics, and Neo4j Cypher projection synchronizer.

## [0.7.0] - 2026-08-31
### Added
- **Block 6 Entity Resolution**:
  - Fuzzy similarity engine, duplicate candidate discovery, and entity merge with relationship rewiring.

## [0.6.0] - 2026-08-31
### Added
- **Block 5 Entity Extraction (NER)**:
  - 6-class Named Entity Recognition pipeline.

## [0.5.0] - 2026-08-31
### Added
- **Block 4 Evidence Ingestion & Parsing**:
  - Multi-source document parser for `.txt`, `.csv` (CDRs), and `.json` documents.

## [0.4.0] - 2026-08-31
### Added
- **Block 3 Case Management**:
  - Scoped CRUD endpoints and RBAC visibility filtering.

## [0.3.0] - 2026-08-31
### Added
- **Block 2 Auth & RBAC**:
  - Native `bcrypt` password hashing, dual JWT tokens, and role-based access decorators.

## [0.2.0] - 2026-08-31
### Added
- **Block 1 Infrastructure & Environment**:
  - Docker compose, database models, initial migration, and React 18 frontend.

## [0.1.0] - 2026-08-31
### Added
- Project brief, Blueprint, R&D gap analysis, and 48-hour workflow guide.
