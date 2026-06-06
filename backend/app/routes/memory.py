from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import Memory, User
from app.schemas import MemoryCreate, MemoryOut
from app.services.memory_service import create_memory, search_memories

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=list[MemoryOut])
def list_memory(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    q: str = "",
) -> list[MemoryOut]:
    memories = search_memories(db, current_user.id, q, limit=50) if q else (
        db.query(Memory)
        .filter(Memory.user_id == current_user.id, Memory.archived.is_(False))
        .order_by(Memory.updated_at.desc())
        .limit(50)
        .all()
    )
    return [MemoryOut.model_validate(memory) for memory in memories]


@router.post("", response_model=MemoryOut)
def add_memory(
    payload: MemoryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MemoryOut:
    memory = create_memory(
        db,
        current_user.id,
        payload.content,
        tags=payload.tags,
        project_id=payload.project_id,
        importance=payload.importance,
    )
    return MemoryOut.model_validate(memory)


@router.delete("/{memory_id}")
def forget_memory(
    memory_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    memory = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == current_user.id).first()
    if memory:
        memory.archived = True
        db.commit()
    return {"ok": True}

