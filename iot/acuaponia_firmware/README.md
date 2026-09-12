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
        ├── bme280_sensor.h/.cpp       # Ambiente I2C (SDA=21, SCL=22) ← activo
        ├── arduino_slave.h/.cpp       # Esclavo Arduino por Serial2 (RX=16, TX=17) ← activo
        ├── turbidity_sensor.h/.cpp    # Turbidez analógica legacy (NO_USADO)
        ├── water_level_ultrasonic.*   # Nivel ultrasónico legacy (NO_USADO)
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
(o si borras la flash / usas «Restaurar broker de fábrica»). Tras “Guardar y
reiniciar”, la ESP32 reinicia y aplica la nueva red.

### Si el ESP32 no publica en EMQX (causa frecuente)

El portal SoftAP **pisa** `arduino_secrets.h`. Si alguna vez guardaste el
Mosquitto local (`10.x` / `192.168.x`, puerto **1883**, TLS off), esa config
sigue en NVS aunque recompiles con EMQX en secrets.

**Opción A — SoftAP (recomendada):**

1. Conéctate a `Aquaponic-Setup` / `acuaponia` → `http://192.168.4.1`
2. Broker:
   - Host: `a91836cf.ala.us-east-1.emqxsl.com`
   - **TLS activado**, puerto **8883**
   - Usuario `esp32` / clave del broker
   - ID: `esp32-acuaponia-01`
3. O pulsa **Restaurar broker de fábrica** (copia MQTT desde secrets, conserva WiFi)
4. Guarda / reinicia

**Opción B — Borrar NVS al flashear:** en Arduino IDE → *Herramientas* →
*Erase Flash: All Flash Contents* (o “Erase All”) y vuelve a subir el sketch.

En Serial (115200) deberías ver, en orden:

```
[CFG] Cargado desde NVS · … MQTT=a91836cf…:8883 (TLS sí)
   (o mensaje de migración automática del broker LAN antiguo)
[WiFi] STA OK · IP: …
[NTP] Hora sincronizada · epoch=…
[MQTT] Conectando a a91836cf…:8883 (TLS) como esp32-acuaponia-01
[MQTT] Conectado
[MQTT] publish → aquaponic/sensors/telemetry · …B · OK
```

Si aparece `MQTT=10.…:1883 (TLS no)` sin migración, actualiza por SoftAP.
Si `[NTP] Sin hora válida`, la red no llega a Internet (hotspot / DNS).
Si `Falló (rc=…)`, revisa usuario/clave o CA.

## Diagnóstico cuando un sensor no aparece en el dashboard

El firmware publica **siempre** una línea de telemetría en
`aquaponic/sensors/telemetry`, aunque todos los sensores estén caídos.
En ese caso el payload trae cada sensor con `value: null` y
`status: "unavailable"`, y el dashboard los muestra como **"No disponible"**
(en vez de ocultarlos). Esto permite distinguir:

| Caso | Síntoma | Dónde mirar |
| --- | --- | --- |
| Sensor físico mal conectado | Log `[DS18B20] Lectura inválida (-127.00°C)` | Pull-up 4.7 kΩ entre DATA (GPIO4) y 3.3 V |
| Sensor analógico saturado | Log `[EC] Lectura inválida (ADC=4095)` | Sonda fuera del agua, AO > Vref o pin equivocado |
| BME280 sin respuesta | Sin log `[BME280] Listo en I2C` | Dirección I2C 0x76/0x77, cableado SDA/SCL |
| Esclavo UART caído | Sin log `[SLAVE] OK` | TX del esclavo → GPIO 16, GND común |
| ESP32 sin publicar | `lastAt` viejo en backend (`/api/debug/last-mqtt`) | WiFi/MQTT, broker caído |

### Endpoint de diagnóstico del backend

`GET http://localhost:8080/api/debug/last-mqtt` devuelve:

- `lastRawPayload`: el último mensaje MQTT recibido, completo.
- `bySensor`: cada sensor conocido con su `value` y `lastAt`.

Si un sensor tiene `value: null` y `lastAt: null` pese a que la ESP32 está
publicando, **el firmware lo está omitiendo**. Lo que veas en el log serie
de la ESP32 te dice exactamente qué falla:

```
[DS18B20] No se detecta la sonda: revisa el pull-up 4.7k y que el pin sea bidireccional.
[BME280] No detectado — revisa cableado I2C y dirección 0x76/0x77
[SLAVE] JSON inválido: ...
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

## Nivel de agua y turbidez (Arduino esclavo → ESP32 por UART)

La pecera lleva un **Arduino esclavo** que lee el sensor ultrasónico (nivel) y
el sensor de turbidez, y los entrega a la ESP32 por **Serial2** como JSON por
línea. La ESP32 los reenvía a MQTT bajo las claves `nivelAgua` (cm) y
`turbiedad` (NTU).

**Contrato UART (Serial2, 9600 8N1):**

| Pin ESP32 | Conexión |
|---|---|
| GPIO 16 (RX) | TX del Arduino esclavo |
| GPIO 17 (TX) | RX del Arduino esclavo (opcional, no se usa hoy) |
| GND | GND del esclavo (**común obligatorio**) |

> ⚠️ No alimentar el Arduino desde el pin 3.3 V de la ESP32. Usa su propia
> fuente y **compartí solo GND** entre ambas placas.

**Formato JSON esperado** (una trama por línea, terminada en `\n`):

```json
{"nivelAgua":{"value":18.3,"unit":"cm"},"turbiedad":{"value":12.4,"unit":"NTU"}}
```

Si el esclavo deja de enviar durante más de `SLAVE_TIMEOUT_MS` (8 s, definido
en `config.h`), las dos lecturas se marcan como inválidas y el dashboard las
muestra como "No disponible".

**Liberación de pines:** GPIO 16 y 17 estaban asignados a los LEDs
indicadores (`PIN_LED_AIREADOR` y `PIN_LED_DISPENSADOR`). Se reasignaron a
**GPIO 13 y 14** para liberar el UART — verificar el cableado del panel de LEDs
si ya estaba armado.

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
