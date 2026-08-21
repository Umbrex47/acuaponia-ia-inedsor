# Aquaponic OS · Arduino esclavo (nivelAgua → ESP32)

Sketch para un **Arduino UNO / Nano / Pro Mini** que:

1. Lee el sensor ultrasónico **JSN-SR04T / HC-SR04** (Trig/Echo).
2. Emite **una línea JSON por segundo** por puerto serie hacia la ESP32.

La ESP32 (firmware `iot/acuaponia_firmware`) lo recibe por **Serial2 (RX = GPIO 16)** y lo reenvía por MQTT bajo la clave `nivelAgua` (cm).

> La turbidez **ya no se envía desde el esclavo**: la ESP32 la toma por
> otra vía o, si no la hay, el dashboard la marca como "No disponible".

---

## Hardware

| Pin Arduino | Conexión |
|---|---|
| **D9**  | Trig del ultrasónico |
| **D10** | Echo del ultrasónico |
| **D11** | TX hacia ESP32 (GPIO 16, RX) — ver nota UART abajo |
| **GND** | GND de la ESP32 (**común obligatorio**) |
| **5 V** | VCC del módulo ultrasónico |

> ⚠️ El pin **Echo** del JSN-SR04T entrega 5 V. Arduino UNO/Nano lo toleran
> en sus pines digitales, así que va directo. Si usás un Arduino de 3.3 V
> (Due, MKR, etc.), agregá un divisor 1 kΩ / 2 kΩ en Echo.

### Alimentación
No alimentar el módulo ultrasónico desde la ESP32.
Usá una fuente separada o el USB del propio Arduino.

---

## UART hacia la ESP32

Arduino UNO/Nano tienen **un solo UART** y comparten `Serial` con el USB
(`D0` RX / `D1` TX). Si conectás **D1 → ESP32 GPIO 16**:

- **Mientras sube el sketch**: desconectá físicamente la línea hacia la
  ESP32, o el bootloader falla (D1 queda bloqueado).
- **Durante la operación**: **perdés el Monitor Serie USB** para debug.
  Verás los logs en la **Serial de la ESP32** (115200 baud, USB CDC).

Si necesitás **debug por USB a la vez** (recomendado durante desarrollo),
usá `SoftwareSerial` en D11 (TX) → ESP32 GPIO 16:

```cpp
#include <SoftwareSerial.h>
SoftwareSerial espLink(10, 11);   // RX=10, TX=11
// en setup(): emit: espLink.begin(9600);
// en emitJson():  espLink.print(...);
```

Y cambiá en el sketch las llamadas `Serial.print(...)` de `emitJson` por
`espLink.print(...)`. Mantené `Serial.println(...)` solo para debug USB.

---

## Formato emitido

Una línea por segundo, terminada en `\n`:

```json
{"nivelAgua":{"value":18.3,"unit":"cm"}}
```

Si la lectura falla, el campo `value` se emite como `null`. La ESP32 lo
descarta y publica el sensor como "No disponible" tras 8 s sin tramas
válidas.

---

## Calibración

| Parámetro | Dónde | Default |
|---|---|---|
| Geometría pecera | `TANK_DEPTH_CM`, `SENSOR_OFFSET_CM` | 32 cm + 7 cm |
| Intervalo | `PUB_INTERVAL_MS` | 1000 ms |
| Baud | `SERIAL_BAUD` | 9600 |

Calibrá la geometría cuando tengas la pecera lista.

---

## Cómo subirlo

1. Abrir `acuaponia_slave.ino` en Arduino IDE.
2. Placa: **Arduino Uno** (o Nano, según tu hardware).
3. Librería: **ArduinoJson** (Library Manager).
4. **Desconectar** el cable TX (D1 o D11 según configuración) hacia la ESP32.
5. Subir.
6. Reconectar TX → ESP32 GPIO 16.
7. Verificar en la **Serial de la ESP32** que aparece
   `[SLAVE] OK · nivel=… cm`.