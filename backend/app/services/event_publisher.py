import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.events import DomainOutboxEvent, ProcessedEvent, DeadLetterEvent

def publish_domain_event(
    db: Session,
    event_type: str,
    aggregate_id: str,
    aggregate_type: str,
    payload: Dict[str, Any],
    actor_id: Optional[str] = None
) -> DomainOutboxEvent:
    """
    Inserts a versioned domain event atomically into the PostgreSQL / SQLite outbox.
    Ensures transactional consistency (Source of Truth in Relational DB).
    """
    event_id = str(uuid.uuid4())
    enriched_payload = {
        "event_id": event_id,
        "event_type": event_type,
        "aggregate_id": aggregate_id,
        "aggregate_type": aggregate_type,
        "actor_id": actor_id,
        "timestamp": datetime.utcnow().isoformat(),
        "data": payload
    }

    outbox_event = DomainOutboxEvent(
        id=event_id,
        event_type=event_type,
        aggregate_id=aggregate_id,
        aggregate_type=aggregate_type,
        payload_json=enriched_payload,
        status="pending",
        retry_count=0
    )
    db.add(outbox_event)
    return outbox_event

def process_pending_outbox_events(db: Session, max_batch: int = 50) -> Dict[str, Any]:
    """
    Background worker process to dispatch pending outbox events idempotently.
    Dispatches to registered consumers and records processing history.
    """
    pending_events = (
        db.query(DomainOutboxEvent)
        .filter(DomainOutboxEvent.status.in_(["pending", "failed"]))
        .filter(DomainOutboxEvent.retry_count < 5)
        .order_by(DomainOutboxEvent.created_at.asc())
        .limit(max_batch)
        .all()
    )

    processed_count = 0
    failed_count = 0

    for ev in pending_events:
        ev.status = "processing"
        db.commit()

        try:
            # Check idempotency
            existing_proc = (
                db.query(ProcessedEvent)
                .filter(
                    ProcessedEvent.event_id == ev.id,
                    ProcessedEvent.consumer_name == "primary_projection_worker"
                )
                .first()
            )

            if not existing_proc:
                # Dispatch event logic (e.g. Neo4j graph projection, real-time WebSocket push)
                _dispatch_event_to_subscribers(ev)

                # Record processed event for idempotency
                db.add(ProcessedEvent(
                    event_id=ev.id,
                    consumer_name="primary_projection_worker",
                    processed_at=datetime.utcnow()
                ))

            ev.status = "published"
            ev.published_at = datetime.utcnow()
            processed_count += 1
            db.commit()

        except Exception as err:
            ev.retry_count += 1
            ev.error_message = str(err)
            ev.status = "failed"
            failed_count += 1
            
            if ev.retry_count >= 5:
                # Route to Dead Letter Queue (§4.A)
                db.add(DeadLetterEvent(
                    event_id=ev.id,
                    event_type=ev.event_type,
                    payload_json=ev.payload_json,
                    error_message=str(err),
                    resolved=False
                ))
            db.commit()

    return {
        "batch_size": len(pending_events),
        "processed_count": processed_count,
        "failed_count": failed_count
    }

def _dispatch_event_to_subscribers(event: DomainOutboxEvent):
    """Internal event routing hook (WebSocket / Neo4j / Background jobs)."""
    # Real-time WebSocket dispatcher hook
    try:
        from app.api.v1.endpoints.ws import broadcast_event_sync
        broadcast_event_sync(event.payload_json)
    except Exception:
        pass
