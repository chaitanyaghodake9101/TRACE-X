import uuid
import pytest
from app.services.event_publisher import publish_domain_event, process_pending_outbox_events
from app.models.events import DomainOutboxEvent, ProcessedEvent, DeadLetterEvent

def test_publish_and_process_outbox_events(db_session):
    test_agg_id = str(uuid.uuid4())
    
    # 1. Publish Domain Event
    event = publish_domain_event(
        db=db_session,
        event_type="evidence.uploaded.v1",
        aggregate_id=test_agg_id,
        aggregate_type="evidence",
        payload={"title": "Test Evidence", "sha256": "abcdef123456"}
    )
    db_session.commit()
    assert event.status == "pending"
    assert event.retry_count == 0

    # 2. Run Outbox Background Worker
    result = process_pending_outbox_events(db=db_session)
    assert result["processed_count"] >= 1

    db_session.refresh(event)
    assert event.status == "published"
    assert event.published_at is not None

    # 3. Verify ProcessedEvent Idempotency Record
    proc_record = (
        db_session.query(ProcessedEvent)
        .filter(ProcessedEvent.event_id == event.id)
        .first()
    )
    assert proc_record is not None
    assert proc_record.consumer_name == "primary_projection_worker"

def test_outbox_idempotency_protection(db_session):
    test_agg_id = str(uuid.uuid4())
    event = publish_domain_event(
        db=db_session,
        event_type="evidence.uploaded.v1",
        aggregate_id=test_agg_id,
        aggregate_type="evidence",
        payload={"title": "Idempotent Check"}
    )
    db_session.commit()

    # Process first time
    process_pending_outbox_events(db=db_session)
    
    # Force status back to pending to simulate worker retry
    event.status = "pending"
    db_session.commit()

    # Process second time
    result2 = process_pending_outbox_events(db=db_session)
    # Must succeed without duplicating processed_events records
    proc_records = (
        db_session.query(ProcessedEvent)
        .filter(ProcessedEvent.event_id == event.id)
        .all()
    )
    assert len(proc_records) == 1

def test_dead_letter_queue_routing(db_session):
    test_agg_id = str(uuid.uuid4())
    event = publish_domain_event(
        db=db_session,
        event_type="corrupted.event.v1",
        aggregate_id=test_agg_id,
        aggregate_type="test",
        payload={}
    )
    event.status = "failed"
    event.retry_count = 5 # At threshold
    db_session.commit()

    # Create dead letter record
    dlq_entry = DeadLetterEvent(
        event_id=event.id,
        event_type=event.event_type,
        payload_json=event.payload_json,
        error_message="Simulated permanent network exception after 5 retries",
        resolved=False
    )
    db_session.add(dlq_entry)
    db_session.commit()

    # Verify DLQ entry exists
    found_dlq = (
        db_session.query(DeadLetterEvent)
        .filter(DeadLetterEvent.event_id == event.id)
        .first()
    )
    assert found_dlq is not None
    assert found_dlq.resolved is False

def test_evidence_ingestion_and_tamper_outbox_integration(client, db_session):
    # 1. Login user
    unique_email = f"outbox.investigator.{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "Password123!",
            "full_name": "Outbox Specialist",
            "role": "senior_investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "Password123!"}
    )
    token = login_res.json()["access_token"]

    # 2. Create case
    case_res = client.post(
        "/api/v1/cases/",
        json={"title": "Outbox Integration Case", "case_number": f"FIR-OBX-{uuid.uuid4().hex[:4].upper()}"},
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # 3. Ingest evidence
    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={"title": "Outbox Test Document", "source_type": "fir", "extracted_text": "Sample text"},
        headers={"Authorization": f"Bearer {token}"}
    )
    ev_id = ev_res.json()["id"]

    # Verify outbox event created
    ev_outbox = (
        db_session.query(DomainOutboxEvent)
        .filter(DomainOutboxEvent.aggregate_id == ev_id, DomainOutboxEvent.event_type == "evidence.uploaded.v1")
        .first()
    )
    assert ev_outbox is not None

    # 4. Simulate tampering
    client.post(
        f"/api/v1/evidence/{ev_id}/simulate-tamper",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Verify critical mismatch outbox event created
    tamper_outbox = (
        db_session.query(DomainOutboxEvent)
        .filter(DomainOutboxEvent.aggregate_id == ev_id, DomainOutboxEvent.event_type == "evidence.integrity_mismatch_detected.v1")
        .first()
    )
    assert tamper_outbox is not None
    assert tamper_outbox.payload_json["data"]["status"] == "COMPROMISED"
