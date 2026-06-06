# Jake IA

Jake e uma central pessoal com IA para chat, memoria, projetos, controle financeiro,
visao de tela, camera, voz, automacoes, Code Workspace e WhatsApp remoto.

## Como iniciar

No Windows, use:

```bat
start_jake.bat
```

Para abrir como aplicativo de computador:

```bat
start_jake_desktop.bat
```

Login de desenvolvimento:

- Usuario: `admin`
- Senha: `admin123`

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind, Framer Motion, Recharts e Lucide.
- Backend: FastAPI, SQLAlchemy, SQLite, JWT, OpenAI SDK, httpx e BeautifulSoup.
- Desktop: Electron apontando para o app local.

## OpenAI

O backend le a chave em `.env`:

```env
OPENAI_API_KEY=sua-chave-aqui
```

Modelos padrao:

- Economico: `gpt-4.1-mini`
- Equilibrado: `gpt-4.1-mini`
- Maximo: `gpt-4.1`

## O que funciona agora

- Chat com OpenAI e historico local.
- Segunda, terceira e demais mensagens na mesma conversa funcionando.
- Anexos de texto/imagem no chat.
- Captura de tela enviada para analise visual.
- Microfone no chat via Web Speech API do navegador.
- Busca web do backend para perguntas atuais.
- Hora/data local pelo backend.
- Exemplo: "Qual o proximo jogo do Galo?" usa busca web e fontes.
- Memoria por usuario.
- Projetos.
- Code Workspace com arvore, leitura segura e busca por arquivo/conteudo.
- Financeiro com entrada rapida, texto, manual, graficos e botao reset.
- Usuarios com listagem, criacao e logout.
- Automacoes com criacao, execucao manual e exclusao.
- Camera com MediaPipe Hands e fallback visual com linhas verdes/pontos vermelhos.
- Camera/tela com botao "Ver/Analisar com IA".
- WhatsApp remoto com status, conectar/desconectar e whitelist no banco.
- Tema claro/escuro.
- App desktop Electron.

## WhatsApp

A aba WhatsApp ja salva status e whitelist. O QR real ainda depende do bridge local
Node com Baileys/WPPConnect. O caminho reservado e:

```text
services/whatsapp-bridge
```

## Controle do PC

O chat ja tem comandos locais seguros basicos, como abrir URLs, calculadora,
bloco de notas e explorador. Controle visual completo de mouse/teclado precisa
do agente desktop local com permissao explicita.

## Rotas principais

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/chat`
- `GET /api/tools/web-search`
- `GET /api/code-workspace/search`
- `DELETE /api/finance/reset`
- `GET /api/whatsapp/status`
- `POST /api/whatsapp/connect`
- `POST /api/modules/automations/{id}/run`

## Desenvolvimento

Backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
npm run dev:web
```

Desktop:

```powershell
npm --workspace apps/desktop run start
```
