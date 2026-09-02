from datetime import datetime, timedelta
from app.models.evidence import EvidenceSourceType
from app.api.v1.endpoints.evidence import calculate_evidence_quality

def test_evidence_quality_scoring_dimensions():
    # Test FIR high reliability
    score_fir = calculate_evidence_quality(
        source_type=EvidenceSourceType.FIR,
        event_timestamp=datetime.utcnow() - timedelta(days=2),
        extracted_text="Detailed FIR text describing suspect location and phone number " * 10,
        corroborating_sources_count=2
    )
    assert score_fir["source_reliability_score"] == 0.90
    assert score_fir["cross_corroboration_score"] >= 0.70
    assert score_fir["overall_quality_score"] >= 0.70  # Should be classified as high quality

    # Test Anonymous Tip low reliability
    score_tip = calculate_evidence_quality(
        source_type=EvidenceSourceType.ANONYMOUS_TIP,
        event_timestamp=datetime.utcnow() - timedelta(days=60),
        extracted_text="Brief tip",
        corroborating_sources_count=0
    )
    assert score_tip["source_reliability_score"] == 0.20
    assert score_tip["overall_quality_score"] < 0.45   # Low/Medium
