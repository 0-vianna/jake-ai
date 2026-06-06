from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.deps import get_current_user
from app.models import APIUsage, Setting, User
from app.schemas import SettingIn, SettingOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def list_settings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    rows = db.query(Setting).filter((Setting.user_id == current_user.id) | (Setting.user_id.is_(None))).all()
    values = {row.key: row.value for row in rows}
    now = datetime.utcnow()
    month_prefix = now.strftime("%Y-%m")
    month_start = datetime(now.year, now.month, 1)
    usage_rows = (
        db.query(APIUsage)
        .filter(APIUsage.user_id == current_user.id, APIUsage.created_at >= month_start)
        .all()
    )
    total_tokens = sum(row.total_tokens for row in usage_rows)
    estimated_cost = sum(row.estimated_cost for row in usage_rows)
    try:
        monthly_limit = float(values.get("monthly_limit_usd", "10") or 10)
    except ValueError:
        monthly_limit = 10.0
    return {
        "user": values,
        "runtime": {
            "default_ai_mode": settings.default_ai_mode,
            "economy_model": settings.economy_model,
            "balanced_model": settings.balanced_model,
            "max_model": settings.max_model,
            "whatsapp_enabled": settings.whatsapp_enabled,
            "vision_enabled": settings.vision_enabled,
            "voice_enabled": settings.voice_enabled,
            "screen_control_enabled": settings.screen_control_enabled,
            "openai_configured": bool(settings.openai_api_key),
            "api_usage_month": {
                "month": month_prefix,
                "calls": len(usage_rows),
                "total_tokens": total_tokens,
                "estimated_cost": round(estimated_cost, 4),
                "monthly_limit_usd": monthly_limit,
                "percent": round((estimated_cost / monthly_limit) * 100, 1) if monthly_limit else 0,
            },
        },
    }


@router.put("", response_model=SettingOut)
def upsert_setting(
    payload: SettingIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SettingOut:
    row = db.query(Setting).filter(Setting.user_id == current_user.id, Setting.key == payload.key).first()
    if not row:
        row = Setting(user_id=current_user.id, key=payload.key, value=payload.value)
        db.add(row)
    else:
        row.value = payload.value
    db.commit()
    return SettingOut(key=row.key, value=row.value)
