from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.models import User
from app.services.file_guard import assert_safe_file_operation

router = APIRouter(prefix="/code-workspace", tags=["code-workspace"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
EXCLUDED_DIRS = {".git", ".next", ".venv", "node_modules", "__pycache__", ".pytest_cache"}
EXCLUDED_FILES = {".env", ".env.local", ".env.production", ".env.development"}


def _safe_relative(path: str) -> Path:
    candidate = (PROJECT_ROOT / path).resolve()
    if PROJECT_ROOT not in candidate.parents and candidate != PROJECT_ROOT:
        raise HTTPException(status_code=400, detail="Caminho fora do projeto")
    assert_safe_file_operation(str(candidate))
    return candidate


@router.get("/tree")
def tree(_: Annotated[User, Depends(get_current_user)], path: str = "", limit: int = 200) -> dict:
    root = _safe_relative(path)
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=404, detail="Pasta não encontrada")
    items = []
    for item in sorted(root.iterdir(), key=lambda value: (not value.is_dir(), value.name.lower())):
        if item.name in EXCLUDED_DIRS:
            continue
        if item.name in EXCLUDED_FILES:
            continue
        rel = item.relative_to(PROJECT_ROOT).as_posix()
        items.append(
            {
                "name": item.name,
                "path": rel,
                "type": "directory" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None,
            }
        )
        if len(items) >= limit:
            break
    return {"root": PROJECT_ROOT.as_posix(), "path": root.relative_to(PROJECT_ROOT).as_posix() if root != PROJECT_ROOT else "", "items": items}


@router.get("/file")
def read_file(_: Annotated[User, Depends(get_current_user)], path: str) -> dict:
    file_path = _safe_relative(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    if file_path.name in EXCLUDED_FILES:
        raise HTTPException(status_code=403, detail="Arquivo protegido")
    if file_path.stat().st_size > 300_000:
        raise HTTPException(status_code=400, detail="Arquivo grande demais para leitura rápida")
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Arquivo não textual")
    return {"path": file_path.relative_to(PROJECT_ROOT).as_posix(), "content": content}


@router.get("/search")
def search(_: Annotated[User, Depends(get_current_user)], q: str, limit: int = 40) -> dict:
    query = q.strip().lower()
    if len(query) < 2:
        return {"query": q, "items": []}
    items = []
    for item in PROJECT_ROOT.rglob("*"):
        if len(items) >= limit:
            break
        if any(part in EXCLUDED_DIRS for part in item.relative_to(PROJECT_ROOT).parts):
            continue
        if item.name in EXCLUDED_FILES or not item.is_file():
            continue
        rel = item.relative_to(PROJECT_ROOT).as_posix()
        matched = query in item.name.lower()
        snippet = ""
        if not matched and item.stat().st_size <= 120_000:
            try:
                content = item.read_text(encoding="utf-8")
                index = content.lower().find(query)
                if index >= 0:
                    matched = True
                    start = max(0, index - 80)
                    end = min(len(content), index + 160)
                    snippet = " ".join(content[start:end].split())
            except UnicodeDecodeError:
                pass
        if matched:
            items.append({"name": item.name, "path": rel, "snippet": snippet})
    return {"query": q, "items": items}
