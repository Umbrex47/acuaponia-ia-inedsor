# Asistente IA (Llama 3.1 8B vía Ollama)

> Estado: **MVP implementado**. El asistente corre local con Ollama, integra sensores + actuadores y propone acciones vía tool-calling estructurado.

## Arquitectura

```
[ESP32] ──MQTT──► [Broker] ──► [NestJS]
                              │   ├── EmergencyPolicy (auto-actúa en O₂<3, nivel<10, T>32)
                              │   ├── ActuatorService (bomba / aireador / dispensador)
                              │   ├── FeederScheduler (cron configurable)
                              │   └── AssistantService ── Ollama (llama3.1:8b-q4_0)
                              │                            │
                              ▼                            ▼
                       [WebSocket /ws]                [WebSocket /chat]
                              │                            │
                              ▼                            ▼
                       [Dashboard React]            [ChatWindow + ProposalPanel]
```

## Modelo

- **llama3.1:8b-q4_0** (quantized 4-bit, ≈ 4.7 GB RAM).
- Configurable vía `OLLAMA_MODEL` (en producción: `llama3.1:8b` fp16 si tienes 16 GB).
- Parámetros: `OLLAMA_NUM_CTX=2048`, `OLLAMA_NUM_PREDICT=256`, `OLLAMA_TEMPERATURE=0.2`.

## Tools disponibles para la IA

| Tool | Args | Acción |
|---|---|---|
| `get_current_state` | — | Lee readings + última telemetría |
| `get_actuator_status` | `actuatorId` | Estado y modo de un actuador |
| `propose_actuator_command` | `id, actuatorId, action, reason` | Crea propuesta en Mongo + emite evento |
| `execute_actuator_command` | `id, actuatorId, action, reason` | Ejecuta directamente (solo en emergencias) |
| `get_recent_history` | `minutes` | Resumen de las últimas acciones |
| `schedule_feeder` | `times[], durationMs?, portionG?` | Reprograma dispensador |

Cada tool-call se valida con `zod` antes de ejecutarse.

## Reglas innegociables (en el system prompt)

1. **No publicar MQTT directamente** — solo vía `ActuatorService`.
2. **Acciones no urgentes** → `propose_actuator_command` (la UI muestra la propuesta al operador).
3. **Acciones urgentes** (O₂ crítico, nivel mínimo, etc.) → `execute_actuator_command` directo.
4. **Modo manual** → proponer, nunca ejecutar.
5. **Citar evidencia** en cada propuesta (lectura concreta).
6. **Idioma español, unidades métricas, conciso.**

## Política de emergencias (auto-acción)

`EmergencyPolicyService` evalúa reglas determinísticas en cada payload MQTT:

| Regla | Sensor | Umbral | Acción |
|---|---|---|---|
| `o2_critical` | `oxigeno` | `< 3 mg/L` | `aireador: on` |
| `o2_extreme` | `oxigeno` | `< 2 mg/L` | `bomba_agua: on` (solo modo `ia`) |
| `nivel_dry` | `nivelAgua` | `< 10 cm` | `bomba_agua: off` (anti-marcha en seco) |
| `temperatura_alta` | `temperatura` | `> 32 °C` | `aireador: on` |

Cooldown: `EMERGENCY_COOLDOWN_MS` (default 60 s).

## Endpoints

| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| `WS` | `/chat` | opcional | Chat streaming |
| `POST` | `/assistant/chat` | opcional | Chat HTTP (fallback) |
| `GET` | `/assistant/history` | opcional | Historial de chat |
| `GET` | `/assistant/proposals` | opcional | Cola de propuestas pendientes |
| `POST` | `/assistant/proposals/resolve` | opcional | Aprobar/Rechazar propuesta |
| `GET` | `/actuators` | opcional | Lista de actuadores |
| `POST` | `/actuators/:id/execute` | API key | Acción manual |
| `POST` | `/actuators/:id/mode` | API key | Cambia modo (`ia` / `manual` / `auto`) |
| `POST` | `/actuators/:id/lock` | opcional | Lock multi-usuario (10 s) |
| `POST` | `/actuators/:id/unlock` | opcional | Libera lock |
| `GET` | `/feeder/schedule` | opcional | Config actual |
| `POST` | `/feeder/schedule` | API key | Guarda horarios |
| `POST` | `/feeder/dispense` | API key | Disparo manual |

## Configuración

`backend/.env`:

```bash
ASSISTANT_ENABLED=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b-q4_0
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_PREDICT=256
OLLAMA_TEMPERATURE=0.2
ASSISTANT_API_KEY=<secreto-fuerte>
REQUIRE_API_KEY=true

FEEDER_ENABLED=true
FEEDER_TIMES=08:00,12:00,17:00
FEEDER_DURATION_MS=20000
FEEDER_PORTION_G=15

EMERGENCY_ENABLED=true
EMERGENCY_COOLDOWN_MS=60000

ACTUATORS_MIN_STATE_MS=60000
ACTUATORS_LOCK_TTL_MS=10000
```

`frontend/.env`:

```bash
VITE_ASSISTANT_URL=ws://localhost:8080/chat
VITE_ASSISTANT_ENABLED=true
VITE_ASSISTANT_API_KEY=<mismo-secreto>
```

## Levantar Ollama local

```bash
# Linux/WSL/Mac
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b-q4_0
ollama serve   # deja corriendo en :11434
```

En Windows: descargar el instalador de [ollama.com](https://ollama.com/download).

## Pruebas manuales

```bash
# 1) Estado de actuadores
curl http://localhost:8080/actuators

# 2) Encender aireador manualmente
curl -X POST http://localhost:8080/actuators/aireador/execute \
  -H "Authorization: Bearer $ASSISTANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"on","reason":"test manual"}'

# 3) Cambiar horario del dispensador
curl -X POST http://localhost:8080/feeder/schedule \
  -H "Authorization: Bearer $ASSISTANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"times":["09:00","14:00","19:00"],"durationMs":25000,"portionG":20}'

# 4) Listar propuestas pendientes
curl http://localhost:8080/assistant/proposals
```

## Limitaciones y notas

- **La IA nunca publica MQTT**: ninguna tool entrega acceso al broker. Toda acción pasa por `ActuatorService.execute()`.
- **El modo `manual` bloquea a la IA** pero NO a `EmergencyPolicy` (la seguridad del cultivo gana).
- **El modelo puede "alucinar"** — por eso los tool-calls se validan con `zod` y los argumentos inválidos se rechazan antes de tocar hardware.
- **El historial de chat se persiste en Mongo** (`chat_sessions`, TTL 30 días). Configura Mongo para producción.
- **La API key estática** se exige en producción con `REQUIRE_API_KEY=true`. En dev local puede dejarse vacía.
