@echo off
REM Inicia todos los servicios del sistema acuaponico (backend + frontend).
REM Uso:
REM   start.bat            -> backend + frontend
REM   start.bat --camera   -> backend + frontend + publicador de camara (Python)
setlocal

cd /d "%~dp0"

REM 1) Asegura los .env a partir de los .env.example
call :ensure_env backend
call :ensure_env frontend
call :ensure_env camera-publisher

REM 2) Instala dependencias si faltan
if not exist "node_modules" (
  echo [setup] Instalando dependencias raiz...
  call npm install
)
if not exist "backend\node_modules" (
  echo [setup] Instalando backend...
  call npm --prefix backend install
)
if not exist "frontend\node_modules" (
  echo [setup] Instalando frontend...
  call npm --prefix frontend install
)

REM 3) Arranca los servicios
if "%~1"=="--camera" (
  echo [start] backend + frontend + camara
  call npm run dev:all
) else (
  echo [start] backend + frontend
  call npm run dev
)
goto :eof

:ensure_env
if exist "%~1\.env.example" if not exist "%~1\.env" (
  copy "%~1\.env.example" "%~1\.env" >nul
  echo [setup] Creado %~1\.env desde .env.example
)
goto :eof
