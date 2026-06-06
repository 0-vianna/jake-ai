import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import User, WhatsAppSession
from app.services.audit_service import log_action

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class WhitelistIn(BaseModel):
    phone: str


def get_or_create_session(db: Session, user_id: int) -> WhatsAppSession:
    session = db.query(WhatsAppSession).filter(WhatsAppSession.user_id == user_id).first()
    if session:
        return session
    session = WhatsAppSession(user_id=user_id, status="disconnected", whitelist_json="[]")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/status")
def status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_or_create_session(db, current_user.id)
    return serialize_session(session)


@router.post("/connect")
def connect(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_or_create_session(db, current_user.id)
    session.status = "waiting_bridge"
    session.qr_code = (
        "Abra o bridge WhatsApp local em services/whatsapp-bridge e escaneie o QR gerado no terminal. "
        f"Solicitado em {datetime.utcnow().isoformat()}Z."
    )
    db.commit()
    db.refresh(session)
    log_action(db, "whatsapp.connect_requested", current_user.id, details="Sessão aguardando bridge local")
    return serialize_session(session)


@router.post("/disconnect")
def disconnect(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_or_create_session(db, current_user.id)
    session.status = "disconnected"
    session.qr_code = None
    db.commit()
    db.refresh(session)
    log_action(db, "whatsapp.disconnect", current_user.id)
    return serialize_session(session)


@router.post("/whitelist")
def add_whitelist(
    payload: WhitelistIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_or_create_session(db, current_user.id)
    phones = read_whitelist(session)
    phone = payload.phone.strip()
    if phone and phone not in phones:
        phones.append(phone)
    session.whitelist_json = json.dumps(phones)
    db.commit()
    db.refresh(session)
    log_action(db, "whatsapp.whitelist_add", current_user.id, details=phone)
    return serialize_session(session)


@router.delete("/whitelist/{phone}")
def remove_whitelist(
    phone: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    session = get_or_create_session(db, current_user.id)
    phones = [item for item in read_whitelist(session) if item != phone]
    session.whitelist_json = json.dumps(phones)
    db.commit()
    db.refresh(session)
    log_action(db, "whatsapp.whitelist_remove", current_user.id, details=phone)
    return serialize_session(session)


def serialize_session(session: WhatsAppSession) -> dict:
    return {
        "status": session.status,
        "qr_code": session.qr_code,
        "whitelist": read_whitelist(session),
        "bridge": {
            "implemented": False,
            "path": "services/whatsapp-bridge",
            "next_step": "Instalar e rodar o bridge Baileys para gerar QR real e encaminhar mensagens ao backend.",
        },
    }


def read_whitelist(session: WhatsAppSession) -> list[str]:
    try:
        data = json.loads(session.whitelist_json or "[]")
        return [str(item) for item in data if str(item).strip()]
    except json.JSONDecodeError:
        return []
