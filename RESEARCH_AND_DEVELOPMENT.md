# TRACE-X — RESEARCH & DEVELOPMENT SUMMARY
### Prior-art positioning for Antigravity / pitch material

> ⚠️ Note on sourcing: the figures below (87+ sources, specific citation numbers like [245]–[272]) are carried over verbatim from the team's existing `19_RESEARCH.md` / `25_PRIOR_ART.md`. This file does not independently verify those citations — treat the underlying source list as something the team should keep on hand to back up any claim if asked, and re-verify before using these numbers in a public-facing pitch.

---

## 1. RESEARCH SCOPE

Prior-art review was conducted across four categories relevant to an investigative graph-analytics platform:

1. **Government systems** — CCTNS, ICJS, NATGRID, NCRB-Abhigyan/CrPI, various State Police Systems
2. **Commercial systems** — Palantir Gotham, IBM i2 Analyst's Notebook, Neo4j GraphAware, Innefu Labs, ArcGIS Crime Analysis
3. **Research systems** — CrimeGraphRAG, GNNs for organized-crime networks, GNN-XAI for financial crime, LAS-GNN for money laundering, XGA-E for network anomaly detection
4. **Open-source libraries / patents** — spaCy, IndicBERT, Dedupe, NetworkX, Neo4j GDS; relevant US and WIPO patents (Palantir, IBM, Neo4j, Innefu)

---

## 2. GAP ANALYSIS BY INNOVATION

### 2.1 Evidence Quality Graph
| System type | Finding |
|---|---|
| Government | No system found that scores evidence quality |
| Commercial | Basic source linking exists; no automated multi-dimensional scoring |
| Research | Confidence scores appear in some literature, but not multi-dimensional (reliability + freshness + corroboration + completeness) quality scoring integrated with graph analytics |

**Positioning claim (safe form):** "No system reviewed combines automated, multi-dimensional evidence quality scoring with graph-based investigation tooling — TRACE-X proposes to address this gap."

### 2.2 Competing Hypotheses Engine
| System type | Finding |
|---|---|
| Government | No structured hypothesis-testing capability found |
| Commercial | Manual hypothesis notes only; no structured comparison or scoring |
| Research | Basic hypothesis generation appears in some papers; no evidence-quality-weighted scoring found |

**Positioning claim (safe form):** "No system reviewed provides structured, evidence-quality-weighted hypothesis comparison for investigative workflows — TRACE-X proposes to address this gap."

### 2.3 Information Gain Prioritizer
| System type | Finding |
|---|---|
| Government | No information-gain-based action prioritization found |
| Commercial | Basic workflow/task recommendation exists; no information-gain calculation |
| Research | No action-prioritization framework found in the reviewed literature |

**Positioning claim (safe form):** "No system reviewed prioritizes investigative actions by expected information gain — TRACE-X proposes to address this gap."

---

## 3. HOW TO PRESENT THIS RESPONSIBLY

Guidance for whoever writes the final pitch deck, or for an agent drafting slide/report copy:

- Frame everything as **"no system found in our review provides X"**, not **"no system in the world provides X."** Prior-art review, however exhaustive, is not exhaustive proof of absence.
- Don't state citation counts (e.g. "87+ sources") in a pitch unless the actual source list is available to back it up if a judge asks to see it.
- Distinguish clearly between *"true gap"* (nothing found does this) and *"differentiation"* (others do a version of this, TRACE-X does it better/differently) — the summary above treats all three innovations as gaps; if any judge/mentor is aware of a competing system, that framing should be revisited rather than defended reflexively.
- Do not claim IP novelty or patentability — that is a legal determination, not something to assert in an academic/hackathon pitch.

---

## 4. DEVELOPMENT PRINCIPLES CARRIED FORWARD FROM RESEARCH

These follow directly from the gap analysis and should guide implementation (see BLUEPRINT.md for the technical spec):

1. **Multi-dimensional, not single-score:** keep the four evidence-quality dimensions separately visible in the UI/API, not collapsed into one opaque number — this is the actual differentiator vs. commercial "basic source linking."
2. **Quality-weighted, not just evidence-counted:** hypothesis scoring must weight by evidence quality, not just tally supports vs. contradicts — this is what separates it from "manual hypothesis notes."
3. **Gain-driven, not workflow-templated:** action prioritization must be computed (base gain × multipliers), not a static checklist — this is what separates it from "basic workflow recommendations."

---

## 5. WHAT THIS DOCUMENT IS NOT

- Not a substitute for `19_RESEARCH.md` and `25_PRIOR_ART.md` — those remain the detailed source-by-source record and should be kept alongside this summary.
- Not a legal or academic literature review — it is a hackathon-scoped positioning summary meant to justify the three Phase 1 innovations to judges and to downstream AI coding agents.
- Not evidence that the accuracy targets in BLUEPRINT.md §6 have been achieved — those are development targets, to be validated against synthetic test data during the build.
