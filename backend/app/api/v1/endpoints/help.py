from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.help import FAQItem, KnowledgeArticle, VideoTutorial
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/help", tags=["Help Center & Knowledge Base"])

FAQ_DATABASE: List[FAQItem] = [
    FAQItem(
        id="faq-1",
        question="How does TRACE-X ensure evidence has not been tampered with?",
        category="Chain-of-Custody",
        answer="Every document or file uploaded into TRACE-X is hashed at the byte-level using the SHA-256 cryptographic standard immediately upon intake. The resulting 64-character hexadecimal digest is recorded in an append-only custody events table. Whenever evidence is inspected or audited, the system recomputes the current digest and checks it against the original ingestion digest.",
        tags=["sha256", "integrity", "custody", "tampering"]
    ),
    FAQItem(
        id="faq-2",
        question="What happens when an evidence item is flagged as 'COMPROMISED'?",
        category="Chain-of-Custody",
        answer="If a byte mismatch is detected during verification, TRACE-X immediately changes the status to COMPROMISED, logs a 'flagged_compromised' event with the actor identity and timestamp, downweights its quality score to ≤ 0.15, triggers warning banners on connected hypotheses, and surfaces an urgent 'Re-Verify Evidence' investigative action.",
        tags=["compromised", "tamper-detection", "alert", "quality-score"]
    ),
    FAQItem(
        id="faq-3",
        question="How does the 4-Dimensional Evidence Quality Graph score documents?",
        category="Investigation & Graph",
        answer="Evidence Quality Q(e) is computed across 4 dimensions: Source Reliability S(e) (35%), Temporal Freshness T(e) with a 30-day half-life exponential decay (20%), Cross-Source Corroboration C(e) (30%), and Data Quality D(e) (15%). If an item is compromised, an integrity modifier penalty is applied.",
        tags=["scoring", "quality-graph", "corroboration", "freshness"]
    ),
    FAQItem(
        id="faq-4",
        question="What is the Heuer ACH Competing Hypotheses Engine?",
        category="Hypotheses",
        answer="Based on CIA analyst Richards Heuer's methodology, the engine compares multiple competing crime theories side-by-side. It applies a 1.5x diagnostic penalty to contradicting evidence because disproving a scenario is mathematically more diagnostic than finding confirmatory evidence.",
        tags=["ach", "hypotheses", "contradiction-penalty", "heuer"]
    ),
    FAQItem(
        id="faq-5",
        question="How does Value-of-Information (VoI) rank next investigative moves?",
        category="Investigation & Graph",
        answer="The Action Prioritizer calculates Expected Information Gain (EIG) using the formula: EIG = BaseGain * KnowledgeGapMultiplier * HypothesisTensionMultiplier * Feasibility. Actions that investigate unknown suspect nodes or resolve closely tied hypotheses receive top priority ranking.",
        tags=["action-engine", "eig", "voi", "prioritization"]
    ),
    FAQItem(
        id="faq-6",
        question="How does Entity Resolution consolidate duplicate suspects?",
        category="Investigation & Graph",
        answer="The resolution engine uses Jaro-Winkler string similarity, phone number standardizations (E.164), and vehicle registration normalizers. Candidate duplicates exceeding 75% similarity are surfaced to investigators or auto-resolved at 85%+ threshold, re-wiring all graph relationships seamlessly.",
        tags=["entity-resolution", "jaro-winkler", "deduplication", "merge"]
    ),
    FAQItem(
        id="faq-7",
        question="Can I generate a court-ready evidentiary audit PDF report?",
        category="Admin & Security",
        answer="Yes! From any case dossier, investigators can click 'Integrity Audit' to generate a signed PDF report containing case metadata, itemized SHA-256 digests, verification history, and the complete chronological chain-of-custody event log.",
        tags=["pdf", "report", "court-ready", "audit"]
    ),
    FAQItem(
        id="faq-8",
        question="How do Administrators manage officer accounts and credentials?",
        category="Admin & Security",
        answer="Admins can access the Officers Management panel (/admin/officers) to edit officer names, emails, roles, phone numbers, badge numbers, and police stations. Admins can also toggle activation status, generate one-time password reset tokens, and view comprehensive activity timelines.",
        tags=["admin", "officers", "badge", "station", "reset-password"]
    ),
    FAQItem(
        id="faq-9",
        question="What are the 4 user roles in TRACE-X?",
        category="Admin & Security",
        answer="TRACE-X provides 4 distinct tiers: 1) Admin (full management of officers, system health, and policies), 2) Senior Investigator (full case management, scoring recalculations, and hypothesis comparisons), 3) Investigator (evidence upload, dossier analysis, and action execution), and 4) Independent Auditor (read-only compliance access to audit logs and custody chains).",
        tags=["rbac", "roles", "permissions", "auditor"]
    ),
    FAQItem(
        id="faq-10",
        question="Does TRACE-X work without an active Neo4j connection?",
        category="Investigation & Graph",
        answer="Yes. TRACE-X features a Dual Relational-Graph Hybrid architecture. If Neo4j is offline or unavailable, the system automatically falls back to in-memory topological graph calculations and SQLite/PostgreSQL relational traversals without interrupting case workflows.",
        tags=["neo4j", "fallback", "architecture", "resilience"]
    )
]

KNOWLEDGE_ARTICLES: List[KnowledgeArticle] = [
    KnowledgeArticle(
        id="art-1",
        slug="getting-started-guide",
        title="Quickstart: Initiating Your First Investigation Dossier",
        category="Getting Started",
        reading_time="4 min read",
        summary="A step-by-step walkthrough on creating cases, selecting priority levels, and navigating the 5 core workspace modules.",
        content_markdown="""# Initiating an Investigation Dossier in TRACE-X

### Step 1: Case Creation
Navigate to **Investigation Dossiers** and click **New Investigation**. Fill in:
- **Title**: A descriptive operation name (e.g. *Operation Rupee Trail: Hawala & Shell Corporate Network*).
- **Case / FIR Number**: Standardized agency identifier (e.g. `FIR-2026-DEL-8841`).
- **Priority**: Select from `Low`, `Medium`, `High`, or `Critical`.

### Step 2: Accessing the Investigation Workspace
Once created, click **Analyze** on the case card to open the workspace. The sidebar grants instant access to:
1. **Evidence Graph**: Visual relational canvas with Evidence Quality rings.
2. **Competing Hypotheses**: Heuer ACH matrix.
3. **Prioritized Actions**: EIG-ranked investigative moves.
4. **Investigation Reports**: Dossier & Integrity PDF exports.
"""
    ),
    KnowledgeArticle(
        id="art-2",
        slug="evidence-ingestion-and-scoring",
        title="Evidence Ingestion, Extraction & 4D Quality Scoring",
        category="Evidence Management",
        reading_time="6 min read",
        summary="Understanding the multi-source evidence ingestion pipeline, entity extraction heuristics, and the 4D quality formula.",
        content_markdown="""# Evidence Ingestion & Quality Scoring

### Multi-Source File Support
TRACE-X ingests `.txt` FIRs, `.csv` CDRs and financial logs, `.json` dumps, and structured uploads.

### The 4D Evidence Quality Formula
$$Q(e) = (0.35 \\cdot S(e) + 0.20 \\cdot T(e) + 0.30 \\cdot C(e) + 0.15 \\cdot D(e)) \\cdot I(e)$$

- **$S(e)$ Source Reliability**: Base reliability weights (FIR: 90%, CDR: 85%, Financial: 80%, CCTV: 75%, Witness: 50%, Tip: 20%).
- **$T(e)$ Temporal Freshness**: Exponential half-life decay $\\lambda = 0.0231$ (30 days).
- **$C(e)$ Cross-Source Corroboration**: Boosts when the same entity is independently verified in multiple sources.
- **$D(e)$ Data Completeness**: Heuristics on text length, extracted identifiers, and schema fields.
- **$I(e)$ Integrity Multiplier**: 1.0 (Verified), 0.8 (Unverified), 0.10 (Compromised).
"""
    ),
    KnowledgeArticle(
        id="art-3",
        slug="chain-of-custody-architecture",
        title="Cryptographic Chain-of-Custody & Tamper Detection",
        category="Chain-of-Custody",
        reading_time="5 min read",
        summary="Deep dive into SHA-256 ingestion hashing, append-only custody event logging, and defensible court reports.",
        content_markdown="""# Cryptographic Chain-of-Custody

### Ingestion Provenance
Every evidence item uploaded receives a SHA-256 hash digest. An immutable `uploaded` event is immediately registered in the `custody_events` ledger.

### Live Verification & Tampering Simulation
1. Click **Chain of Custody & SHA-256** on any evidence item in the graph.
2. Click **Verify Integrity Now** to recompute the active hash.
3. For live demonstration, click **Simulate Tamper (Demo Action)** to test automated detection and quality downweighting.
"""
    ),
    KnowledgeArticle(
        id="art-4",
        slug="admin-guide",
        title="Administrator Manual: Officer Management & Compliance",
        category="Admin Guide",
        reading_time="5 min read",
        summary="How administrators configure police station credentials, manage officer accounts, and audit user activity.",
        content_markdown="""# Administrator & Security Guide

### Managing Officers
Navigate to **/admin/officers** to:
- Edit officer full name, email, role, phone number, badge number, and station.
- Deactivate officers without deleting historical case records.
- Generate one-time password reset tokens.
- Review unified activity timelines.

### System Health & Monitoring
Navigate to **/admin/health** to inspect real-time database latencies, Neo4j connectivity, storage capacity, and aggregate tampering analytics.
"""
    )
]

VIDEO_TUTORIALS: List[VideoTutorial] = [
    VideoTutorial(
        id="vid-1",
        title="1. Ingesting Evidence & Parsing Entities",
        duration="2:45",
        description="Learn how to upload FIRs, CDR CSVs, and extract suspect entities automatically.",
        category="Ingestion",
        embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnail_icon="FileText"
    ),
    VideoTutorial(
        id="vid-2",
        title="2. Cryptographic Chain-of-Custody & Tamper Check",
        duration="3:10",
        description="Demonstrating SHA-256 hashing, verification, and real-time tamper alerts.",
        category="Chain-of-Custody",
        embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnail_icon="ShieldCheck"
    ),
    VideoTutorial(
        id="vid-3",
        title="3. Competing Hypotheses & Contradiction Weighting",
        duration="3:30",
        description="Evaluating rival theories side-by-side using Richards Heuer ACH analysis.",
        category="Hypotheses",
        embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnail_icon="GitCompare"
    ),
    VideoTutorial(
        id="vid-4",
        title="4. Value-of-Information (VoI) Action Prioritizer",
        duration="2:20",
        description="How TRACE-X calculates Expected Information Gain to recommend your next move.",
        category="Actions",
        embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnail_icon="ListOrdered"
    ),
    VideoTutorial(
        id="vid-5",
        title="5. Admin Panel: Officer Management & Health",
        duration="3:00",
        description="Editing officers, badge numbers, stations, password resets, and health monitoring.",
        category="Admin",
        embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnail_icon="Users"
    )
]

@router.get("/faq", response_model=List[FAQItem])
def get_faq_list(search: Optional[str] = None, category: Optional[str] = None):
    results = FAQ_DATABASE
    if category and category != "all":
        results = [f for f in results if f.category.lower() == category.lower()]
    if search:
        term = search.lower()
        results = [
            f for f in results
            if term in f.question.lower() or term in f.answer.lower() or any(term in t.lower() for t in f.tags)
        ]
    return results

@router.get("/articles", response_model=List[KnowledgeArticle])
def get_knowledge_articles(search: Optional[str] = None, category: Optional[str] = None):
    results = KNOWLEDGE_ARTICLES
    if category and category != "all":
        results = [a for a in results if a.category.lower() == category.lower()]
    if search:
        term = search.lower()
        results = [
            a for a in results
            if term in a.title.lower() or term in a.summary.lower() or term in a.content_markdown.lower()
        ]
    return results

@router.get("/videos", response_model=List[VideoTutorial])
def get_video_tutorials():
    return VIDEO_TUTORIALS

@router.post("/tour-complete")
def mark_tour_complete(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.has_completed_tour = True
    db.commit()
    return {"status": "success", "has_completed_tour": True}
