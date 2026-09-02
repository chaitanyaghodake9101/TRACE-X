# TRACE-X — SYSTEM OVERVIEW

## 1. System Identity
- **Name:** TRACE-X (*Trusted Relationship & Analytical Crime Engine*)
- **Target Organization:** Ministry of Home Affairs (NCRB / Women Safety Division)
- **Problem Statement:** SIH26189 — AI-Powered Criminal Network Analysis System
- **Core Principle:** Decision-support platform for law enforcement. Guilt or innocence is determined solely by the judiciary; all AI outputs are evidentiary leads requiring investigator corroboration.

---

## 2. Core Architectural Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRACE-X INTELLIGENCE HUB                           │
├────────────────────────┬────────────────────────────┬───────────────────────┤
│    DATA INGESTION      │   INTELLIGENT ANALYTICS    │  EVIDENTIARY TRUST    │
│  - Multimodal Ingest   │  - 4D Quality Graph (Q)    │  - SHA-256 Baseline   │
│  - Structured CDR/CSV  │  - Heuer ACH Hypotheses    │  - Immutable Custody  │
│  - OCR & Heuristics    │  - VoI Action Prioritizer  │  - Tamper Detection   │
└────────────────────────┴────────────────────────────┴───────────────────────┘
```

1. **Evidence Foundation:** Cryptographic SHA-256 intake hashing with append-only chain-of-custody logging.
2. **4D Quality Scoring:** Mathematical scoring combining Source Reliability ($S$), Temporal Freshness ($T$), Cross-Corroboration ($C$), and Data Quality ($D$).
3. **Competing Hypotheses (ACH):** Structured cognitive bias elimination with $1.5\times$ contradiction diagnostic weighting.
4. **Value-of-Information (VoI):** Expected Information Gain ranking for next investigative steps.
5. **Real-Time Synchronization:** Transactional outbox with WebSocket event propagation and derived Neo4j graph projections.
