from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Memory


def summarize_memory(content: str) -> str:
    compact = " ".join(content.split())
    return compact[:220] + ("..." if len(compact) > 220 else "")


def create_memory(
    db: Session,
    user_id: int,
    content: str,
    tags: str = "",
    project_id: int | None = None,
    source: str = "manual",
    importance: int = 3,
) -> Memory:
    memory = Memory(
        user_id=user_id,
        project_id=project_id,
        content=content,
        summary=summarize_memory(content),
        tags=tags,
        source=source,
        importance=importance,
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def search_memories(db: Session, user_id: int, query: str, limit: int = 5) -> list[Memory]:
    tokens = [token.strip().lower() for token in query.split() if len(token.strip()) > 3]
    scoped = db.query(Memory).filter(Memory.user_id == user_id, Memory.archived.is_(False))
    if not tokens:
        return scoped.order_by(Memory.updated_at.desc()).limit(limit).all()
    filters = []
    for token in tokens[:8]:
        pattern = f"%{token}%"
        filters.append(Memory.content.ilike(pattern))
        filters.append(Memory.tags.ilike(pattern))
    return scoped.filter(or_(*filters)).order_by(Memory.importance.desc(), Memory.updated_at.desc()).limit(limit).all()

