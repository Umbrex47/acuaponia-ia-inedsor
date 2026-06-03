# Aquaponic OS · Firmware ESP32 (arquitectura modular)

Versión reorganizada del firmware, pensada para **muchos sensores**.
Separa la **configuración de conexión** (WiFi/MQTT) de la **configuración de
sensores**, y permite agregar un sensor nuevo con **un archivo + una línea**.

> El sketch original `../testing_acuaponia/` se mantiene intacto. Esta carpeta
> es la nueva base a la que puedes migrar cuando quieras.

## Estructura

```
acuaponia_firmware/
├── acuaponia_firmware.ino     # Orquestador: setup() + loop()
├── arduino_secrets.h          # Credenciales WiFi/MQTT (privado)
└── src/
    ├── config.h               # Pines, intervalos (NO secretos)
    ├── net/
    │   ├── wifi_manager.h/.cpp    # Conexión + reconexión WiFi
    │   └── mqtt_manager.h/.cpp    # Conexión MQTT, publish, Last Will
    └── sensors/
        ├── sensor_types.h             # struct Reading + SensorDef
        ├── sensor_registry.h/.cpp     # Lista de sensores + armado del JSON
        ├── temperature_ds18b20.h/.cpp # Sonda sumergible DFRobot (1-Wire, GPIO 4) ← activo
        └── temperature_ntc.h/.cpp     # Termistor NTC analógico (alternativa)
```

## Termómetro sumergible DFRobot (DS18B20)

El sensor sumergible de DFRobot (DFR0198) es un **DS18B20 digital 1-Wire**, no
analógico. Requisitos de conexión en el ESP32:

- **Pin DATA en GPIO 4** (un GPIO *bidireccional*). Los GPIO 34/35/36/39 son
  solo de entrada y **no** sirven para 1-Wire.
- **Resistencia pull-up de 4.7 kΩ** entre DATA y 3.3 V. La placa adaptadora
  "Gravity" de DFRobot ya la incluye.
- Cableado de la sonda: **Rojo → 3.3 V**, **Negro → GND**, **Amarillo/Azul (DATA)
  → GPIO 4**.
- Librerías (Arduino Library Manager): **OneWire** y **DallasTemperature**.

## Electroconductividad DFRobot (DFR0300)

Mide cuántas sales/nutrientes hay disueltos en el agua (salida en **mS/cm**).

- **Pin señal (A) → GPIO 32** (ADC1, compatible con WiFi).
- **VCC → 3.3 V** (el módulo acepta 3.3–5 V; con 3.3 V no hace falta divisor).
- **GND → GND**.
- La **sonda con dos electrodos** va sumergida en la cama de cultivo / agua a medir.
- Calibra con solución estándar (p. ej. 1413 µS/cm) según el manual DFRobot.
- La compensación por temperatura usa 25 °C fijos por ahora; cuando el DS18B20
  esté estable, se puede enlazar para lecturas más precisas.

## BME280 (ambiente: temperatura, humedad, presión)

Sensor **I2C** para el **aire** (no sumergible). Publica tres parámetros:

| Parámetro MQTT | Qué mide |
|---|---|
| `temperaturaAmbiente` | Temperatura del aire (°C) |
| `humedad` | Humedad relativa (%) |
| `presion` | Presión barométrica (hPa) |

**Cableado (Gravity / breakout estándar):**

| Pin BME280 | ESP32 |
|---|---|
| VCC | 3.3 V |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |

- Dirección I2C: **0x76** (SDO→GND) o **0x77** (SDO→VCC). El firmware prueba ambas.
- Librerías Arduino: **Adafruit BME280 Library** + **Adafruit Unified Sensor**.
- Diferencia con el DS18B20: el BME mide **aire**; el DS18B20 mide **agua**.

## Nivel de agua (ultrasónico JSN-SR04T / HC-SR04)

Mide la **altura de la columna de agua** (clave `nivelAgua`, en **cm**).

**Cableado:**

| Pin sensor | ESP32 |
|---|---|
| VCC | 5 V |
| GND | GND |
| Trig | GPIO 5 |
| Echo | GPIO 18 |

> ⚠️ El pin **Echo** entrega 5 V. Si tu módulo no es de 3.3 V, usa un divisor
> de voltaje (p. ej. 1 kΩ + 2 kΩ) hacia GPIO 18 para no dañar la ESP32.

**Geometría (en `config.h`):** el sensor mira hacia abajo, montado por encima
del borde de la pecera:

```c
#define TANK_DEPTH_CM     32.0f   // profundidad de la pecera
#define SENSOR_OFFSET_CM  7.0f    // altura del sensor sobre el borde
```

El firmware calcula: `nivel = (7 + 32) − distancia_medida`, lo limita a
`0…32 cm` y publica también el % de llenado. Si cambias la pecera o reubicas el
sensor, ajusta solo esas dos constantes.

> **Nota Arduino IDE:** solo se compilan los archivos de la raíz del sketch y
> los de la carpeta `src/` (recursivamente). Por eso todo va bajo `src/`.

## Cómo agregar un sensor nuevo

Ejemplo: sensor de pH en GPIO 35.

**1. Crea `src/sensors/ph_sensor.h`:**

```cpp
#pragma once
#include "sensor_types.h"

void    ph_begin();
Reading ph_read();
```

**2. Crea `src/sensors/ph_sensor.cpp`:**

```cpp
#include "ph_sensor.h"
#include "../config.h"

void ph_begin() {
  // pinMode / calibración inicial si hace falta
}

Reading ph_read() {
  int adc = analogRead(PIN_PH);
  // ... conversión a pH ...
  float ph = 7.0f;                 // valor calculado
  bool ok  = (adc > 5 && adc < 4090);
  return { ph, /*percent*/ 70, "ok", ok };
}
```

**3. Añade el pin en `src/config.h`:**

```cpp
#define PIN_PH 35
```

**4. Regístralo en `src/sensors/sensor_registry.cpp`:**

```cpp
#include "ph_sensor.h"            // (1) incluir

static SensorDef SENSORS[] = {
  { "temperatura", "°C", ntc_begin, ntc_read },
  { "ph",          "",   ph_begin,  ph_read },   // (2) registrar
};
```

¡Listo! El `loop()` y la capa de red no se tocan. El nuevo sensor aparece
solo en el dashboard.

## Claves válidas (deben coincidir con el frontend)

`temperatura`, `ph`, `oxigeno`, `nivelAgua`, `nitratos`, `co2`,
`electroconductividad`, `turbiedad`, `temperaturaAmbiente`, `humedad`, `presion`
(ver `frontend/src/data/normalizer.js`).

## Contrato de cada sensor

Cada `read()` devuelve un `Reading`:

| Campo | Significado |
|-------|-------------|
| `value` | Valor físico (°C, mg/L, pH…) |
| `percent` | 0–100 para el medidor circular |
| `status` | `"ok"`, `"warn"` o `"critical"` |
| `valid` | `false` → no se publica (el dashboard lo marca "No disponible") |

## Configuración

1. Edita `arduino_secrets.h` (WiFi + IP del broker).
2. Ajusta pines/intervalos en `src/config.h`.
3. Librerías: **PubSubClient** y **ArduinoJson**.
4. Sube el sketch (placa: ESP32 Dev Module).

## Mensaje publicado

Topic `aquaponic/sensors/telemetry` (cada `PUBLISH_INTERVAL_MS`):

```json
{
  "sensors": {
    "temperatura": { "value": 24.3, "unit": "°C", "percent": 47, "status": "warn" }
  },
  "system": { "status": "stable", "statusLabel": "Estable" },
  "device": "esp32-acuaponia-01",
  "uptimeMs": 123456
}
```
