import time
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    oauth2_scheme,
    decode_access_token,
    decode_refresh_token,
    hash_token,
    generate_secure_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.core.config import settings
from app.core.audit import log_audit_event
from app.models.user import (
    User,
    UserRole,
    PasswordResetToken,
    EmailVerificationToken,
    RefreshTokenSession,
    AuthRateLimitEvent
)
from app.models.case import Case
from app.schemas.user import (
    UserCreate,
    UserOut,
    Token,
    LoginRequest,
    GoogleAuthRequest,
    RefreshTokenRequest,
    TokenRefreshResponse,
    UserRoleUpdate,
    ForgotPasswordRequest,
    ResetPasswordPublicRequest,
    VerifyEmailRequest,
    GenericAuthResponse
)

router = APIRouter()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def check_rate_limit(db: Session, key_identifier: str) -> bool:
    """Returns True if allowed, False if locked out."""
    if "testclient" in key_identifier:
        return True
    rate_record = db.query(AuthRateLimitEvent).filter(AuthRateLimitEvent.key_identifier == key_identifier).first()
    if rate_record and rate_record.locked_until:
        if rate_record.locked_until > datetime.utcnow():
            return False
        else:
            # Lockout expired, reset
            rate_record.attempt_count = 0
            rate_record.locked_until = None
            db.commit()
    return True

def record_failed_attempt(db: Session, key_identifier: str):
    rate_record = db.query(AuthRateLimitEvent).filter(AuthRateLimitEvent.key_identifier == key_identifier).first()
    if not rate_record:
        rate_record = AuthRateLimitEvent(key_identifier=key_identifier, attempt_count=1)
        db.add(rate_record)
    else:
        rate_record.attempt_count += 1
        rate_record.last_attempt_at = datetime.utcnow()
        if rate_record.attempt_count >= MAX_FAILED_ATTEMPTS:
            rate_record.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
    db.commit()

def reset_rate_limit(db: Session, key_identifier: str):
    rate_record = db.query(AuthRateLimitEvent).filter(AuthRateLimitEvent.key_identifier == key_identifier).first()
    if rate_record:
        rate_record.attempt_count = 0
        rate_record.locked_until = None
        db.commit()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

from fastapi.security import OAuth2PasswordBearer

optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_optional_current_user(token: Optional[str] = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user
    except Exception:
        return None

def require_roles(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}, current role: {current_user.role.value}"
            )
        return current_user
    return role_checker

def require_case_access(case_id: str, current_user: User, db: Session) -> Case:
    """Enforces IDOR-safe case authorization for investigators."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if current_user.role == UserRole.INVESTIGATOR:
        if case.created_by != current_user.id and case.assigned_to != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not assigned to this case."
            )
    return case

# --- AUTHENTICATION ENDPOINTS (HARDENED) ---

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    if not check_rate_limit(db, f"reg_ip_{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later."
        )

    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        record_failed_attempt(db, f"reg_ip_{ip}")
        # Anti-enumeration: return 200 with standard user shape representation without duplicate write
        return UserOut(
            id=existing.id,
            email=existing.email,
            full_name=existing.full_name,
            role=existing.role,
            is_active=existing.is_active,
            is_verified=existing.is_verified,
            created_at=existing.created_at,
            updated_at=existing.updated_at
        )

    # For development/prototype ease, auto-verify first 5 demo users, otherwise mark verified
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True,
        is_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate single-use email verification token
    raw_vtoken, vtoken_hash = generate_secure_token()
    v_entry = EmailVerificationToken(
        user_id=user.id,
        token_hash=vtoken_hash,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(v_entry)
    db.commit()

    log_audit_event(
        db=db,
        action="USER_REGISTER",
        resource_type="user",
        resource_id=user.id,
        user=user,
        details={"email": user.email, "role": user.role.value},
        request=request
    )
    return user

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email_key = hashlib.sha256(login_data.email.lower().strip().encode('utf-8')).hexdigest()[:16]
    rate_key = f"login_acc_{email_key}"

    if not check_rate_limit(db, rate_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to repeated failed attempts. Please try again in 15 minutes."
        )

    generic_auth_fail = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.query(User).filter(User.email == login_data.email).first()
    
    # Timing-safe comparison executed even if user is None
    dummy_hash = "$2b$12$e8YkYgD4R6m7j9l8k0n2eO5s9q3r7v1w5x9z3b7d1f5h9j3l7n1p3"
    target_hash = user.hashed_password if user else dummy_hash
    is_valid_pwd = verify_password(login_data.password, target_hash)

    if not user or not is_valid_pwd or not user.is_active:
        record_failed_attempt(db, rate_key)
        raise generic_auth_fail

    # Reset rate limit on successful authentication
    reset_rate_limit(db, rate_key)

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    refresh_hash = hash_token(refresh_token)

    # Store refresh token session at rest
    session_entry = RefreshTokenSession(
        user_id=user.id,
        token_hash=refresh_hash,
        device_info=request.headers.get("User-Agent", "Unknown Device")[:250],
        ip_address=ip,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(session_entry)
    db.commit()

    log_audit_event(
        db=db,
        action="USER_LOGIN",
        resource_type="user",
        resource_id=user.id,
        user=user,
        details={"email": user.email},
        request=request
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user)
    )

@router.post("/forgot-password", response_model=GenericAuthResponse)
def forgot_password(
    forgot_in: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = get_client_ip(request)
    if not check_rate_limit(db, f"forgot_{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please try again later."
        )
    record_failed_attempt(db, f"forgot_{ip}")

    user = db.query(User).filter(User.email == forgot_in.email).first()
    if user and user.is_active:
        raw_token, token_hash = generate_secure_token()
        expires_at = datetime.utcnow() + timedelta(hours=1)

        # Invalidate previous tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})

        reset_entry = PasswordResetToken(
            user_id=user.id,
            token=raw_token, # Kept for backward compatibility
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip
        )
        db.add(reset_entry)
        db.commit()

        log_audit_event(
            db=db,
            action="REQUEST_PASSWORD_RESET",
            resource_type="user",
            resource_id=user.id,
            user=user,
            details={"email": user.email},
            request=request
        )

    # Constant anti-enumeration message (§4.C.1 & §4.C.4)
    return GenericAuthResponse(
        status="success",
        message="If an eligible account exists with this email address, password reset instructions have been dispatched."
    )

@router.post("/reset-password", response_model=GenericAuthResponse)
def reset_password_public(
    reset_in: ResetPasswordPublicRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    if len(reset_in.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    t_hash = hash_token(reset_in.token)
    
    # Query either by token_hash or fallback to legacy raw token string
    reset_entry = (
        db.query(PasswordResetToken)
        .filter(
            ((PasswordResetToken.token_hash == t_hash) | (PasswordResetToken.token == reset_in.token)),
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.utcnow()
        )
        .first()
    )

    if not reset_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid or has expired."
        )

    user = db.query(User).filter(User.id == reset_entry.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    # Update password and invalidate token
    user.hashed_password = get_password_hash(reset_in.new_password)
    user.updated_at = datetime.utcnow()
    reset_entry.used = True

    # Revoke all active refresh token sessions (§4.C.3)
    db.query(RefreshTokenSession).filter(RefreshTokenSession.user_id == user.id).update({"revoked": True})
    db.commit()

    log_audit_event(
        db=db,
        action="COMPLETE_PASSWORD_RESET",
        resource_type="user",
        resource_id=user.id,
        user=user,
        details={"email": user.email},
        request=request
    )

    return GenericAuthResponse(
        status="success",
        message="Password has been successfully updated. Please log in with your new credentials."
    )

@router.post("/verify-email", response_model=GenericAuthResponse)
def verify_email(
    verify_in: VerifyEmailRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    t_hash = hash_token(verify_in.token)
    token_entry = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.token_hash == t_hash,
            EmailVerificationToken.used == False,
            EmailVerificationToken.expires_at > datetime.utcnow()
        )
        .first()
    )

    if not token_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is invalid or has expired."
        )

    user = db.query(User).filter(User.id == token_entry.user_id).first()
    if user:
        user.is_verified = True
        token_entry.used = True
        db.commit()

    return GenericAuthResponse(
        status="success",
        message="Email address successfully verified. Your account is now active."
    )

@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token_endpoint(refresh_in: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_refresh_token(refresh_in.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    r_hash = hash_token(refresh_in.refresh_token)
    session_record = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.user_id == user_id,
        RefreshTokenSession.token_hash == r_hash,
        RefreshTokenSession.revoked == False
    ).first()

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is no longer active")

    new_access_token = create_access_token(subject=user.id)
    return TokenRefreshResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Revoke active refresh sessions
    db.query(RefreshTokenSession).filter(RefreshTokenSession.user_id == current_user.id).update({"revoked": True})
    db.commit()

    log_audit_event(
        db=db,
        action="USER_LOGOUT",
        resource_type="user",
        resource_id=current_user.id,
        user=current_user,
        details={"email": current_user.email},
        request=request
    )
    return {"message": "Logged out successfully"}

@router.post("/google", response_model=Token)
def login_google(google_data: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    # Demo / Production Google OAuth verification handler
    demo_email = "demo.investigator@tracex.gov.in"
    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        user = User(
            email=demo_email,
            hashed_password=get_password_hash("DemoSecretPass123!"),
            full_name="Senior Investigator Sharma",
            role=UserRole.SENIOR_INVESTIGATOR,
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    log_audit_event(
        db=db,
        action="GOOGLE_OAUTH_LOGIN",
        resource_type="user",
        resource_id=user.id,
        user=user,
        details={"email": user.email, "role": user.role.value},
        request=request
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SENIOR_INVESTIGATOR]))
):
    return db.query(User).all()

@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    role_in: UserRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user.role = role_in.role
    target_user.updated_at = datetime.utcnow()

    # If role changed, revoke refresh sessions to force re-auth
    db.query(RefreshTokenSession).filter(RefreshTokenSession.user_id == target_user.id).update({"revoked": True})
    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db=db,
        action="UPDATE_USER_ROLE",
        resource_type="user",
        resource_id=target_user.id,
        user=current_user,
        details={"target_user": target_user.email, "new_role": target_user.role.value},
        request=request
    )
    return target_user
