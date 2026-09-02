from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.user import User, UserRole
from app.models.resilience import ResilienceTestRun, ResilienceNodeMetric, ResilienceMonteCarloRun
from app.schemas.resilience import (
    ResilienceRunRequest,
    ResilienceTestRunResponse,
    ResilienceNodeMetricResponse,
    ResilienceMonteCarloRequest,
    ResilienceMonteCarloResponse
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.resilience_engine import (
    run_resilience_test,
    run_monte_carlo_resilience
)

router = APIRouter()

@router.post("/cases/{case_id}/resilience/run", response_model=ResilienceTestRunResponse, status_code=status.HTTP_201_CREATED)
def execute_resilience_test(
    case_id: str,
    run_in: ResilienceRunRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger resilience runs.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        res = run_resilience_test(
            db=db,
            case_id=case_id,
            user_id=current_user.id,
            test_type=run_in.test_type,
            target_entity_ids=run_in.target_entity_ids,
            removal_fraction=run_in.removal_fraction or 0.2,
            simulate_compromised_cascade=run_in.simulate_compromised_cascade
        )

        log_audit_event(
            db=db,
            action="RUN_RESILIENCE_TEST",
            resource_type="resilience_test_run",
            resource_id=res["run_id"],
            user=current_user,
            case_id=case_id,
            details={"test_type": run_in.test_type, "fragmentation_index": res["fragmentation_index"]},
            request=request
        )

        run_record = db.query(ResilienceTestRun).filter(ResilienceTestRun.id == res["run_id"]).first()
        return run_record
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/cases/{case_id}/resilience/latest", response_model=ResilienceTestRunResponse)
def get_latest_resilience_test(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    run_record = db.query(ResilienceTestRun).filter(
        ResilienceTestRun.case_id == case_id
    ).order_by(ResilienceTestRun.created_at.desc()).first()

    if not run_record:
        # Run default baseline test
        res = run_resilience_test(
            db=db,
            case_id=case_id,
            user_id=current_user.id,
            test_type="node_removal",
            removal_fraction=0.2
        )
        run_record = db.query(ResilienceTestRun).filter(ResilienceTestRun.id == res["run_id"]).first()

    return run_record

@router.get("/cases/{case_id}/resilience/node-metrics", response_model=List[ResilienceNodeMetricResponse])
def list_resilience_node_metrics(
    case_id: str,
    classification: Optional[str] = Query(None, description="Filter by STABLE, SENSITIVE, FRAGILE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    latest_run = db.query(ResilienceTestRun).filter(
        ResilienceTestRun.case_id == case_id
    ).order_by(ResilienceTestRun.created_at.desc()).first()

    if not latest_run:
        return []

    q = db.query(ResilienceNodeMetric).filter(ResilienceNodeMetric.run_id == latest_run.id)
    if classification:
        q = q.filter(ResilienceNodeMetric.stability_classification == classification.upper())

    return q.order_by(ResilienceNodeMetric.disruption_impact_score.desc()).all()

@router.post("/cases/{case_id}/resilience/monte-carlo", response_model=ResilienceMonteCarloResponse, status_code=status.HTTP_201_CREATED)
def execute_monte_carlo(
    case_id: str,
    mc_in: ResilienceMonteCarloRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger Monte Carlo simulations.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    res = run_monte_carlo_resilience(
        db=db,
        case_id=case_id,
        seed=mc_in.seed or 42,
        iterations=mc_in.iterations or 50,
        perturbation_rate=mc_in.perturbation_rate or 0.15
    )

    log_audit_event(
        db=db,
        action="RUN_MONTE_CARLO_RESILIENCE",
        resource_type="resilience_monte_carlo",
        resource_id=res["id"],
        user=current_user,
        case_id=case_id,
        details={"seed": res["seed"], "mean_fragmentation": res["mean_fragmentation"]},
        request=request
    )
    return res
