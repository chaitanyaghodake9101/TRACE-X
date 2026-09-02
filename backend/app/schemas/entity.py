from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from app.models.entity import EntityType, RelationshipType

class EntityBase(BaseModel):
    name: str
    entity_type: EntityType
    canonical_name: Optional[str] = None
    confidence_score: float = 1.0
    attributes_json: Optional[Dict[str, Any]] = None

class EntityCreate(EntityBase):
    pass

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    canonical_name: Optional[str] = None
    confidence_score: Optional[float] = None
    attributes_json: Optional[Dict[str, Any]] = None

class EntityOut(EntityBase):
    id: str
    case_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RelationshipBase(BaseModel):
    source_entity_id: str
    target_entity_id: str
    relationship_type: RelationshipType
    weight: float = 1.0
    confidence_score: float = 1.0
    attributes_json: Optional[Dict[str, Any]] = None

class RelationshipCreate(RelationshipBase):
    pass

class RelationshipOut(RelationshipBase):
    id: str
    case_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DuplicateCandidateOut(BaseModel):
    primary_entity_id: str
    primary_name: str
    primary_canonical_name: Optional[str] = None
    secondary_entity_id: str
    secondary_name: str
    secondary_canonical_name: Optional[str] = None
    entity_type: str
    similarity_score: float
    match_reason: str

class EntityMergeRequest(BaseModel):
    primary_entity_id: str
    secondary_entity_ids: List[str]

class AutoResolveOut(BaseModel):
    resolved_pairs_count: int
    merged_entities: List[EntityOut]

class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    quality_score: Optional[float] = None
    properties: Dict[str, Any] = {}

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    properties: Dict[str, Any] = {}

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
