# Tests individuales por sensor / actuador

Cada subcarpeta contiene **un único `.ino`** que prueba de forma aislada
un sensor, un actuador o una vía de comunicación. Todos se cargan en la
**ESP32** con Arduino IDE (placa **ESP32 Dev Module**, puerto COM correcto)
y arrancan sin tocar el resto del sistema.

## Sensores

| Test | Cubre | Conexión | Notas |
| --- | --- | --- | --- |
| `test_ds18b20/` | Termómetro sumergible DS18B20 | GPIO 4 (DATA), 3.3 V, GND, **pull-up 4.7 kΩ** | Si no detecta la sonda, activa pull-up interno para confirmar que falta el externo. |
| `test_bme280/` | Sensor ambiental (T ambiente, HR, presión) | GPIO 21 (SDA), 22 (SCL), 3.3 V, GND | Incluye **scanner I2C** que imprime todas las direcciones detectadas. |
| `test_ec/` | Electroconductividad analógica | GPIO 32, 3.3 V (sin divisor) o 5 V (con divisor) | Imprime ADC crudo, voltaje y mS/cm estimado. Detecta saturación y desconexión. |
| `test_ultrasonido/` | JSN-SR04T / HC-SR04 (Trig/Echo) | GPIO 5 (Trig), 18 (Echo con divisor si Echo=5 V), 5 V, GND | Útil para descartar al esclavo. En producción, este sensor lo lee el Arduino esclavo. |
| `test_turbidez/` | Turbidez analógica (AO) | GPIO 33 (con divisor 1 kΩ + 2 kΩ), 5 V, GND | Imprime ADC y voltaje AO. En producción lo lee el Arduino esclavo. |

## Comunicación con el Arduino esclavo

| Test | Cubre | Conexión | Notas |
| --- | --- | --- | --- |
| `test_serial2_slave/` | UART entre ESP32 y Arduino esclavo | GPIO 16 (RX), 17 (TX), GND común | Modo **loopback** interno (sin Arduino) para verificar que el puerto abre. Cambiá `ENABLE_LOOPBACK=0` para leer al esclavo real. |

## Actuadores

| Test | Cubre | Conexión | Notas |
| --- | --- | --- | --- |
| `test_relays/` | Relés de bomba, aireador y dispensador | GPIO 26, 27, 25 | Activos en LOW por defecto. Cambiá `ACTIVE_LOW=0` si tu módulo es HIGH. |
| `test_leds_only/` | LEDs indicadores (aireador, dispensador) | GPIO 13, 14 | Verifica polaridad y cableado de cada LED. |
| `test_buzzer_only/` | Buzzer (4 diagnósticos: activo, pasivo, barrido, PWM) | GPIO 19 | Distingue buzzer activo vs pasivo. |
| `test_buzzer_leds/` | Buzzer + LEDs juntos | GPIO 13, 14, 19 | Útil para verificar la rutina de cuenta regresiva del dispensador. |

## Cómo usarlos

1. Abrir Arduino IDE.
2. **Desconectar** la ESP32 del Arduino esclavo (TX → GPIO 16) **antes de subir** el sketch, o el bootloader falla.
3. Abrir el `.ino` del test deseado.
4. Verificar el board y el puerto COM.
5. **Subir y abrir el Monitor Serie a 115200 baud**.
6. La salida muestra el diagnóstico y, cuando aplica, qué revisar.

## Orden sugerido para diagnosticar

Si el firmware principal reporta sensores caídos, probá en este orden:

1. **`test_serial2_slave/`** con `ENABLE_LOOPBACK=1` (sin Arduino). Confirma que el UART abre y podés recibir bytes por GPIO 16.
2. **`test_bme280/`**. Confirma I2C + dirección 0x76/0x77.
3. **`test_ds18b20/`**. Si no detecta la sonda, agregá pull-up 4.7 kΩ.
4. **`test_ec/`** con la sonda en agua. Si ADC=4095, falta divisor resistivo.
5. **`test_turbidez/`** con la sonda en agua clara. Verifica divisor.
6. **`test_ultrasonido/`**. Útil solo si querés descartar al esclavo Arduino.
7. **`test_relays/`**, **`test_leds_only/`**, **`test_buzzer_only/`** según el actuador que estés validando.