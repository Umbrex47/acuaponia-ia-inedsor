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
#define PIN_TEMP   4         // DATA del DS18B20 (1-Wire) + pull-up 4.7k
#define PIN_EC     32        // AO del medidor de electroconductividad (ADC1)
#define PIN_TURB   33        // AO del sensor de turbidez (ADC1; divisor si AO>3.3 V)

// Sensor ultrasónico de nivel de agua (JSN-SR04T / HC-SR04)
#define PIN_LEVEL_TRIG  5    // Trigger (salida)
#define PIN_LEVEL_ECHO  18   // Echo (entrada)

// ── Geometría de la pecera para el nivel de agua (en cm) ──
// El sensor mira hacia abajo, montado por encima del borde de la pecera.
#define TANK_DEPTH_CM       32.0f   // profundidad útil de la pecera
#define SENSOR_OFFSET_CM    7.0f    // altura del sensor sobre el borde superior
// Distancia sensor→fondo = SENSOR_OFFSET_CM + TANK_DEPTH_CM (pecera vacía).

// Bus I2C compartido (BME280 y otros sensores digitales)
#define PIN_I2C_SDA  21
#define PIN_I2C_SCL  22

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
#define PUBLISH_INTERVAL_MS  2000    // cada cuánto se publica al broker
#define MQTT_RETRY_MS        3000    // reintento de conexión MQTT
#define WIFI_TIMEOUT_MS      20000   // espera máx. de conexión WiFi (STA)
