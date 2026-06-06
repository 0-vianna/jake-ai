@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ========================================
echo          Jake IA - inicializador
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao foi encontrado no PATH.
  echo Instale Python 3.12+ e tente novamente.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm/Node.js nao foi encontrado no PATH.
  echo Instale Node.js 20+ e tente novamente.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Criando .env a partir de .env.example...
  copy ".env.example" ".env" >nul
  echo Depois cole sua OPENAI_API_KEY no arquivo .env.
)

if not exist ".venv\Scripts\python.exe" (
  echo Criando ambiente Python...
  python -m venv ".venv"
)

echo Instalando/checando dependencias do backend...
".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias do backend.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias do frontend...
  npm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias do frontend.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando backend em http://0.0.0.0:8000 ...
start "Jake Backend" cmd /k "cd /d ""%ROOT%backend"" && ""..\.venv\Scripts\python.exe"" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Iniciando frontend em http://0.0.0.0:3000 ...
start "Jake Web" cmd /k "cd /d ""%ROOT%"" && npm run dev:web"

echo.
echo Aguardando alguns segundos para abrir o navegador...
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:3000"

echo.
echo Jake iniciada.
echo Conta admin local preparada: jprvianna
echo Para parar, feche as janelas "Jake Backend" e "Jake Web".
echo.
pause
