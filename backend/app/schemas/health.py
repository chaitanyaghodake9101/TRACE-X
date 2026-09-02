from pydantic import BaseModel
from typing import Dict, Any

class HealthResponse(BaseModel):
    status: str
    version: str
    database: Dict[str, Any]
    neo4j: Dict[str, Any]
