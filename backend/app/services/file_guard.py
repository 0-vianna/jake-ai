from pathlib import Path


CRITICAL_PATH_HINTS = [
    "windows",
    "system32",
    "program files",
    "program files (x86)",
    "appdata",
    "$recycle.bin",
]


def is_critical_path(path: str) -> bool:
    resolved = str(Path(path).expanduser()).lower()
    return any(hint in resolved for hint in CRITICAL_PATH_HINTS)


def assert_safe_file_operation(path: str) -> None:
    if is_critical_path(path):
        raise ValueError("Operação bloqueada: caminho crítico do sistema.")

