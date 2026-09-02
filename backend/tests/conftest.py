import pytest
import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.models.user import User, UserRole
from app.core.security import get_password_hash, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_tracex.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        if os.path.exists("./test_tracex.db"):
            os.remove("./test_tracex.db")
    except Exception:
        pass

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_token(db_session):
    email = f"admin_{uuid.uuid4().hex[:6]}@tracex.gov.in"
    user = User(
        email=email,
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Chief Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return create_access_token(user.id)

@pytest.fixture
def auth_token(db_session):
    email = f"officer_{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    user = User(
        email=email,
        hashed_password=get_password_hash("OfficerPass123!"),
        full_name="Investigator Kumar",
        role=UserRole.INVESTIGATOR,
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return create_access_token(user.id)

@pytest.fixture
def auth_user(db_session):
    email = f"officer_{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    user = User(
        email=email,
        hashed_password=get_password_hash("OfficerPass123!"),
        full_name="Investigator Verma",
        role=UserRole.INVESTIGATOR,
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
