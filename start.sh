#!/usr/bin/env bash
# Inicia todos los servicios del sistema acuapónico (backend + frontend).
# Uso:
#   ./start.sh            → backend + frontend
#   ./start.sh --camera   → backend + frontend + publicador de cámara (Python)
set -euo pipefail

# Ir a la raíz del repo (carpeta de este script)
cd "$(dirname "$0")"

# 1) Asegura los .env a partir de los .env.example
ensure_env() {
  local dir="$1"
  if [ -f "$dir/.env.example" ] && [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "[setup] Creado $dir/.env desde .env.example"
  fi
}
ensure_env backend
ensure_env frontend
ensure_env camera-publisher

# 2) Instala dependencias si faltan
[ -d node_modules ] || { echo "[setup] Instalando dependencias raíz…"; npm install; }
[ -d backend/node_modules ] || { echo "[setup] Instalando backend…"; npm --prefix backend install; }
[ -d frontend/node_modules ] || { echo "[setup] Instalando frontend…"; npm --prefix frontend install; }

# 3) Arranca los servicios
if [ "${1:-}" = "--camera" ]; then
  echo "[start] backend + frontend + cámara"
  npm run dev:all
else
  echo "[start] backend + frontend"
  npm run dev
fi
