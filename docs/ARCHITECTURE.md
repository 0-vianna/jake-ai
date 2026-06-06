# Arquitetura da Jake

## Princípios

- Modularidade: cada grande capacidade fica em rota e serviço separados.
- Segurança básica: ações locais passam por guardas antes de tocar arquivos ou comandos.
- Economia de API: modos de IA, histórico curto e memória buscada seletivamente.
- Multiusuário: conversas, memórias, financeiro e projetos pertencem ao usuário.
- Evolução local primeiro: SQLite agora, PostgreSQL depois.

## Backend

FastAPI organiza a API em módulos:

- `auth`: login, JWT, senha criptografada.
- `chat`: conversas, mensagens, uso OpenAI.
- `memory`: memória curta/longa inicial.
- `finance`: transações, categorias, resumo e análise básica.
- `projects`: contexto de projetos.
- `settings`: preferências e status runtime.
- `modules`: contratos de tela, câmera, WhatsApp e automações.
- `logs`: auditoria e uso de API.

## Banco

Tabelas criadas:

- users
- sessions
- conversations
- messages
- memories
- projects
- project_files
- automations
- automation_logs
- finance_transactions
- finance_categories
- finance_goals
- finance_accounts
- finance_budgets
- files_index
- settings
- api_usage
- whatsapp_sessions
- audit_logs

## Frontend

Next.js usa um app shell cliente para:

- Login.
- Sidebar.
- Comando rápido.
- Dashboard.
- Chat.
- Financeiro.
- Configurações.
- Módulos preparados.

## Segurança

O MVP não executa comandos destrutivos. A camada `file_guard.py` já centraliza caminhos críticos. Antes de liberar ações reais no computador, os agentes locais devem chamar essa camada e registrar audit logs.

## IA

O backend usa a Responses API da OpenAI. Se a chave não existir, retorna um fallback local claro e não faz chamada externa.

