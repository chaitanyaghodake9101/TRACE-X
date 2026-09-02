# TRACE-X: Transformative Relational Analytics & Criminal Evidence Cross-Examination

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Pytest-82%20Passed%20(100%25)-success.svg)](backend/tests/)
[![Security](https://img.shields.io/badge/Security-RBAC%20%7C%20SHA--256%20Custody-blue.svg)]()

> **TRACE-X** is an advanced Law Enforcement & Relational Intelligence platform engineered to eliminate cognitive bias, quantify evidentiary reliability, evaluate competing crime theories through formal intelligence frameworks, and mathematically prioritize field investigations.

---

## 📑 Table of Contents
- [Key Architectural Innovations](#-key-architectural-innovations)
- [Investigation Intelligence Suite](#-investigation-intelligence-suite)
- [Technology Stack](#-technology-stack)
- [Quickstart Guide](#-quickstart-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Realistic Demo Seeding](#realistic-demo-seeding)
- [Demo Credentials](#-demo-credentials)
- [Mathematical Formulations](#-mathematical-formulations)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security, Chain of Custody & Compliance](#-security-chain-of-custody--compliance)

---

## 🧠 Key Architectural Innovations

### 1. Evidence Quality Graph Engine
Quantifies raw evidentiary reliability using a 4-dimensional mathematical formulation:
$$Q(e) = 0.35 \cdot S(e) + 0.20 \cdot T(e) + 0.30 \cdot C(e) + 0.15 \cdot D(e)$$
- **Source Reliability ($S$):** Weighting by source provenance (official records, CDR dumps, forensic forensics, eyewitness accounts).
- **Temporal Decay ($T$):** 30-day exponential half-life decay function ($\lambda \approx 0.0231$) accounting for evidence degradation.
- **Cross-Source Corroboration ($C$):** Boosts confidence when independent sources validate identical entity linkages.
- **Directness ($D$):** Calibrates primary direct proof versus circumstantial inference.
- **Graph Propagation:** Propagates evidentiary quality across entity nodes:
  $$\text{Confidence}(v) = 1 - \prod_{e \in E(v)} (1 - Q(e))$$

### 2. Richards Heuer Competing Hypotheses (ACH) Engine
Eliminates confirmation bias by evaluating all plausible crime hypotheses simultaneously against the evidence matrix:
- **Diagnostic Contradiction Penalty:** Applying a $1.5\times$ penalty for contradictory evidence (negative evidence is more diagnostic than positive corroboration).
  $$\text{NetScore}(H) = \sum_{e \in \text{Supports}(H)} Q(e) - 1.5 \cdot \sum_{e \in \text{Contradicts}(H)} Q(e)$$
- **Calibrated Sigmoid Likelihood:**
  $$\text{Likelihood}(H) = \frac{1}{1 + \exp(-1.2 \cdot \text{NetScore}(H))}$$
- Side-by-side scenario matrix highlighting highly diagnostic evidence items.

### 3. Value-of-Information (VoI) Prioritizer
Mathematically optimizes resource allocation for investigating officers:
$$\text{EIG}(a) = \text{BaseGain}(a) \cdot \mu_{\text{gap}}(a) \cdot \mu_{\text{hyp}}(a) \cdot \phi_{\text{feasibility}}(a)$$
- Ranks investigative leads by Expected Information Gain (EIG).
- Explanatory tooltips answering *"Why this action?"*.
- Outcome logging feedback loop that dynamically recalibrates hypothesis probabilities upon action completion.

---

## 🔬 Investigation Intelligence Suite

| Module | Core Functionality |
|---|---|
| **Counterfactual Sandbox** | Sandboxed what-if branch simulation allowing investigators to test alternative scenarios without altering official case records. |
| **Network Resilience Analyzer** | Adversarial node/edge removal simulations, betweenness centrality shift analysis, and single-point-of-failure detection. |
| **Evidence Decay & Priority Queue** | 5-dimension urgency review triage (P0 Critical, P1 High, P2 Routine) with cryptographic hash verification alerts. |
| **AI Disagreement Panel** | 5-dimension cross-signal conflict detection isolating uncorroborated outliers and human contestation workflows. |

---

## 🛠 Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.14 / 3.11+)
- **Database ORM:** SQLAlchemy with SQLite (zero-config demo mode) & PostgreSQL support
- **Graph Engine:** Neo4j Client & In-Memory Topological Projection
- **Security:** Native `bcrypt` password hashing, Dual JWT (Access/Refresh), RBAC Middleware
- **Dossier Generation:** ReportLab PDF Engine (Section 65B Indian Evidence Act compliant)

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS + Custom CSS Dynamic Theming Token System
- **Graph Canvas:** React Flow with Custom Quality Ring & Typed Entity Nodes
- **Icons & UI:** Lucide React, Glassmorphism, Micro-animations

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.11+ (or 3.14)
- Node.js 18+ and npm

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Access the web portal at: [http://localhost:5173/](http://localhost:5173/)

### Realistic Demo Seeding
To populate the database with a pre-configured, realistic multi-jurisdictional financial fraud and hawala case:
```bash
cd backend
python scripts/seed_demo_case.py
```

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Senior Investigator** | `inspector.malhotra@delhipolice.gov.in` | `InvestigatorPass123!` | Full Case Dossier, ACH, Sandbox, Reports |
| **Chief Administrator** | `admin@tracex.gov.in` | `AdminPass123!` | Officer Management, Feature Flags, Theming, Audit Logs |
| **Field Investigator** | `officer.singh@delhipolice.gov.in` | `InvestigatorPass123!` | Assigned Case Workspace, Evidence Ingestion |
| **Independent Auditor** | `auditor@mha.gov.in` | `AuditorPass123!` | Read-only Oversight, Custody & Audit Verification |

**Primary Seeded Case:** `FIR-2026-DEL-8841` (*Operation Rupee Trail: Hawala & Shell Corporate Network*)

---

## 📊 Testing & Quality Assurance

### Run Backend Test Suite
```bash
cd backend
python -m pytest
```
*Result: 82 passed in ~50s (100% test pass rate)*

### Run Frontend Production Build
```bash
cd frontend
npm run build
```
*Result: 0 errors (1825 modules transformed)*

---

## 🔒 Security, Chain of Custody & Compliance

- **Cryptographic Hash Verification:** Every ingested evidence document is assigned an immutable SHA-256 digest with tamper-detection alert workflows.
- **Section 65B Indian Evidence Act Compliance:** Generates signed chain-of-custody timestamps, officer clearance IDs, and export logs.
- **Role-Based Scoping:** Strict tenancy and role validation ensuring auditors cannot modify live investigation state and junior officers cannot finalize hypotheses without supervisor sign-off.

---

## 📜 License
Developed for Law Enforcement & Relational Intelligence Research. All rights reserved.
