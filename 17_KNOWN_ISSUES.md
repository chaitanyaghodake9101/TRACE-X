# TRACE-X — KNOWN ISSUES & LIMITATIONS

| Issue ID | Severity | Area | Description | Workaround / Mitigation | Target Fix |
|---|---|---|---|---|---|
| ISS-001 | Low | Entity Extraction | Deep Indic NER models may require GPU or high memory. | Provide lightweight regex + spaCy small model fallback for hackathon MVP. | Phase 1 Block 5 |
| ISS-002 | Medium | Infrastructure | Neo4j container may require ~1-2GB RAM. | Configure memory limit flags (`NEO4J_dbms_memory_heap_initial__size`, etc.) in docker-compose. | Phase 1 Block 1 |
