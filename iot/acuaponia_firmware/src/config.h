#pragma once

// ──────────────────────────────────────────────
//   Configuración general del firmware (NO secretos).
//   Los secretos (WiFi/MQTT) van en arduino_secrets.h
// ──────────────────────────────────────────────

// ── Pines de sensores ──
// Usa pines del ADC1 (32, 33, 34, 35, 36, 39) para lectura ANALÓGICA:
// el ADC2 (p. ej. GPIO 15) NO funciona con WiFi activo.
//
// La sonda DS18B20 (DFRobot, sumergible) es DIGITAL 1-Wire y necesita un pin
// BIDIRECCIONAL. Los GPIO 34/35/36/39 son SOLO de entrada y NO funcionan para
// 1-Wire; por eso el termómetro va en GPIO 4 (con pull-up de 4.7k a 3.3 V).
#if defined(ESP8266)

// ── Pines para ESP8266 (NodeMCU/ESP-12E) ──
#define PIN_TEMP   16        // D0 (GPIO16) - DS18B20 (con pull-up 4.7k)
#define PIN_EC     A0        // A0 - Solo hay 1 entrada analógica en ESP8266

// Esclavo Arduino (desactivado)
#define PIN_SLAVE_RX        -1
#define PIN_SLAVE_TX        -1
#define SLAVE_BAUD          9600
#define SLAVE_TIMEOUT_MS    8000

// Sensores legacy
#define PIN_TURB        -1
#define PIN_LEVEL_TRIG  -1
#define PIN_LEVEL_ECHO  -1
#define TANK_DEPTH_CM       32.0f
#define SENSOR_OFFSET_CM    7.0f

// Bus I2C (BME280 y LCD)
#define PIN_I2C_SDA  4       // D2
#define PIN_I2C_SCL  5       // D1

// Relés
#define PIN_RELAY_BOMBA_AGUA      14   // D5
#define PIN_RELAY_AIREADOR        12   // D6
#define PIN_RELAY_DISPENSADOR     13   // D7

// LEDs indicadores
// (Liberados por falta de pines en ESP8266, pero definidos por compatibilidad)
#define PIN_LED_AIREADOR    -1
#define PIN_LED_DISPENSADOR -1

// Nivel de agua por resistencias
#define PIN_LEVEL_LOW     0    // D3
#define PIN_LEVEL_MID     2    // D4
#define PIN_LEVEL_HIGH    3    // RX
#define PIN_BUZZER              15     // D8 (Pull-down interno)
#define BUZZER_PASSIVE          1
#define BUZZER_FREQ_HZ          2000
#define BUZZER_COUNTDOWN_MS     20000
#define BUZZER_BEEP_SHORT_MS    200
#define BUZZER_BEEP_LONG_MS     1000
#define BUZZER_BEEP_GAP_MS      250

#else

// ── Pines para ESP32 ──
#define PIN_TEMP   4         // DATA del DS18B20 (1-Wire) + pull-up 4.7k
#define PIN_EC     32        // AO del medidor de electroconductividad (ADC1)

#define PIN_SLAVE_RX        16
#define PIN_SLAVE_TX        17
#define SLAVE_BAUD          9600
#define SLAVE_TIMEOUT_MS    8000    // sin trama válida → lecturas "No disponible"

#define PIN_TURB        -1
#define PIN_LEVEL_TRIG  -1
#define PIN_LEVEL_ECHO  -1
#define TANK_DEPTH_CM       32.0f
#define SENSOR_OFFSET_CM    7.0f

// Bus I2C compartido (BME280 y otros sensores digitales)
#define PIN_I2C_SDA  21
#define PIN_I2C_SCL  22

// ── Relés / actuadores físicos ──
#define PIN_RELAY_BOMBA_AGUA      26   // backend id: bomba_agua
#define PIN_RELAY_AIREADOR        27   // backend id: aireador
#define PIN_RELAY_DISPENSADOR     25   // backend id: dispensador_comida

// ── LEDs indicadores de actuadores ──
#define PIN_LED_AIREADOR    13   // aireador → LED verde sugerido
#define PIN_LED_DISPENSADOR 14   // dispensador_comida → LED ámbar sugerido

// Nivel de agua por resistencias
#define PIN_LEVEL_LOW     35
#define PIN_LEVEL_MID     34
#define PIN_LEVEL_HIGH    33

// ── Buzzer de pre-aviso del dispensador ──
#define PIN_BUZZER              19
#define BUZZER_PASSIVE          1       // 1 = pasivo (tone), 0 = activo (HIGH/LOW)
#define BUZZER_FREQ_HZ          2000    // frecuencia para buzzer pasivo
#define BUZZER_COUNTDOWN_MS     20000   // 20 s de pre-aviso
#define BUZZER_BEEP_SHORT_MS    200     // duración del pitido corto
#define BUZZER_BEEP_LONG_MS     1000    // pitido largo al final de la cuenta
#define BUZZER_BEEP_GAP_MS      250     // pausa entre los dos pitidos cortos finales

#endif

// ── SoftAP del portal de configuración (siempre activo, AP+STA) ──
#define AP_SSID      "Aquaponic-Setup"
#define AP_PASSWORD  "acuaponia"     // mín. 8 caracteres (WPA2)
#define AP_HTTP_PORT 80

// ── NTP (obligatorio con MQTT sobre TLS: valida fechas del certificado) ──
#define NTP_SERVER_1     "pool.ntp.org"
#define NTP_SERVER_2     "time.nist.gov"
#define NTP_TIMEOUT_MS   8000
#define MQTT_TLS_TIMEOUT_S  15       // handshake TLS

// ── Temporización ──
// Telemetría activa: la ESP32 publica en MQTT cada PUBLISH_INTERVAL_MS si
// hay al menos un sensor válido registrado. Subí este valor si necesitás
// reducir tráfico/consumo.
#define PUBLISH_INTERVAL_MS  60000   // cada cuánto se evalúa la publicación
#define MQTT_RETRY_MS        3000    // reintento de conexión MQTT
#define WIFI_TIMEOUT_MS      20000   // espera máx. de conexión WiFi (STA)

// Topic al que el backend publica el estado de cada actuador.
// Formato del mensaje: {"on": true|false, "reason": "...", "actor": "...", "ts": "..."}.
// El ESP32 se suscribe aquí para reflejar el estado en los LEDs indicadores.
#define MQTT_TOPIC_ACTUATOR_STATUS_FMT "aquaponic/actuators/status/#"

// Topics de comandos de actuadores. El backend publica aquí cuando se ejecuta
// una acción (on/off/dispense). El ESP32 se suscribe al wildcard para encender
// relés físicos, activar el buzzer del dispensador y reenviar su estado real.
#define MQTT_TOPIC_ACTUATOR_COMMANDS_FMT "aquaponic/commands/+"
