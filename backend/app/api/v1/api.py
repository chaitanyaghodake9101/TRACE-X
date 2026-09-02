from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    cases,
    evidence,
    entities,
    graph,
    hypotheses,
    actions,
    reports,
    admin,
    help,
    ws,
    simulations,
    resilience_tests,
    review_priorities,
    review_tasks,
    disagreements,
    officer_extensions,
    content_cms,
    tutorials,
    theme,
    feature_flags
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(evidence.router, tags=["Evidence & Quality"])
api_router.include_router(entities.router, tags=["Entities & Relationships"])
api_router.include_router(graph.router, tags=["Graph Analytics"])
api_router.include_router(hypotheses.router, tags=["Competing Hypotheses"])
api_router.include_router(actions.router, tags=["Information Gain Actions"])
api_router.include_router(reports.router, tags=["Reports"])
api_router.include_router(admin.router, tags=["Admin Operations"])
api_router.include_router(help.router, tags=["Help & Onboarding"])
api_router.include_router(ws.router, tags=["Real-Time WebSockets"])

# Investigation Intelligence Modules
api_router.include_router(simulations.router, tags=["Counterfactual Investigation Sandbox"])
api_router.include_router(resilience_tests.router, tags=["Network Resilience Analyzer"])
api_router.include_router(review_priorities.router, tags=["Evidence Decay & Review Priorities"])
api_router.include_router(review_tasks.router, tags=["Evidence Review Tasks"])
api_router.include_router(disagreements.router, tags=["AI Disagreement & Minority-Evidence Panel"])

# Extended Administration & CMS Modules
api_router.include_router(officer_extensions.router, tags=["Enhanced Officer Management"])
api_router.include_router(content_cms.router, tags=["Content CMS"])
api_router.include_router(tutorials.router, tags=["Tutorials"])
api_router.include_router(theme.router, tags=["Theme & Branding"])
api_router.include_router(feature_flags.router, tags=["Feature Flags"])
