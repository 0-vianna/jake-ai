from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import require_admin
from app.models import APIUsage, AuditLog, User

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/audit")
def audit_logs(_: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "action": row.action,
            "target": row.target,
            "details": row.details,
            "level": row.level,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.get("/api-usage")
def api_usage(_: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    rows = db.query(APIUsage).order_by(APIUsage.created_at.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "provider": row.provider,
            "model": row.model,
            "mode": row.mode,
            "total_tokens": row.total_tokens,
            "estimated_cost": row.estimated_cost,
            "created_at": row.created_at,
        }
        for row in rows
    ]

