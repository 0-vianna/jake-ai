from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: int | None = None,
    target: str | None = None,
    details: str = "",
    level: str = "info",
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            target=target,
            details=details,
            level=level,
        )
    )
    db.commit()

