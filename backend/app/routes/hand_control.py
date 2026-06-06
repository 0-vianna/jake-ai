from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import User
from app.services.audit_service import log_action
from app.services.native_hand_control_service import native_hand_control_service

router = APIRouter(prefix="/hand-control", tags=["hand-control"])


class HandControlStart(BaseModel):
    camera_index: int = 0


@router.get("/status")
def status(_: Annotated[User, Depends(get_current_user)]) -> dict:
    return native_hand_control_service.status()


@router.post("/start")
def start(
    payload: HandControlStart,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = native_hand_control_service.start(camera_index=payload.camera_index)
    log_action(db, "hand_control.start", current_user.id, details=f"camera_index={payload.camera_index}")
    return result


@router.post("/stop")
def stop(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = native_hand_control_service.stop()
    log_action(db, "hand_control.stop", current_user.id)
    return result
