from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db, seed_default_finance_categories
from app.deps import require_admin
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import get_password_hash
from app.services.audit_service import log_action

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(_: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]) -> list[UserOut]:
    return [UserOut.model_validate(user) for user in db.query(User).order_by(User.created_at.desc()).all()]


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    exists = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Usuário ou email já existe")
    user = User(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        permissions="{}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    seed_default_finance_categories(db, user.id)
    log_action(db, "user.create", admin.id, target=str(user.id), details=f"Criou usuário {user.username}")
    return UserOut.model_validate(user)

