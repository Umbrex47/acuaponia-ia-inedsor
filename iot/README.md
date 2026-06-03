# Aquaponic OS · Firmware ESP32

Sketch para el ESP32 que lee un **módulo de termistor NTC** (tipo KY-028,
salida analógica `AO`) en **GPIO 15** y publica la temperatura por **MQTT**
al backend NestJS.

> ⚠️ **Importante (GPIO 15 / ADC2):** el GPIO 15 pertenece al ADC2 del ESP32,
> que **no funciona de forma fiable con el WiFi activo**. Si las lecturas
> salen en 0 o como "no disponible", mueve el cable `AO` a un pin del **ADC1**
> (GPIO 32, 33, 34, 35, 36 o 39) y cambia `PIN_SENSOR` en el sketch.

## Estructura

```
iot/
└── testing_acuaponia/
    ├── testing_acuaponia.ino   # Sketch principal
    └── arduino_secrets.h       # WiFi + broker MQTT (edítalo)
```

## Requisitos

### Arduino IDE

1. Instala el soporte para **ESP32**: en `Preferencias → URLs adicionales`
   añade `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
   y luego desde `Boards Manager` instala **esp32 by Espressif Systems**.
2. Selecciona la placa **ESP32 Dev Module**.

### Librerías (Library Manager)

| Librería | Autor |
|----------|-------|
| `PubSubClient` | Nick O'Leary |
| `ArduinoJson` (v6 o v7) | Benoît Blanchon |

`WiFi.h` viene incluida con el core ESP32.

## Cableado (módulo NTC tipo KY-028)

| Pin del módulo | ESP32 |
|----------------|-------|
| `+` / `VCC` | `3V3` |
| `G` / `GND` | `GND` |
| `AO` (analógico) | `GPIO 15` |
| `DO` (digital) | — (no se usa) |

- Usa el pin **`AO`**, que da un voltaje proporcional a la temperatura.
  El pin `DO` solo entrega ON/OFF según el **potenciómetro** (umbral) y no
  sirve para medir grados.
- El **potenciómetro** del módulo solo afecta al `DO`; no influye en la
  lectura analógica.

Para cambiar de pin, edita en `testing_acuaponia.ino`:

```cpp
const int PIN_SENSOR = 15;   // AO del módulo NTC
```

## Calibración del termistor

La conversión usa la **ecuación Beta** con valores típicos de un NTC 10k
(`B=3950`, resistencia serie 10k). Si la temperatura sale desfasada, ajusta
en el sketch:

```cpp
const float NTC_SERIES_R    = 10000.0f;
const float NTC_NOMINAL_R   = 10000.0f;
const float NTC_BETA        = 3950.0f;
const bool  NTC_ON_HIGH_SIDE = true;   // invierte a false si la lectura va al revés
```

Si la temperatura **sube cuando debería bajar**, cambia `NTC_ON_HIGH_SIDE`.

## Configuración

1. Abre `arduino_secrets.h`.
2. Rellena tu **SSID**, **password** y la **IP del PC** donde corre Mosquitto
   o el backend NestJS (`ipconfig` en Windows → `IPv4`):

   ```cpp
   #define WIFI_SSID      "MiRedWiFi"
   #define WIFI_PASSWORD  "********"
   #define MQTT_HOST      "192.168.1.50"
   ```

3. Sube el sketch. Abre el monitor serial a **115200 baudios** para ver el log.

## Mensaje publicado

Topic: `aquaponic/sensors/telemetry` (cada 5 s)

```json
{
  "sensors": {
    "temperatura": {
      "value": 27.4,
      "unit": "°C",
      "percent": 62,
      "status": "ok"
    }
  },
  "system": { "status": "stable", "statusLabel": "Estable" },
  "device": "esp32-acuaponia-01",
  "uptimeMs": 123456
}
```

El backend lo recibe en `MqttService`, lo reenvía por WebSocket a
`ws://localhost:8080/ws`, y el dashboard lo normaliza en
`frontend/src/data/normalizer.js` → actualiza el gauge de temperatura.

## Verificación end-to-end

1. Levanta el broker MQTT en el PC (Mosquitto, EMQX, etc.) en `:1883`.
2. `cd backend && npm run start:dev`
3. `cd frontend && npm run dev`
4. Sube el sketch al ESP32.
5. En el monitor serial verás:
   ```
   [SENSOR] Termistor NTC (AO) en GPIO 15
   [WiFi] OK · IP: 192.168.1.123
   [MQTT] Conectado
   [SENSOR] ADC=2048  V=1.650  R=10000Ω  T=24.30°C
   [MQTT] publish → aquaponic/sensors/telemetry · 178B · OK
   ```
   Si en su lugar ves `ADC=0` o "Lectura inválida", es el conflicto
   GPIO 15 / ADC2 con WiFi: mueve el cable `AO` a `GPIO 34`.
6. El dashboard React actualiza el gauge de temperatura en vivo.

## Debug rápido (sin ESP32)

Desde otra terminal puedes simular al ESP32 con `mosquitto_pub`:

```powershell
mosquitto_pub -h localhost -t aquaponic/sensors/telemetry -m `
  "{\"sensors\":{\"temperatura\":{\"value\":27.5,\"percent\":60,\"status\":\"ok\"}}}"
```

O activa el simulador del backend en `backend/.env`:
`MQTT_DEMO_ENABLED=true`.
