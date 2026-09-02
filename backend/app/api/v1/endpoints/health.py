from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.neo4j import neo4j_client
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def get_health_status(db: Session = Depends(get_db)):
    # Check SQL database
    db_status = "connected"
    db_type = "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Check Neo4j
    neo4j_status = "connected" if neo4j_client.is_connected else "disconnected_or_offline_fallback"

    overall_status = "healthy" if db_status == "connected" else "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.VERSION,
        database={"type": db_type, "status": db_status},
        neo4j={"uri": settings.NEO4J_URI, "status": neo4j_status}
    )
