from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.deps import get_current_user
from app.models import User
from app.services.audit_service import log_action
from app.services.personal_files_service import (
    analyze_file,
    environment_home,
    file_roots,
    list_directory,
    read_personal_file,
    resolve_personal_path,
    search_files,
)

router = APIRouter(prefix="/files", tags=["files"])


def safe_path(path: str | None = None, root_id: str | None = None) -> Path:
    try:
        return resolve_personal_path(path=path, root_id=root_id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/roots")
def roots(_: Annotated[User, Depends(get_current_user)]) -> dict:
    return {"home": environment_home(), "roots": file_roots()}


@router.get("/tree")
def tree(
    _: Annotated[User, Depends(get_current_user)],
    root_id: str | None = None,
    path: str | None = None,
    limit: int = 250,
) -> dict:
    target = safe_path(path=path, root_id=root_id)
    try:
        return list_directory(target, limit=min(max(limit, 20), 500))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/read")
def read_file(
    path: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    target = safe_path(path=path)
    try:
        data = read_personal_file(target)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    log_action(db, "files.read", current_user.id, details=str(target))
    return data


@router.get("/analyze")
def analyze(
    path: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    target = safe_path(path=path)
    try:
        data = analyze_file(target)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    log_action(db, "files.analyze", current_user.id, details=str(target))
    return data


@router.get("/search")
def search(
    _: Annotated[User, Depends(get_current_user)],
    q: str,
    root_id: str = "documents",
    limit: int = 60,
) -> dict:
    root = safe_path(root_id=root_id)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="A busca precisa comecar em uma pasta")
    return search_files(root, q, limit=min(max(limit, 10), 120))
