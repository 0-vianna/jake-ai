from __future__ import annotations

import base64
import mimetypes
import os
import re
import zipfile
from html import unescape
from collections import deque
from pathlib import Path
from xml.etree import ElementTree


BLOCKED_PARTS = {
    "windows",
    "system32",
    "syswow64",
    "program files",
    "program files (x86)",
    "programdata",
    "appdata",
    "$recycle.bin",
}
EXCLUDED_PARTS = {
    ".git",
    ".next",
    ".venv",
    "node_modules",
    "__pycache__",
    ".cache",
    ".npm",
    ".nuget",
    ".gradle",
    ".android",
}
PROTECTED_FILES = {".env", ".env.local", ".env.production", ".env.development"}
TEXT_SUFFIXES = {
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".log",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".xml",
    ".yaml",
    ".yml",
    ".ini",
    ".bat",
    ".ps1",
}
SPREADSHEET_SUFFIXES = {".xlsx"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
MAX_READ_BYTES = 2_000_000
MAX_SEARCH_BYTES = 300_000
MAX_SEARCH_VISITS = 12_000


def file_roots() -> list[dict]:
    home = Path.home().resolve()
    candidates = [
        ("home", "Meu usuario", home),
        ("desktop", "Desktop", home / "Desktop"),
        ("documents", "Documentos", home / "Documents"),
        ("downloads", "Downloads", home / "Downloads"),
        ("pictures", "Imagens", home / "Pictures"),
        ("videos", "Videos", home / "Videos"),
        ("music", "Musicas", home / "Music"),
        ("codex", "Projetos Codex", home / "Documents" / "Codex"),
    ]
    roots = []
    seen: set[Path] = set()
    for root_id, label, path in candidates:
        if path.exists() and path not in seen and is_allowed_path(path):
            roots.append({"id": root_id, "label": label, "path": str(path)})
            seen.add(path)
    return roots


def resolve_personal_path(path: str | None = None, root_id: str | None = None) -> Path:
    roots = file_roots()
    root_by_id = {root["id"]: Path(root["path"]).resolve() for root in roots}
    if path:
        candidate = Path(path).expanduser().resolve()
    elif root_id:
        candidate = root_by_id.get(root_id)
        if candidate is None:
            raise ValueError("Raiz de arquivos nao encontrada")
    else:
        candidate = Path.home().resolve()

    if not is_allowed_path(candidate):
        raise ValueError("Caminho bloqueado por seguranca")
    if not is_inside_any_root(candidate, [Path(root["path"]).resolve() for root in roots]):
        raise ValueError("Caminho fora das pastas pessoais permitidas")
    return candidate


def is_allowed_path(path: Path) -> bool:
    resolved = path.expanduser().resolve()
    parts = [part.lower() for part in resolved.parts]
    if any(part in BLOCKED_PARTS for part in parts):
        return False
    home = Path.home().resolve()
    users_root = home.parent.resolve()
    if resolved == users_root:
        return False
    return True


def is_inside_any_root(path: Path, roots: list[Path]) -> bool:
    for root in roots:
        if path == root or root in path.parents:
            return True
    return False


def list_directory(path: Path, limit: int = 250) -> dict:
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError("Pasta nao encontrada")
    items = []
    for item in sorted(path.iterdir(), key=lambda value: (not value.is_dir(), value.name.lower())):
        if should_skip(item):
            continue
        try:
            stat = item.stat()
        except OSError:
            continue
        items.append(
            {
                "name": item.name,
                "path": str(item),
                "type": "directory" if item.is_dir() else "file",
                "size": stat.st_size if item.is_file() else None,
                "modified_at": stat.st_mtime,
                "mime": guess_mime(item),
            }
        )
        if len(items) >= limit:
            break
    return {"path": str(path), "parent": str(path.parent) if path.parent != path else None, "items": items}


def read_personal_file(path: Path) -> dict:
    if not path.exists() or not path.is_file():
        raise FileNotFoundError("Arquivo nao encontrado")
    if should_skip(path):
        raise PermissionError("Arquivo protegido")
    size = path.stat().st_size
    if size > MAX_READ_BYTES:
        return file_metadata(path, preview="Arquivo grande demais para leitura direta nesta tela.")
    suffix = path.suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        mime = guess_mime(path) or "image/png"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return {**file_metadata(path), "kind": "image", "content": f"data:{mime};base64,{encoded}"}
    extracted = extract_text(path)
    if extracted is None:
        return file_metadata(path, preview="Formato ainda sem extrator de texto. O Jake consegue ver metadados e nome do arquivo.")
    return {**file_metadata(path), "kind": "text", "content": extracted}


def analyze_file(path: Path) -> dict:
    data = read_personal_file(path)
    text = data.get("content") if data.get("kind") == "text" else data.get("preview", "")
    if not text:
        text = f"Arquivo {data['name']} do tipo {data.get('mime') or 'desconhecido'} com {data.get('size')} bytes."
    summary = summarize_text(str(text), data["name"])
    return {**data, "summary": summary}


def search_files(root: Path, query: str, limit: int = 60) -> dict:
    normalized = query.strip().lower()
    if len(normalized) < 2:
        return {"query": query, "root": str(root), "items": []}
    items = []
    visited = 0
    pending: deque[Path] = deque([root])
    while pending and len(items) < limit and visited < MAX_SEARCH_VISITS:
        current = pending.popleft()
        if should_skip(current):
            continue
        try:
            children = sorted(current.iterdir(), key=lambda value: (not value.is_dir(), value.name.lower()))
        except (OSError, PermissionError):
            continue
        for item in children:
            visited += 1
            if visited >= MAX_SEARCH_VISITS or len(items) >= limit:
                break
            if should_skip(item):
                continue
            if item.is_dir():
                pending.append(item)
                continue
            if not item.is_file():
                continue
            matched = normalized in item.name.lower()
            snippet = ""
            if not matched:
                try:
                    if item.stat().st_size <= MAX_SEARCH_BYTES:
                        text = extract_text(item)
                        if text:
                            index = text.lower().find(normalized)
                            if index >= 0:
                                matched = True
                                start = max(0, index - 80)
                                end = min(len(text), index + 180)
                                snippet = " ".join(text[start:end].split())
                except OSError:
                    continue
            if matched:
                try:
                    stat = item.stat()
                except OSError:
                    continue
                items.append(
                    {
                        "name": item.name,
                        "path": str(item),
                        "size": stat.st_size,
                        "modified_at": stat.st_mtime,
                        "mime": guess_mime(item),
                        "snippet": snippet,
                    }
                )
    return {"query": query, "root": str(root), "items": items, "visited": visited, "limited": visited >= MAX_SEARCH_VISITS}


def should_skip(path: Path) -> bool:
    parts = [part.lower() for part in path.parts]
    if any(part in BLOCKED_PARTS or part in EXCLUDED_PARTS for part in parts):
        return True
    if path.name.lower() in PROTECTED_FILES:
        return True
    return not is_allowed_path(path)


def extract_text(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix in TEXT_SUFFIXES:
        return read_text(path)
    if suffix == ".docx":
        return read_docx_text(path)
    if suffix in SPREADSHEET_SUFFIXES:
        return read_xlsx_text(path)
    return None


def read_text(path: Path) -> str | None:
    raw = path.read_bytes()
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)[:MAX_READ_BYTES]
        except UnicodeDecodeError:
            continue
    return None


def read_docx_text(path: Path) -> str | None:
    try:
        with zipfile.ZipFile(path) as docx:
            xml = docx.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile, OSError):
        return None
    root = ElementTree.fromstring(xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
        joined = "".join(texts).strip()
        if joined:
            paragraphs.append(joined)
    return "\n".join(paragraphs)[:MAX_READ_BYTES]


def read_xlsx_text(path: Path) -> str | None:
    try:
        with zipfile.ZipFile(path) as workbook:
            shared_strings = read_xlsx_shared_strings(workbook)
            sheet_names = [name for name in workbook.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
            rows = []
            for sheet_name in sheet_names[:8]:
                xml = workbook.read(sheet_name)
                root = ElementTree.fromstring(xml)
                namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                rows.append(f"[{Path(sheet_name).stem}]")
                for row in root.findall(".//x:row", namespace)[:200]:
                    values = []
                    for cell in row.findall("x:c", namespace):
                        values.append(read_xlsx_cell(cell, namespace, shared_strings))
                    if any(values):
                        rows.append(" | ".join(value for value in values if value))
                    if len("\n".join(rows)) >= MAX_READ_BYTES:
                        return "\n".join(rows)[:MAX_READ_BYTES]
            return "\n".join(rows)[:MAX_READ_BYTES]
    except (KeyError, zipfile.BadZipFile, OSError, ElementTree.ParseError):
        return None


def read_xlsx_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    try:
        xml = workbook.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ElementTree.fromstring(xml)
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings = []
    for item in root.findall(".//x:si", namespace):
        parts = [node.text or "" for node in item.findall(".//x:t", namespace)]
        strings.append("".join(parts))
    return strings


def read_xlsx_cell(cell: ElementTree.Element, namespace: dict[str, str], shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("x:v", namespace)
    inline = cell.find(".//x:t", namespace)
    raw = (value.text if value is not None else inline.text if inline is not None else "") or ""
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return raw
    return raw


def file_metadata(path: Path, preview: str = "") -> dict:
    stat = path.stat()
    return {
        "name": path.name,
        "path": str(path),
        "kind": "metadata",
        "size": stat.st_size,
        "modified_at": stat.st_mtime,
        "mime": guess_mime(path),
        "preview": preview,
    }


def guess_mime(path: Path) -> str | None:
    return mimetypes.guess_type(str(path))[0]


def summarize_text(text: str, name: str) -> str:
    clean = " ".join(unescape(text).split())
    if len(clean) <= 600:
        return f"Resumo de {name}: {clean or 'sem texto extraido'}"
    sentences = re.split(r"(?<=[.!?])\s+", clean)
    selected = []
    for sentence in sentences:
        if sentence and len(" ".join(selected)) < 900:
            selected.append(sentence)
    return f"Resumo de {name}: {' '.join(selected)[:1200]}"


def environment_home() -> str:
    return os.environ.get("USERPROFILE") or str(Path.home())
