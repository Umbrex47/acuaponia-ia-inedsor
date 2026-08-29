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
| `MQTT_DEMO_ENABLED` | `false` para datos reales; `true` solo en demos sin hardware |

## Datos reales vs simulación

El backend siempre **escucha** el broker MQTT y reenvía cada mensaje al
dashboard por WebSocket (`ws://host:8080/ws`). Con la ESP32 publicando en
`aquaponic/sensors/telemetry` y el simulador apagado, el dashboard refleja
**únicamente** las lecturas reales.

| Modo | `MQTT_DEMO_ENABLED` | Comportamiento |
| ---- | ------------------- | -------------- |
| Datos reales (recomendado) | `false` | Solo se reenvía al WS lo que llega por MQTT. |
| Demo / sin hardware | `true` | El `DemoTelemetryService` publica telemetría suavizada cada `MQTT_DEMO_INTERVAL_MS`. **Apagalo** en cuanto la ESP32 esté en línea para no duplicar datos. |

Variables de frontend que tienen que coincidir:

- `VITE_DEMO_MODE=false` — oculta el modal "Modo demostración".
- `VITE_MQTT_ENABLED=false` — evita suscribir el navegador directo al broker; el WS del backend ya reenvía todo.

Cambio típico cuando llega la ESP32:

```env
MQTT_DEMO_ENABLED=false
```

```env
VITE_DEMO_MODE=false
VITE_MQTT_ENABLED=false
```

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
| `GET` | `/actuators` | Lista de actuadores (bomba / aireador / dispensador) |
| `POST` | `/actuators/:id/execute` | Acción manual (on/off/dispense) |
| `POST` | `/actuators/:id/mode` | Cambia modo (`ia` / `manual` / `auto`) |
| `POST` | `/actuators/:id/lock` | Lock multi-usuario (10 s) |
| `POST` | `/actuators/:id/unlock` | Libera lock |
| `GET` | `/feeder/schedule` | Configuración del dispensador |
| `POST` | `/feeder/schedule` | Reprograma horarios |
| `POST` | `/feeder/dispense` | Disparo manual del dispensador |
| `POST` | `/assistant/chat` | Chat HTTP (fallback) |
| `GET` | `/assistant/history` | Historial de chat |
| `GET` | `/assistant/proposals` | Propuestas pendientes de la IA |
| `POST` | `/assistant/proposals/resolve` | Aprobar/Rechazar propuesta |
| `WS` | `/ws` | Telemetría en vivo (dashboard) |
| `WS` | `/chat` | Chat streaming con la IA |

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
                                              ├── EmergencyPolicy (auto-actúa)
                                              ├── ActuatorService (bomba/aireador/dispensador)
                                              ├── FeederScheduler (cron configurable)
                                              ├── AssistantService ── Ollama (Llama 3.1 8B)
                                              │
                                              ├── WebSocket /ws ──► Dashboard (telemetría)
                                              └── WebSocket /chat ──► Asistente IA
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
│   │   ├── mqtt.service.ts
│   │   ├── mqtt.controller.ts
│   │   ├── mqtt-demo.service.ts
│   │   └── topics.constants.ts
│   ├── aquaponic/         # Gateway WebSocket /ws
│   ├── alerts/            # Umbrales, mail, telegram
│   ├── readings/          # Persistencia en Mongo
│   ├── decision/          # Motor de bomba, reportes, assessments
│   ├── actuators/         # NUEVO: bomba + aireador + dispensador
│   ├── emergency/         # NUEVO: política de auto-acción
│   ├── feeders/           # NUEVO: cron del dispensador
│   ├── assistants/        # NUEVO: Ollama Llama 3.1 + chat
│   └── security/          # NUEVO: API key guard
├── .env.example
└── package.json
```

> Documentación detallada de actuadores en [`docs/actuators.md`](../docs/actuators.md) y del asistente en [`docs/assistant-plan.md`](../docs/assistant-plan.md).
