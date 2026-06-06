import re
import subprocess
import webbrowser


ALLOWED_APPS = {
    "calculadora": "calc.exe",
    "calculator": "calc.exe",
    "bloco de notas": "notepad.exe",
    "notepad": "notepad.exe",
    "explorer": "explorer.exe",
    "arquivos": "explorer.exe",
}

URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


def handle_safe_pc_command(message: str) -> str | None:
    lowered = message.lower().strip()
    if not any(word in lowered for word in ["abrir", "abre", "/abrir", "open"]):
        return None

    url_match = URL_RE.search(message)
    if url_match:
        webbrowser.open(url_match.group(0))
        return f"Abri este link no computador: {url_match.group(0)}"

    for label, executable in ALLOWED_APPS.items():
        if label in lowered:
            subprocess.Popen([executable], shell=False)
            return f"Abri {label} no computador."

    return None

