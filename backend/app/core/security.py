import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union, Tuple
import bcrypt
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Hardened security defaults
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # Short-lived access token (§4.C.3)
REFRESH_TOKEN_EXPIRE_DAYS = 7

def hash_token(raw_token: str) -> str:
    """Computes SHA-256 digest of a raw token for secure storage at rest."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

def generate_secure_token() -> Tuple[str, str]:
    """Generates a CSPRNG token (256 bits entropy) and returns (raw_token, token_hash)."""
    raw_token = secrets.token_urlsafe(32)
    return raw_token, hash_token(raw_token)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Timing-safe password verification supporting bcrypt."""
    try:
        plain_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        # Dummy calculation to prevent timing side-channel
        dummy_salt = b'$2b$12$e8YkYgD4R6m7j9l8k0n2eO'
        dummy_hash = b'$2b$12$e8YkYgD4R6m7j9l8k0n2eO5s9q3r7v1w5x9z3b7d1f5h9j3l7n1p3'
        try:
            bcrypt.checkpw(b'dummy_password_timing_pad', dummy_hash)
        except Exception:
            pass
        return False

def get_password_hash(password: str) -> str:
    """Computes a cryptographically salted password hash."""
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access",
        "jti": secrets.token_hex(16)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "jti": secrets.token_hex(16)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str, expected_type: str = "access") -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type = payload.get("type", "access")
        if token_type != expected_type:
            return None
        return payload
    except JWTError:
        return None

def decode_access_token(token: str) -> Optional[dict]:
    return decode_token(token, expected_type="access")

def decode_refresh_token(token: str) -> Optional[dict]:
    return decode_token(token, expected_type="refresh")
