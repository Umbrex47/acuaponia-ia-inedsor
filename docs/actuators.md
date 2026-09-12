# Actuadores (bomba, aireador, dispensador)

> Estado: **MVP implementado**. La bomba ya existía (`PumpDecisionService`); se unificó en `ActuatorService` junto con los nuevos aireador y dispensador.

## Modelo

Los 3 actuadores se persisten en Mongo `actuators`:

```ts
{
  id: 'bomba_agua' | 'aireador' | 'dispensador_comida',
  label: string,
  kind: 'pump' | 'aerator' | 'feeder',
  mode: 'auto' | 'manual' | 'ia',
  on: boolean,
  minStateMs: number,
  lastChangeAt: number,
  currentLock: { clientId, expiresAt } | null,
  lastReason: string,
  lastActor: string,
}
```

## Topics MQTT

| Topic | Dirección | Payload |
|---|---|---|
| `aquaponic/commands/<id>` | backend → ESP32 | `{ actuator, action, reason, actor, mode, timestamp }` |
| `aquaponic/actuators/status/<id>` | ESP32 → backend | `{ on, reason, actor, timestamp }` |

Cuando el ESP32 reporta su estado real, `ActuatorService` actualiza `on` y `lastChangeAt`.

## Modos por actuador

| Modo | La IA… | La emergencia… | El operador… |
|---|---|---|---|
| `manual` | propone (chat) | actúa (lo registra como emergencia) | sí |
| `ia` | propone o ejecuta (si emergencia) | sí | sí (toma el control hasta volver a `ia`) |
| `auto` | propone | sí | sí |

> **Excepción de seguridad**: `EmergencyPolicy` siempre se evalúa, sin importar el modo. La seguridad del cultivo gana.

## Anti-ciclado

`ActuatorService.execute()` rechaza cambios si han pasado menos de `ACTUATORS_MIN_STATE_MS` desde el último cambio (default 60 s). Las emergencias pueden saltarse este límite con `bypassMode: true`.

## Locks multi-usuario

`POST /actuators/:id/lock { clientId }` adquiere un lock de 10 s (`ACTUATORS_LOCK_TTL_MS`). Si otro cliente lo tiene, la respuesta es `null`. La UI libera el lock tras cada acción o al desmontar.

Esto evita que dos operadores pisoteen acciones a la vez. La IA no respeta los locks (las emergencias se ejecutan siempre).

## Bitácora

Cada acción se registra en `actuator_actions` (TTL 90 días):

```ts
{
  actuatorId, action, actor, reason, source, ts
}
```

`actor` ∈ `user`, `ia`, `emergency`, `auto`.

## Dispensador (feeder)

`FeederSchedulerService` lee `feeder_schedules` (Mongo) y registra un cron por cada horario `HH:mm`. Al disparar, publica `aquaponic/commands/dispensador_comida` con `action: 'dispense'`.

Config por defecto:
- 3 horarios: `08:00`, `12:00`, `17:00`.
- Duración: 20 s.
- Porción: 15 g.

El panel web (FeedEditor) permite agregar/quitar horarios (`HH:mm`) y ajustar duración / porción.

## Firmware (resumen)

El ESP32 debe:

1. **Suscribirse** a `aquaponic/commands/<id>` para cada actuador.
2. **Procesar** el payload: si `action: 'on'` o `'dispense'`, activar el pin; si `action: 'off'`, desactivar.
3. **Publicar** el resultado en `aquaponic/actuators/status/<id>` con `{ on, reason, actor, timestamp }`.
4. **Dispensador**: implementar `oneShot(durationMs)` no bloqueante (no `delay()`).
5. **Telemetría**: añadir `comidaRestante_g` en el payload `sensors/telemetry` para que la IA pueda alertar antes de quedarse sin comida.

Referencia: `iot/acuaponia_firmware/`.

## Respuesta esperada

```bash
curl http://localhost:8080/actuators
# [
#   { "id": "bomba_agua", "label": "Bomba de agua", "kind": "pump", "mode": "ia", "on": false, ... },
#   { "id": "aireador", "label": "Aireador", "kind": "aerator", "mode": "ia", "on": true, ... },
#   { "id": "dispensador_comida", "label": "Dispensador de comida", "kind": "feeder", "mode": "manual", "on": false, ... }
# ]
```
