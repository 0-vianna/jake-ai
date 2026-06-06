from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import get_current_user
from app.models import User
from app.services.web_tools_service import search_web

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("/web-search")
def web_search(
    _: Annotated[User, Depends(get_current_user)],
    q: str = Query(min_length=2, max_length=220),
) -> dict:
    results = search_web(q, limit=6)
    return {
        "query": q,
        "results": [item.__dict__ for item in results],
    }
