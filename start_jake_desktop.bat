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
if errorlevel 1 (
  echo [ERRO] Falha ao preparar dependencias do backend.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Instalando dependencias Node/Electron...
  npm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias do frontend/desktop.
    pause
    exit /b 1
  )
)

echo Iniciando backend...
start "Jake Backend" cmd /k "cd /d ""%ROOT%backend"" && ""..\.venv\Scripts\python.exe"" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Iniciando web local...
start "Jake Web" cmd /k "cd /d ""%ROOT%"" && npm run dev:web"

echo Aguardando servidor web responder...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(75); do { try { $resp=Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2; if ($resp.StatusCode -eq 200) { exit 0 } } catch { Start-Sleep -Seconds 2 } } while((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo [ERRO] O frontend nao respondeu em http://127.0.0.1:3000
  echo Abra o Jake pelo navegador para ver o erro antes do desktop.
  pause
  exit /b 1
)

echo Abrindo aplicativo desktop...
start "Jake Desktop" cmd /c "set JAKE_URL=http://127.0.0.1:3000 && npm --workspace apps/desktop run start"

echo.
echo Jake Desktop iniciado.
echo Se quiser entrar manualmente pelo navegador: http://127.0.0.1:3000
echo.
endlocal
