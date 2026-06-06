from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import Automation, User
from app.schemas import AutomationCreate
from app.services.audit_service import log_action
from app.services.stub_services import camera_status, screen_status, whatsapp_status

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("/screen/status")
def get_screen_status(_: Annotated[User, Depends(get_current_user)]) -> dict:
    return screen_status()


@router.get("/camera/status")
def get_camera_status(_: Annotated[User, Depends(get_current_user)]) -> dict:
    return camera_status()


@router.get("/whatsapp/status")
def get_whatsapp_status(_: Annotated[User, Depends(get_current_user)]) -> dict:
    return whatsapp_status()


@router.get("/automations")
def list_automations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    rows = db.query(Automation).filter(Automation.user_id == current_user.id).order_by(Automation.updated_at.desc()).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "trigger": row.trigger,
            "actions_json": row.actions_json,
            "active": row.active,
            "last_run_at": row.last_run_at,
            "next_run_at": row.next_run_at,
        }
        for row in rows
    ]


@router.post("/automations")
def create_automation(
    payload: AutomationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    row = Automation(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "active": row.active}


@router.post("/automations/{automation_id}/run")
def run_automation(
    automation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    row = db.query(Automation).filter(Automation.id == automation_id, Automation.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    row.last_run_at = datetime.utcnow()
    db.commit()
    log_action(db, "automation.run", current_user.id, target=str(row.id), details=row.name)
    return {"ok": True, "id": row.id, "last_run_at": row.last_run_at}


@router.delete("/automations/{automation_id}")
def delete_automation(
    automation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    row = db.query(Automation).filter(Automation.id == automation_id, Automation.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    name = row.name
    db.delete(row)
    db.commit()
    log_action(db, "automation.delete", current_user.id, target=str(automation_id), details=name)
    return {"ok": True}
