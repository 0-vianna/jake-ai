import secrets
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db, seed_default_finance_categories
from app.deps import get_current_user
from app.models import User
from app.schemas import LoginRequest, RegisterResponse, TokenResponse, UserOut, UserRegister
from app.security import create_access_token, get_password_hash, verify_password
from app.services.audit_service import log_action
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    user = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.username))
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login ou senha invalidos")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")
    if settings.require_verified_email and not user.email_verified and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme seu email antes de entrar")
    token = create_access_token(str(user.id), {"role": user.role})
    log_action(db, "login", user.id, details="Login realizado")
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=RegisterResponse)
def register(payload: UserRegister, db: Annotated[Session, Depends(get_db)]) -> RegisterResponse:
    exists = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Usuario ou email ja existe")

    token = secrets.token_urlsafe(32)
    user = User(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="user",
        permissions="{}",
        theme="light",
        email_verified=False,
        verification_token=token,
        verification_sent_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    seed_default_finance_categories(db, user.id)

    delivery, debug_link = send_verification_email(user.email, user.name, token)
    log_action(db, "auth.register", user.id, details=f"delivery={delivery}")
    return RegisterResponse(
        message="Conta criada. Verifique seu email para concluir o acesso seguro.",
        email_verification_required=True,
        delivery=delivery,
        verify_url=debug_link,
    )


@router.get("/verify-email", response_model=RegisterResponse)
def verify_email(token: str, db: Annotated[Session, Depends(get_db)]) -> RegisterResponse:
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Link de verificacao invalido")
    user.email_verified = True
    user.verification_token = None
    user.verification_sent_at = None
    db.commit()
    log_action(db, "auth.verify_email", user.id, details="Email confirmado")
    return RegisterResponse(
        message="Email confirmado com sucesso. Agora voce ja pode entrar no Jake.",
        email_verification_required=False,
        delivery="verified",
        verify_url=None,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return UserOut.model_validate(current_user)
