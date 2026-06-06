from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import User, WorkspaceAction, WorkspaceLayout
from app.schemas import WorkspaceActionIn, WorkspaceLayoutIn, WorkspaceLayoutOut
from app.services.audit_service import log_action

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/layouts", response_model=list[WorkspaceLayoutOut])
def list_layouts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[WorkspaceLayoutOut]:
    rows = (
        db.query(WorkspaceLayout)
        .filter(WorkspaceLayout.user_id == current_user.id)
        .order_by(WorkspaceLayout.is_default.desc(), WorkspaceLayout.updated_at.desc())
        .all()
    )
    return [WorkspaceLayoutOut.model_validate(row) for row in rows]


@router.get("/layouts/default", response_model=WorkspaceLayoutOut | None)
def get_default_layout(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceLayoutOut | None:
    row = (
        db.query(WorkspaceLayout)
        .filter(WorkspaceLayout.user_id == current_user.id, WorkspaceLayout.is_default.is_(True))
        .order_by(WorkspaceLayout.updated_at.desc())
        .first()
    )
    if not row:
        row = (
            db.query(WorkspaceLayout)
            .filter(WorkspaceLayout.user_id == current_user.id)
            .order_by(WorkspaceLayout.updated_at.desc())
            .first()
        )
    return WorkspaceLayoutOut.model_validate(row) if row else None


@router.get("/layouts/{layout_id}", response_model=WorkspaceLayoutOut)
def get_layout(
    layout_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceLayoutOut:
    row = (
        db.query(WorkspaceLayout)
        .filter(WorkspaceLayout.id == layout_id, WorkspaceLayout.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Layout nao encontrado")
    return WorkspaceLayoutOut.model_validate(row)


@router.post("/layouts", response_model=WorkspaceLayoutOut)
def create_layout(
    payload: WorkspaceLayoutIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceLayoutOut:
    if payload.is_default:
        (
            db.query(WorkspaceLayout)
            .filter(WorkspaceLayout.user_id == current_user.id, WorkspaceLayout.is_default.is_(True))
            .update({"is_default": False})
        )
    row = WorkspaceLayout(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(db, "workspace.layout.create", current_user.id, target=str(row.id), details=row.name)
    return WorkspaceLayoutOut.model_validate(row)


@router.put("/layouts/{layout_id}", response_model=WorkspaceLayoutOut)
def update_layout(
    layout_id: int,
    payload: WorkspaceLayoutIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceLayoutOut:
    row = (
        db.query(WorkspaceLayout)
        .filter(WorkspaceLayout.id == layout_id, WorkspaceLayout.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Layout nao encontrado")
    if payload.is_default:
        (
            db.query(WorkspaceLayout)
            .filter(WorkspaceLayout.user_id == current_user.id, WorkspaceLayout.id != layout_id, WorkspaceLayout.is_default.is_(True))
            .update({"is_default": False})
        )
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    log_action(db, "workspace.layout.update", current_user.id, target=str(row.id), details=row.name)
    return WorkspaceLayoutOut.model_validate(row)


@router.delete("/layouts/{layout_id}")
def delete_layout(
    layout_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    row = (
        db.query(WorkspaceLayout)
        .filter(WorkspaceLayout.id == layout_id, WorkspaceLayout.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Layout nao encontrado")
    db.delete(row)
    db.commit()
    log_action(db, "workspace.layout.delete", current_user.id, target=str(layout_id))
    return {"ok": True}


@router.post("/actions")
def record_action(
    payload: WorkspaceActionIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    row = WorkspaceAction(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    log_action(db, "workspace.action", current_user.id, details=payload.action_type)
    return {"ok": True, "id": row.id}
