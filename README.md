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

## Inicio rápido

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
