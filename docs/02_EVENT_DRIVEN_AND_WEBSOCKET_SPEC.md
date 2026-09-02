# TRACE-X — EVENT-DRIVEN ARCHITECTURE & WEBSOCKET SPECIFICATION

## 1. Transactional Outbox Pattern

To prevent dual-write inconsistencies between PostgreSQL (source of truth) and Neo4j (derived graph projection), TRACE-X uses the Transactional Outbox pattern:

```
[HTTP Request] ──► [PostgreSQL Transaction]
                          │
                          ├─► INSERT INTO evidence
                          ├─► INSERT INTO custody_events
                          └─► INSERT INTO domain_outbox_events (status='pending')
                                     │
                                     ▼ (Worker Polling / CDC)
                             [Outbox Worker]
                                     │
                                     ├─► Project to Neo4j Graph
                                     ├─► Push to WebSocket Gateway
                                     └─► Record in processed_events (Idempotency)
```

---

## 2. Domain Event Catalog

| Event Name | Version | Emitted When | Payload Summary |
|---|---|---|---|
| `evidence.uploaded.v1` | v1 | Evidence ingested & hashed | `evidence_id`, `case_id`, `title`, `source_type`, `sha256_hash`, `quality_score` |
| `evidence.integrity_verified.v1` | v1 | SHA-256 match confirmed | `evidence_id`, `case_id`, `status: "VERIFIED"`, `recomputed_hash` |
| `evidence.integrity_mismatch_detected.v1` | v1 | Cryptographic mismatch found | `evidence_id`, `case_id`, `status: "COMPROMISED"`, `expected_hash`, `recomputed_hash` |
| `officer.created.v1` | v1 | New officer registered | `officer_id`, `email`, `role`, `station` |
| `officer.updated.v1` | v1 | Profile/Badge updated | `officer_id`, `diff_fields` |
| `hypothesis.updated.v1` | v1 | Heuer ACH matrix recalibrated | `hypothesis_id`, `case_id`, `likelihood_score` |

---

## 3. Real-Time WebSocket Gateway (`/api/v1/ws/events`)

- **Protocol:** Secure WebSockets (`ws://` / `wss://`)
- **Authentication:** Query parameter token `?token=<JWT>` validated against user active state on handshake.
- **Client Subscription Message:**
  ```json
  {
    "action": "subscribe",
    "case_id": "case-uuid-here"
  }
  ```
- **Server Broadcast Payload:** Minimal notification footprint (zero data leakage over stream):
  ```json
  {
    "event": "evidence.integrity_mismatch_detected.v1",
    "aggregate_id": "ev-uuid-here",
    "case_id": "case-uuid-here",
    "timestamp": "2026-09-01T12:00:00Z"
  }
  ```
