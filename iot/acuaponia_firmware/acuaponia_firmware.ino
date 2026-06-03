// ────────────────────────────────────────────────────────────────
//   Aquaponic OS · Firmware ESP32 (arquitectura modular)
//
//   El .ino solo orquesta. La lógica vive en src/:
//     - src/config.h            → pines, intervalos
//     - src/net/                → WiFi y MQTT
//     - src/sensors/            → sensores + registro
//
//   Para AGREGAR un sensor:
//     1. Crea src/sensors/<sensor>.h / .cpp (funciones begin + read)
//     2. Regístralo en src/sensors/sensor_registry.cpp (una línea)
//
//   Librerías: PubSubClient (Nick O'Leary), ArduinoJson (B. Blanchon)
//   Placa: ESP32 Dev Module
// ────────────────────────────────────────────────────────────────

#include <ArduinoJson.h>

#include "arduino_secrets.h"
#include "src/config.h"
#include "src/net/wifi_manager.h"
#include "src/net/mqtt_manager.h"
#include "src/sensors/sensor_registry.h"

static unsigned long lastPublishMs = 0;

void publishTelemetry() {
  StaticJsonDocument<512> doc;
  JsonObject sensors = doc.createNestedObject("sensors");

  // Cada sensor activo agrega su bloque; los inválidos se omiten.
  sensors_build_payload(sensors);
  if (sensors.size() == 0) return;   // nada válido que enviar

  JsonObject system = doc.createNestedObject("system");
  system["status"]      = "stable";
  system["statusLabel"] = "Estable";
  doc["device"]   = MQTT_CLIENT_ID;
  doc["uptimeMs"] = millis();

  char buffer[512];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));
  bool ok = mqtt_publish(MQTT_TOPIC_TELEMETRY, (const uint8_t*)buffer, n, false);
  Serial.printf("[MQTT] publish → %s · %uB · %s\n",
                MQTT_TOPIC_TELEMETRY, (unsigned)n, ok ? "OK" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Aquaponic ESP32 (modular) · arrancando ===");

  sensors_begin();
  wifi_begin();
  mqtt_begin();
}

void loop() {
  wifi_ensure_connected();
  mqtt_ensure_connected();
  mqtt_loop();

  if (millis() - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = millis();
    if (mqtt_connected()) publishTelemetry();
  }
}
