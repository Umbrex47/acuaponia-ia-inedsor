# Aquaponic OS

Monorepo del sistema acuapónico: **dashboard React** y **backend NestJS** con MQTT.

## Estructura

```
.
├── frontend/          # Vite + React + Tailwind + GSAP (dashboard)
├── backend/           # NestJS + MQTT + WebSocket
├── iot/               # Firmware ESP32 (Arduino)
├── .gitignore
└── README.md          # Este archivo
```

## Inicio rápido (todo a la vez)

Desde la raíz del repo, un solo comando levanta backend + frontend (crea los
`.env` faltantes desde `.env.example` e instala dependencias si hace falta):

```bash
# Windows (CMD/PowerShell)
start.bat
start.bat --camera   # incluye el publicador de cámara (Python)

# Git Bash / macOS / Linux
./start.sh
./start.sh --camera
```

O directamente con npm:

```bash
npm install        # solo la primera vez (instala 'concurrently')
npm run dev         # backend + frontend
npm run dev:all     # backend + frontend + cámara
npm run install:all # instala dependencias de raíz, backend y frontend
```

- Backend: `http://localhost:8080` · Frontend: `http://localhost:5173`
- El broker MQTT y MongoDB son infraestructura externa (ver pasos abajo).

## Inicio manual

### 1. Broker MQTT

Levanta un broker (Mosquitto, EMQX, etc.) en `mqtt://localhost:1883`.  
Si el frontend usa MQTT directo, habilita también WebSocket en el puerto **9001**.

### 2. Backend

```powershell
cd backend
copy .env.example .env
npm install
npm run start:dev
```

- HTTP: `http://localhost:8080`
- WebSocket del dashboard: `ws://localhost:8080/ws`
- Demo sin ESP32: en `.env` pon `MQTT_DEMO_ENABLED=true`

### 3. Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Flujo de datos

| Origen | Canal | Destino |
| ------ | ----- | ------- |
| ESP32 | MQTT → broker | Backend (subscribe) → WebSocket → Dashboard |
| ESP32 | MQTT WebSocket `:9001` | Dashboard (cliente MQTT en el navegador) |

Configura en `frontend/.env`:

- `VITE_WS_URL=ws://localhost:8080/ws` — vía backend NestJS
- `VITE_MQTT_URL=ws://localhost:9001` — conexión directa al broker (opcional)

## Documentación

- [frontend/README.md](./frontend/README.md) — UI y pantallas
- [backend/README.md](./backend/README.md) — API, topics y payloads MQTT
- [fish-detection/README.md](./fish-detection/README.md) — YOLO peces + reentrenamiento
- [docs/fish-detection-plan.md](./docs/fish-detection-plan.md) — plan de implementación + upgrade DeepFish
- [docs/plant-detection-plan.md](./docs/plant-detection-plan.md) — plan IA plantas + PlantVillage/PlantDoc
- [plant-detection/README.md](./plant-detection/README.md) — salud/anomalías vegetales
- [camera-publisher/README.md](./camera-publisher/README.md) — cámara + detección en vivo

## Detección de peces (resumen)

1. Pesos: `fish-detection/models/fish_yolo11s_aquarium.pt` (entrenados en AIPeces / Aquarium).
2. En `camera-publisher/.env`: `FISH_DETECT_ENABLED=true`.
3. Telemetría MQTT: `aquaponic/fish/telemetry` (count, `activityState`, assessment).
4. Correo de evaluación: backend `FishAssessmentService` (umbrales en `.env`).
5. Reentrenar / DeepFish: ver `fish-detection/README.md`.

## Detección de plantas (resumen)

1. Pipeline: `plant-detection/` (ExG + EfficientNet / heurísticas).
2. Entrenar: `python scripts/train_health.py` (PlantVillage) o `train_bootstrap.py`.
3. `PLANT_DETECT_ENABLED=true` en camera-publisher → `aquaponic/plants/telemetry`.
4. Correo: `PlantAssessmentService` (`PLANT_ASSESS_*` en `.env`).
5. PlantDoc YOLO: `scripts/download_plantdoc.py` + `train_detect.py`.
