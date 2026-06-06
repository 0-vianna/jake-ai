@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ========================================
echo       Jake IA - aplicativo desktop
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao foi encontrado no PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm/Node.js nao foi encontrado no PATH.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
)

if not exist ".venv\Scripts\python.exe" (
  python -m venv ".venv"
)

echo Instalando/checando dependencias...
".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
npm install

echo Iniciando backend...
start "Jake Backend" cmd /k "cd /d ""%ROOT%backend"" && ""..\.venv\Scripts\python.exe"" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Iniciando web local...
start "Jake Web" cmd /k "cd /d ""%ROOT%"" && npm run dev:web"

echo Aguardando servidor web...
timeout /t 7 /nobreak >nul

echo Abrindo aplicativo desktop...
set "JAKE_URL=http://127.0.0.1:3000"
npm --workspace apps/desktop run start

endlocal
