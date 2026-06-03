# Aquaponic OS · Backend (NestJS + MQTT)

Backend que se conecta al **broker MQTT**, escucha los topics del sistema acuapónico y reenvía telemetría JSON al dashboard vía **WebSocket** (`ws://localhost:8080/ws`).

## Requisitos

- **Node.js 18+**
- Un broker MQTT (por ejemplo [Mosquitto](https://mosquitto.org/)) en `mqtt://localhost:1883`
- Opcional: WebSocket MQTT en `:9001` si el frontend se conecta directo al broker

## Configuración

```powershell
cd backend
copy .env.example .env
npm install
```

Variables principales en `.env`:

| Variable | Descripción |
| -------- | ----------- |
| `PORT` | HTTP + WebSocket (default `8080`) |
| `MQTT_URL` | URL del broker (`mqtt://localhost:1883`) |
| `MQTT_TOPIC_PREFIX` | Prefijo de topics (`aquaponic`) |
| `MQTT_DEMO_ENABLED` | `true` para publicar datos de prueba |

## Comandos

```powershell
npm run start:dev    # desarrollo con hot-reload
npm run build        # compilar a dist/
npm run start:prod   # producción
```

## Topics MQTT

Coinciden con `frontend/.env.example`:

| Topic | Uso |
| ----- | --- |
| `aquaponic/sensors/#` | pH, temperatura, oxígeno, etc. |
| `aquaponic/fish/#` | Estado de peces |
| `aquaponic/plants/#` | Estado de plantas |
| `aquaponic/cameras/#` | Metadatos de cámaras |
| `aquaponic/commands/#` | Comandos hacia el ESP32 |

### Ejemplo de payload (ESP32 → broker)

Publicar en `aquaponic/sensors/telemetry`:

```json
{
  "sensors": {
    "ph": { "value": 7.1, "percent": 82, "status": "ok" },
    "temperatura": { "value": 29.5, "percent": 58, "status": "ok" },
    "nivelAgua": { "value": 150, "percent": 90, "status": "warn" }
  },
  "system": { "status": "stable", "statusLabel": "Estable" }
}
```

El dashboard normaliza estos campos en `frontend/src/data/normalizer.js`.

## API REST

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| `GET` | `/` | Info del servicio |
| `GET` | `/health` | Salud + estado MQTT |
| `GET` | `/api/mqtt/status` | Estado de conexión MQTT |
| `POST` | `/api/mqtt/publish` | Publicar en un topic |

Ejemplo de publicación manual:

```powershell
curl -X POST http://localhost:8080/api/mqtt/publish `
  -H "Content-Type: application/json" `
  -d '{"topic":"sensors/test","payload":{"sensors":{"ph":{"value":7}}}}'
```

## Arquitectura

```
ESP32 ──publish──► Broker MQTT ◄──subscribe── Backend (NestJS)
                                              │
                                              └── WebSocket /ws ──► Dashboard React
```

El frontend puede usar **WebSocket** (vía este backend) o **MQTT directo** (WebSocket del broker en `:9001`).

## Estructura

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/configuration.ts
│   ├── health/health.controller.ts
│   ├── mqtt/
│   │   ├── mqtt.service.ts      # Cliente MQTT
│   │   ├── mqtt.controller.ts   # API publish/status
│   │   ├── mqtt-demo.service.ts # Simulador (dev)
│   │   └── topics.constants.ts
│   └── aquaponic/
│       ├── aquaponic.gateway.ts # WebSocket /ws
│       └── aquaponic.service.ts # Puente MQTT → WS
├── .env.example
└── package.json
```
