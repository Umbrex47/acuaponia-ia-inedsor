# Diagrama resumido de actuadores (referencia)

> Solo referencia para cuando llegue el hardware de relés. No requiere nada
> físico ahora — mientras tanto el firmware corre con sensores simulados
> (`src/sensors/sim_actuadores.*`).

## Mapa GPIO → actuador

| Actuador            | ID backend        | GPIO ESP32 | Tipo        | Módulo recomendado                  |
|---------------------|-------------------|------------|-------------|--------------------------------------|
| Bomba de agua       | `bomba_agua`      | **GPIO 26** | Relé 5 V    | Módulo relé 1 canal con optoacoplador (activo LOW) |
| Aireador            | `aireador`        | **GPIO 27** | Relé 5 V    | Módulo relé 1 canal con optoacoplador (activo LOW) |
| Dispensador comida  | `dispensador_comida` | **GPIO 25** | Relé 5 V o servo PWM | Relé (motor DC) o SG90 (compuerta PWM) |

Pines GPIO 25/26/27 son seguros: bidireccionales, sin restricciones de boot
(al contrario que GPIO 0/2/12/15), y no chocan con los pines de sensores
reservados en `src/config.h` (4, 5, 18, 21, 22, 32, 33).

## Esquema (un canal genérico, repetir 3 veces)

```
                          Módulo relé 5 V (1 canal)
                         ┌─────────────────────────┐
  ESP32 GPIO 26 ────────►│ IN                      │
                         │                         │
  ESP32 5V (Vin) ───────►│ VCC  ───  [optoacoplador]
                         │                         │
  ESP32 GND  ───────────►│ GND                     │
                         └────────┬────────────────┘
                                  │
                          ┌───────┴───────┐
                          │  COM   NO  NC │   ← bornes de salida
                          └───┬─────┬─────┘
                              │     │
                              │     └─► (NC normalmente abierto, no se usa)
                              │
                              ▼
                          Carga (bomba 12 V, aireador 110 V, motor DC)
                              │
                              ▼
                          GND / Neutro / −V de la fuente de carga
```

Cada actuador usa su propia fuente (12 V para bomba, 5 V o 110 V para
aireador, 5 V para dispensador). **El módulo relé aísla la ESP32 de la carga**.

## Detalle bomba de agua (12 V)

```
  ESP32 GPIO 26 ──► IN  ┐
  ESP32 GND     ──► GND │ Módulo relé 5V
  ESP32 Vin(5V) ──► VCC ┘
                       │
                       └─ COM ───► +12V ───► Bomba ───► GND ─┐
                              NO                                │
                              │                                 │
                              └─────── (cerrado cuando GPIO26=LOW)

  Fuente 12 V independiente (≥ 2 A), GND común con la ESP32.
```

## Detalle aireador (110/220 V AC — **CUIDADO**)

Si el aireador va a la red eléctrica, usar un módulo relé con aislamiento
galvánico (todos los relés 5 V con optoacoplador lo traen) y **nunca**
manipularlo conectado. Mejor aún: usar un enchufe inteligente con bobina
24 V o un contactor externo.

## Detalle dispensador de comida

- Si es **motor DC con tolva** (tipo "feeder auger"): módulo relé + driver
  puente-H L298N para invertir giro.
- Si es **servo SG90** (compuerta): cable de señal directo al GPIO 25 (PWM),
  VCC 5 V desde fuente externa (el SG90 consume ~150 mA, no alimentes
  desde el pin 5 V de la ESP32), GND común.

## Tópico MQTT (firmware → backend)

El ESP32 reporta el estado físico del relé al topic
`aquaponic/actuators/status/<id>` para que el backend confirme que el comando
llegó. Ejemplo para `bomba_agua`:

```json
{
  "on": true,
  "reason": "nivel < offLevel",
  "actor": "ia",
  "ts": "2026-08-16T12:34:56Z"
}
```

## BOM mínimo (referencia)

| Cant. | Componente                          | Notas                                  |
|-------|--------------------------------------|----------------------------------------|
| 3     | Módulo relé 5 V 1 canal optoacoplado| LOW-trigger; con bornera, ideal para protoboard |
| 1     | Fuente 12 V ≥ 3 A                   | Para bomba de agua (y como reserva)     |
| 1     | Driver L298N (opcional)             | Solo si el dispensador es motor DC     |
| 1     | SG90 + fuente 5 V ≥ 1 A (opcional)  | Solo si el dispensador es servo        |
| 3     | Cable dupont M-F 30 cm              | GPIO ESP32 → IN módulo relé             |
| —     | Protoboard + cables                  | Ensamblaje                             |

## Notas operativas

- Los relés activos en **LOW** (`digitalWrite(pin, LOW)` enciende) son los más
  comunes en módulos baratos. Confirmar con el datasheet del módulo; si es
  activo en HIGH, simplemente invertir la lógica en el firmware.
- `minStateMs` en backend (60 s por defecto) evita ciclado; al simular
  esperá ese tiempo entre cambios para no ver "Anti-ciclado" en los logs.
- Para pruebas iniciales sin carga real, conecta un LED + 220 Ω en lugar del
  relé en uno de los GPIO — el backend reportará el cambio igual.

## Flujo MQTT de actuadores

1. El backend publica un comando en `aquaponic/commands/<id>` con
   `{"action":"on"|"off"|"dispense", ...}`.
2. El ESP32 recibe el comando, acciona el relé correspondiente y publica
   su estado real en `aquaponic/actuators/status/<id>`.
3. Tanto el backend como el ESP32 usan ese topic de status para encender los
   LEDs indicadores y actualizar el dashboard.