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
├── arduino_secrets.h          # Credenciales semilla WiFi/MQTT (privado)
└── src/
    ├── config.h               # Pines, intervalos, SoftAP (NO secretos)
    ├── net/
    │   ├── config_store.h/.cpp    # NVS: WiFi + MQTT persistentes
    │   ├── config_portal.h/.cpp   # Web SoftAP + captive portal
    │   ├── wifi_manager.h/.cpp    # AP+STA siempre activo
    │   └── mqtt_manager.h/.cpp    # MQTT con config runtime
    └── sensors/
        ├── sensor_types.h             # struct Reading + SensorDef
        ├── sensor_registry.h/.cpp     # Lista de sensores + armado del JSON
        ├── temperature_ds18b20.h/.cpp # Sonda sumergible DFRobot (1-Wire, GPIO 4) ← activo
        ├── ec_sensor.h/.cpp           # Electroconductividad (GPIO 32) ← activo
        ├── turbidity_sensor.h/.cpp    # Turbidez / NTU (GPIO 33) ← activo
        ├── bme280_sensor.h/.cpp       # Ambiente I2C ← activo
        ├── water_level_ultrasonic.*   # Nivel de agua ← activo
        └── temperature_ntc.h/.cpp     # Termistor NTC analógico (alternativa)
```

## Portal de configuración (SoftAP)

El firmware arranca en **AP+STA**: sigue conectándose a tu WiFi de hogar y,
en paralelo, publica un punto de acceso para configurar el módulo desde el móvil.

| Dato | Valor |
|------|-------|
| SSID SoftAP | `Aquaponic-Setup` |
| Clave SoftAP | `acuaponia` |
| URL | `http://192.168.4.1` |

Desde la web puedes:

- Cambiar **SSID/clave** de la red WiFi del hogar
- Escanear redes cercanas
- Ajustar **host/puerto/usuario/clave/ID** del broker MQTT
- **Reiniciar** la ESP32
- **Apagar** (deep sleep; despierta con el botón EN/RESET)

Los valores se guardan en **NVS**. `arduino_secrets.h` solo se usa la primera vez
(o si borras la flash). Tras “Guardar y reiniciar”, la ESP32 reinicia y aplica
la nueva red.

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

## Turbidez (SEN0189 / módulo analógico AO)

Mide la **turbiedad del agua** en **NTU** (clave MQTT `turbiedad`). Agua clara
→ voltaje AO alto; agua turbia → voltaje bajo.

**Cableado:**

| Pin sensor | ESP32 |
|---|---|
| VCC | **5 V** (el módulo suele requerirlo) |
| GND | GND |
| AO  | **GPIO 33** (ADC1), vía divisor de voltaje |

> ⚠️ AO puede llegar a ~4.5 V. El ADC1 del ESP32 solo tolera **~3.3 V**. Usa un
> divisor (p. ej. 1 kΩ + 2 kΩ → ratio 1.5) y ajusta `DIVIDER_RATIO` en
> `turbidity_sensor.cpp`. Sin divisor puedes dañar el pin.

**Calibración:** el firmware usa la cuadrática DFRobot
`NTU = -1120.4·V² + 5742.3·V − 4353.8` sobre la tensión reconstruida del AO
(`V_ao = V_adc × DIVIDER_RATIO`; `V_ao ≥ 4.2` → 0 NTU). Es una aproximación de
fábrica: calibra en campo ajustando `DIVIDER_RATIO`, `NTU_A/B/C` o
`CLEAR_VOLTAGE`.

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

1. Copia `arduino_secrets.example.h` → `arduino_secrets.h` y pon WiFi + IP del broker (semilla inicial).
2. Ajusta pines/intervalos/SoftAP en `src/config.h` si hace falta.
3. Librerías: **PubSubClient** y **ArduinoJson**.
4. Sube el sketch (placa: ESP32 Dev Module).
5. Conéctate a `Aquaponic-Setup` / `acuaponia` y abre `http://192.168.4.1` para
   cambiar WiFi/MQTT sin reflash.

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
