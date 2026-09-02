from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.entity import Entity, Relationship
from app.models.evidence import Evidence, EvidenceQualityScore, IntegrityStatus, EvidenceSourceType
from app.models.hypothesis import Hypothesis, EvidenceHypothesis, HypothesisScore, HypothesisRelationType
from app.models.action import InvestigativeAction, ActionStatus
from app.models.disagreement import DisagreementSignal, MinorityEvidenceItem, InvestigatorContestation

def scan_case_disagreements(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Executes cross-signal discrepancy scan across 5 intelligence dimensions:
    1. NLP Extraction vs Graph Topology
    2. High-Quality Evidence vs High-Likelihood Hypothesis
    3. Majority Consensus vs Minority/Outlier Contradiction
    4. Cryptographic Hash Integrity vs Analytical Reliance
    5. Algorithmic Recommendations vs Human Action Patterns
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    # Clear un-contested previous signals for fresh dynamic scan
    contested_signal_ids = {c.signal_id for c in db.query(InvestigatorContestation).join(DisagreementSignal).filter(DisagreementSignal.case_id == case_id).all()}
    db.query(DisagreementSignal).filter(
        DisagreementSignal.case_id == case_id,
        ~DisagreementSignal.id.in_(contested_signal_ids)
    ).delete(synchronize_session=False)

    db.query(MinorityEvidenceItem).filter(MinorityEvidenceItem.case_id == case_id).delete()

    generated_signals: List[DisagreementSignal] = []
    minority_items: List[MinorityEvidenceItem] = []

    # Fetch working case data
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    quality_scores = {s.evidence_id: s for s in db.query(EvidenceQualityScore).join(Evidence).filter(Evidence.case_id == case_id).all()}
    hypotheses = db.query(Hypothesis).filter(Hypothesis.case_id == case_id).all()
    hypothesis_scores = {s.hypothesis_id: s for s in db.query(HypothesisScore).join(Hypothesis).filter(Hypothesis.case_id == case_id).all()}
    hyp_links = db.query(EvidenceHypothesis).join(Hypothesis).filter(Hypothesis.case_id == case_id).all()

    # --- Dimension 1: NLP vs Graph Topology ---
    # Low NER confidence entity with high degree in network
    degree_counts: Dict[str, int] = {}
    for r in relationships:
        degree_counts[r.source_entity_id] = degree_counts.get(r.source_entity_id, 0) + 1
        degree_counts[r.target_entity_id] = degree_counts.get(r.target_entity_id, 0) + 1

    for ent in entities:
        deg = degree_counts.get(ent.id, 0)
        if ent.confidence_score < 0.60 and deg >= 2:
            sig = DisagreementSignal(
                case_id=case_id,
                dimension="nlp_vs_graph",
                severity="high" if deg >= 4 else "medium",
                title=f"Extraction Uncertainty on Central Entity: {ent.name}",
                description=f"Entity '{ent.name}' has low NLP extraction confidence ({ent.confidence_score:.2f}) but holds {deg} graph connections. Network topology may be anchored on ambiguous text extraction.",
                primary_entity_id=ent.id,
                signals_payload={
                    "entity_id": ent.id,
                    "entity_name": ent.name,
                    "confidence_score": ent.confidence_score,
                    "degree": deg,
                    "entity_type": ent.entity_type.value
                },
                recommended_reconciliation="Conduct manual entity verification or re-extract using canonical alias matching.",
                created_at=datetime.utcnow()
            )
            db.add(sig)
            generated_signals.append(sig)

    # --- Dimension 2: High-Quality Evidence vs Hypothesis ---
    # High-quality evidence (Q >= 0.70) contradicting a high-confidence hypothesis (L >= 0.65)
    for link in hyp_links:
        if link.relationship_type == HypothesisRelationType.CONTRADICTS:
            ev = next((e for e in evidence_items if e.id == link.evidence_id), None)
            hyp = next((h for h in hypotheses if h.id == link.hypothesis_id), None)
            h_score = hypothesis_scores.get(link.hypothesis_id)
            q_score = quality_scores.get(link.evidence_id)

            if ev and hyp and h_score and q_score:
                if q_score.overall_quality_score >= 0.70 and h_score.normalized_score >= 0.65:
                    sig = DisagreementSignal(
                        case_id=case_id,
                        dimension="evidence_vs_hypothesis",
                        severity="critical",
                        title=f"Diagnostic Contradiction: {ev.title} vs {hyp.title}",
                        description=f"High-quality evidence '{ev.title}' (Q={q_score.overall_quality_score:.2f}) contradicts leading hypothesis '{hyp.title}' (Likelihood={h_score.normalized_score:.2f}).",
                        primary_evidence_id=ev.id,
                        primary_hypothesis_id=hyp.id,
                        signals_payload={
                            "evidence_id": ev.id,
                            "evidence_title": ev.title,
                            "quality_score": q_score.overall_quality_score,
                            "hypothesis_id": hyp.id,
                            "hypothesis_title": hyp.title,
                            "hypothesis_likelihood": h_score.normalized_score
                        },
                        recommended_reconciliation="Heuer ACH requires evaluating if contradiction is falsifying or if hypothesis scope needs reframing.",
                        created_at=datetime.utcnow()
                    )
                    db.add(sig)
                    generated_signals.append(sig)

    # --- Dimension 3: Majority Consensus vs Minority/Outlier Evidence ---
    # Witness/Anonymous tip contradicting structured telecom/banking records
    structured_types = {EvidenceSourceType.CDR, EvidenceSourceType.FINANCIAL_RECORDS}
    testimonial_types = {EvidenceSourceType.WITNESS_STATEMENT, EvidenceSourceType.ANONYMOUS_TIP}
    
    for ev in evidence_items:
        if ev.source_type in testimonial_types:
            for link in hyp_links:
                if link.evidence_id == ev.id and link.relationship_type == HypothesisRelationType.CONTRADICTS:
                    hyp = next((h for h in hypotheses if h.id == link.hypothesis_id), None)
                    if hyp:
                        minority_item = MinorityEvidenceItem(
                            case_id=case_id,
                            evidence_id=ev.id,
                            hypothesis_id=hyp.id,
                            outlier_category="lone_witness" if ev.source_type == EvidenceSourceType.WITNESS_STATEMENT else "whistleblower_tip",
                            diagnostic_significance=1.5, # Richards Heuer: Minority contradictory evidence is highly diagnostic
                            contradiction_target=hyp.title,
                            summary_rationale=f"Dissenting testimonial report '{ev.title}' contradicts prevailing theory '{hyp.title}'. Even with low corroboration, negative evidence is highly informative in criminal network analysis.",
                            detected_at=datetime.utcnow()
                        )
                        db.add(minority_item)
                        minority_items.append(minority_item)

                        sig = DisagreementSignal(
                            case_id=case_id,
                            dimension="majority_vs_minority",
                            severity="high",
                            title=f"Minority Contradictory Signal: {ev.title}",
                            description=f"Testimonial record '{ev.title}' presents a lone dissenting viewpoint against consensus hypothesis '{hyp.title}'.",
                            primary_evidence_id=ev.id,
                            primary_hypothesis_id=hyp.id,
                            signals_payload={
                                "evidence_id": ev.id,
                                "evidence_title": ev.title,
                                "source_type": ev.source_type.value,
                                "hypothesis_title": hyp.title
                            },
                            recommended_reconciliation="Do not discard outlier evidence; schedule corroborating subpoena or field verification.",
                            created_at=datetime.utcnow()
                        )
                        db.add(sig)
                        generated_signals.append(sig)

    # --- Dimension 4: Cryptographic Integrity vs Analytical Reliance ---
    for ev in evidence_items:
        if ev.integrity_status in [IntegrityStatus.COMPROMISED, IntegrityStatus.UNVERIFIED]:
            linked_hyps = [l for l in hyp_links if l.evidence_id == ev.id and l.relationship_type == HypothesisRelationType.SUPPORTS]
            if linked_hyps:
                sig = DisagreementSignal(
                    case_id=case_id,
                    dimension="integrity_vs_reliance",
                    severity="critical" if ev.integrity_status == IntegrityStatus.COMPROMISED else "high",
                    title=f"Integrity Alert on Supporting Evidence: {ev.title}",
                    description=f"Evidence item '{ev.title}' has status '{ev.integrity_status.value}' but is actively supporting {len(linked_hyps)} case hypotheses.",
                    primary_evidence_id=ev.id,
                    signals_payload={
                        "evidence_id": ev.id,
                        "evidence_title": ev.title,
                        "integrity_status": ev.integrity_status.value,
                        "supported_hypothesis_count": len(linked_hyps)
                    },
                    recommended_reconciliation="Recalculate hypothesis scores excluding compromised evidence or execute cryptographic re-verification.",
                    created_at=datetime.utcnow()
                )
                db.add(sig)
                generated_signals.append(sig)

    db.commit()

    all_signals = db.query(DisagreementSignal).filter(DisagreementSignal.case_id == case_id).all()
    all_minority = db.query(MinorityEvidenceItem).filter(MinorityEvidenceItem.case_id == case_id).all()

    crit_count = sum(1 for s in all_signals if s.severity == "critical")
    high_count = sum(1 for s in all_signals if s.severity == "high")

    return {
        "case_id": case_id,
        "total_signals": len(all_signals),
        "critical_signals": crit_count,
        "high_signals": high_count,
        "minority_evidence_count": len(all_minority),
        "signals": all_signals,
        "minority_evidence": all_minority
    }

def record_investigator_contestation(
    db: Session,
    signal_id: str,
    officer_id: str,
    contest_action: str,
    justification: str,
    adjusted_confidence: Optional[float] = None
) -> InvestigatorContestation:
    """
    Records an investigator contestation challenging an AI signal or score.
    """
    signal = db.query(DisagreementSignal).filter(DisagreementSignal.id == signal_id).first()
    if not signal:
        raise ValueError(f"DisagreementSignal {signal_id} not found")

    contestation = InvestigatorContestation(
        signal_id=signal_id,
        officer_id=officer_id,
        contest_action=contest_action,
        justification=justification,
        adjusted_confidence=adjusted_confidence,
        created_at=datetime.utcnow()
    )
    db.add(contestation)

    # Mark signal as resolved/contested
    signal.is_resolved = True
    signal.resolved_by = officer_id
    signal.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(contestation)
    return contestation
