# Jake Desktop

Este diretório está reservado para o app desktop.

Stack recomendada:

- Tauri para desempenho e menor consumo.
- Next.js web carregado como UI.
- Backend FastAPI local.
- Ponte segura para ações do sistema operacional.

Contrato esperado:

- O desktop inicia ou descobre o backend local.
- Ações de arquivo passam por `file_guard.py`.
- Comandos destrutivos são bloqueados.
- Logs vão para `audit_logs`.
- Integrações de tela usam PyAutoGUI, Playwright, OCR e captura local.

