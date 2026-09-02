import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.case import Case, CaseStatus, CasePriority
from app.models.evidence import Evidence, EvidenceSourceType, IntegrityStatus, CustodyEvent
from app.models.entity import Entity, EntityType, Relationship, RelationshipType
from app.models.hypothesis import Hypothesis, HypothesisStatus, EvidenceHypothesis, HypothesisRelationType
from app.models.action import InvestigativeAction, ActionType, ActionStatus
from app.models.officer_extension import CaseMembership
from app.services.quality_engine import recalculate_case_evidence_quality
from app.services.hypothesis_engine import recalculate_case_hypotheses
from app.services.action_engine import prioritize_case_actions

def create_sample_case():
    db = SessionLocal()
    try:
        senior_inv = db.query(User).filter(User.role == UserRole.SENIOR_INVESTIGATOR).first()
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()

        if not senior_inv or not admin_user:
            print("[!] Default users not found. Run seed script first.")
            return

        case_number = "FIR-2026-MUM-4102"
        existing = db.query(Case).filter(Case.case_number == case_number).first()
        if existing:
            print(f"[*] Case {case_number} already exists, deleting for fresh creation...")
            db.query(CaseMembership).filter(CaseMembership.case_id == existing.id).delete()
            db.delete(existing)
            db.commit()

        # 1. Create Case
        case = Case(
            case_number=case_number,
            title="Operation Cyber Shield: Deepfake Extortion & Crypto Laundering Network",
            description="Multi-jurisdiction cyber syndicate deploying AI-generated voice deepfakes for corporate extortion, layered through decentralized Monero/USDT mixers.",
            status=CaseStatus.UNDER_INVESTIGATION,
            priority=CasePriority.CRITICAL,
            created_by=admin_user.id,
            assigned_to=senior_inv.id
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        case_id = case.id
        print(f"[+] Created Case: {case.title} ({case.case_number})")

        # 2. Case Membership
        mem = CaseMembership(
            case_id=case_id,
            user_id=senior_inv.id,
            assignment_role="lead",
            is_active=True,
            assigned_by=admin_user.id,
            assigned_at=datetime.utcnow()
        )
        db.add(mem)
        db.commit()

        # 3. Add Evidence
        ev1 = Evidence(
            case_id=case_id,
            title="Extortion Call Audio Recording & Voice Spectral Log",
            description="High-frequency acoustic audio file captured from victim corporate executive detailing ₹2.8 Cr extortion demand.",
            source_type=EvidenceSourceType.WITNESS_STATEMENT,
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_path="/secure_vault/mum/audio/extortion_call_01.wav",
            uploaded_by=senior_inv.id,
            event_timestamp=datetime.utcnow() - timedelta(days=2),
            integrity_status=IntegrityStatus.VERIFIED
        )

        ev2 = Evidence(
            case_id=case_id,
            title="Decentralized Crypto Mixer Ledger (USDT / Monero Transaction Trace)",
            description="On-chain telemetry showing 350,000 USDT routed through non-custodial smart contract mixer to unhosted cold wallet.",
            source_type=EvidenceSourceType.FINANCIAL_RECORDS,
            sha256_hash="8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
            file_path="/secure_vault/mum/financial/mixer_trace.csv",
            uploaded_by=senior_inv.id,
            event_timestamp=datetime.utcnow() - timedelta(days=3),
            integrity_status=IntegrityStatus.VERIFIED
        )
        db.add_all([ev1, ev2])
        db.commit()
        db.refresh(ev1)
        db.refresh(ev2)
        print("  [+] Ingested 2 Forensic Evidence Items with Cryptographic Hashes.")

        # 4. Add Entities & Relationships
        ent1 = Entity(case_id=case_id, name="Aryan Shinde", canonical_name="Aryan Shinde", entity_type=EntityType.PERSON, confidence_score=0.95, attributes_json={"role": "Lead Synthesizer"})
        ent2 = Entity(case_id=case_id, name="Kavita Rao", canonical_name="Kavita Rao", entity_type=EntityType.PERSON, confidence_score=0.90, attributes_json={"role": "Account Holder"})
        ent3 = Entity(case_id=case_id, name="DarkPool Mixer Node #4", canonical_name="DarkPool Mixer Node #4", entity_type=EntityType.ORGANIZATION, confidence_score=0.88, attributes_json={"protocol": "Monero/USDT"})
        db.add_all([ent1, ent2, ent3])
        db.commit()
        db.refresh(ent1)
        db.refresh(ent2)
        db.refresh(ent3)

        rel1 = Relationship(case_id=case_id, source_entity_id=ent1.id, target_entity_id=ent2.id, relationship_type=RelationshipType.CONNECTED_TO, confidence_score=0.89, weight=0.89)
        rel2 = Relationship(case_id=case_id, source_entity_id=ent2.id, target_entity_id=ent3.id, relationship_type=RelationshipType.TRANSFERRED_TO, confidence_score=0.95, weight=0.95)
        db.add_all([rel1, rel2])
        db.commit()
        print("  [+] Added 3 Relational Graph Entities & 2 Edge Links.")

        # 5. Calculate 4D Evidence Quality
        recalculate_case_evidence_quality(db, case_id)
        print("  [+] Evaluated 4D Quality Scores with Temporal Decay.")

        # 6. Add Heuer Competing Hypotheses (ACH)
        h1 = Hypothesis(case_id=case_id, title="Coordinated International AI Deepfake Syndicate", description="Organized cyber syndicate utilizing generative speech synthesis to extort multinational firms.", status=HypothesisStatus.ACTIVE, created_by=senior_inv.id)
        h2 = Hypothesis(case_id=case_id, title="Disgruntled Internal IT Insider Impersonation", description="Former disgruntled system administrator using internal knowledge to simulate corporate executives.", status=HypothesisStatus.ACTIVE, created_by=senior_inv.id)
        db.add_all([h1, h2])
        db.commit()
        db.refresh(h1)
        db.refresh(h2)

        link1 = EvidenceHypothesis(hypothesis_id=h1.id, evidence_id=ev1.id, relationship_type=HypothesisRelationType.SUPPORTS, relationship_strength=0.90, rationale="Acoustic harmonics show artifacts consistent with GAN neural synthesis models.", linked_by=senior_inv.id)
        link2 = EvidenceHypothesis(hypothesis_id=h1.id, evidence_id=ev2.id, relationship_type=HypothesisRelationType.SUPPORTS, relationship_strength=0.95, rationale="Multi-hop Monero mixing matches syndicate modus operandi.", linked_by=senior_inv.id)
        link3 = EvidenceHypothesis(hypothesis_id=h2.id, evidence_id=ev2.id, relationship_type=HypothesisRelationType.CONTRADICTS, relationship_strength=0.85, rationale="Insiders rarely utilize multi-hop cross-chain liquidity contracts.", linked_by=senior_inv.id)
        db.add_all([link1, link2, link3])
        db.commit()

        recalculate_case_hypotheses(db, case_id)
        print("  [+] Evaluated Heuer ACH Matrix with 1.5x Contradiction Penalty.")

        # 7. Add VoI Actions
        act1 = InvestigativeAction(
            case_id=case_id,
            title="Subpoena Exchange KYC on Mixer Liquidity Off-Ramp",
            description="Serve Section 91 CrPC legal summons to Indian crypto exchange for KYC identity tied to off-ramp bank accounts.",
            action_type=ActionType.OBTAIN_FINANCIAL_RECORDS,
            status=ActionStatus.PENDING,
            target_entity_id=ent2.id,
            assigned_to=senior_inv.id,
            base_gain=0.90
        )
        act2 = InvestigativeAction(
            case_id=case_id,
            title="Forensic Audio Spectral Extraction & Voice Print Matching",
            description="Run forensic speech biometric decomposition to match Aryan Shinde's verified voice samples with synthetic speech base.",
            action_type=ActionType.FORENSIC_ANALYSIS,
            status=ActionStatus.PENDING,
            target_entity_id=ent1.id,
            assigned_to=senior_inv.id,
            base_gain=0.85
        )
        db.add_all([act1, act2])
        db.commit()

        prioritize_case_actions(db, case_id)
        print("  [+] Calculated Value-of-Information (VoI) Ranked Investigative Actions.")

        print(f"\n[SUCCESS] New Case ({case_number}) Created & Ready in TRACE-X!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Case creation failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_case()
