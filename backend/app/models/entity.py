import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.orm import relationship as sa_relationship
import enum
from app.core.database import Base

class EntityType(str, enum.Enum):
    PERSON = "person"
    PHONE = "phone"
    VEHICLE = "vehicle"
    LOCATION = "location"
    ORGANIZATION = "organization"
    EVENT = "event"
    EVIDENCE = "evidence"
    OTHER = "other"

class RelationshipType(str, enum.Enum):
    CALLS = "CALLS"
    OWNS = "OWNS"
    VISITED = "VISITED"
    MENTIONED_IN = "MENTIONED_IN"
    CONNECTED_TO = "CONNECTED_TO"
    TRANSFERRED_TO = "TRANSFERRED_TO"
    PART_OF = "PART_OF"
    LOCATED_AT = "LOCATED_AT"
    COMMUNICATED_WITH = "COMMUNICATED_WITH"

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    entity_type = Column(SAEnum(EntityType), nullable=False, index=True)
    canonical_name = Column(String(255), nullable=True)
    confidence_score = Column(Float, default=1.0, nullable=False)
    attributes_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = sa_relationship("Case", back_populates="entities")
    outgoing_relationships = sa_relationship("Relationship", foreign_keys="Relationship.source_entity_id", back_populates="source_entity", cascade="all, delete-orphan")
    incoming_relationships = sa_relationship("Relationship", foreign_keys="Relationship.target_entity_id", back_populates="target_entity", cascade="all, delete-orphan")
    evidence_links = sa_relationship("EvidenceEntityLink", back_populates="entity", cascade="all, delete-orphan")

class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    source_entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    target_entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(SAEnum(RelationshipType), nullable=False, index=True)
    weight = Column(Float, default=1.0, nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=False)
    attributes_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = sa_relationship("Case", back_populates="relationships")
    source_entity = sa_relationship("Entity", foreign_keys=[source_entity_id], back_populates="outgoing_relationships")
    target_entity = sa_relationship("Entity", foreign_keys=[target_entity_id], back_populates="incoming_relationships")
    evidence_links = sa_relationship("RelationshipEvidenceLink", back_populates="rel", cascade="all, delete-orphan")

class EvidenceEntityLink(Base):
    __tablename__ = "evidence_entities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    confidence_score = Column(Float, default=1.0, nullable=False)
    extraction_method = Column(String(50), default="ner_automated", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    entity = sa_relationship("Entity", back_populates="evidence_links")
    evidence = sa_relationship("Evidence", backref="entity_links")

class RelationshipEvidenceLink(Base):
    __tablename__ = "relationship_evidence"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    relationship_id = Column(String(36), ForeignKey("relationships.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    support_weight = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    rel = sa_relationship("Relationship", back_populates="evidence_links")
    evidence = sa_relationship("Evidence", backref="relationship_links")
