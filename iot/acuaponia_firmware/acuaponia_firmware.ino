// ────────────────────────────────────────────────────────────────
//   Aquaponic OS · Firmware ESP32 (arquitectura modular)
//
//   El .ino solo orquesta. La lógica vive en src/:
//     - src/config.h            → pines, intervalos, SoftAP
//     - src/net/                → WiFi AP+STA, MQTT, portal, NVS
//     - src/sensors/            → sensores + registro
//
//   Portal de configuración (siempre activo):
//     1. Conéctate al SoftAP "Aquaponic-Setup" (clave: acuaponia)
//     2. Abre http://192.168.4.1
//     3. Ajusta WiFi hogar + MQTT, reinicia o deep sleep
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
#include "src/net/config_store.h"
#include "src/net/wifi_manager.h"
#include "src/net/mqtt_manager.h"
#include "src/net/config_portal.h"
#include "src/sensors/sensor_registry.h"

static unsigned long lastPublishMs = 0;

void publishTelemetry() {
  // Con varios sensores el JSON supera 512 B; 1536 deja margen.
  StaticJsonDocument<1536> doc;
  JsonObject sensors = doc.createNestedObject("sensors");

  sensors_build_payload(sensors);
  if (sensors.size() == 0) {
    // Sigue publicando un heartbeat para diagnosticar conectividad MQTT
    // aunque ningún sensor esté listo (antes se silenciaba por completo).
    Serial.println("[MQTT] Sin lecturas válidas · publicando heartbeat");
  }

  JsonObject system = doc.createNestedObject("system");
  system["status"]      = sensors.size() ? "stable" : "no_sensors";
  system["statusLabel"] = sensors.size() ? "Estable" : "Sin sensores";
  doc["device"]   = mqtt_client_id();
  doc["uptimeMs"] = millis();

  char buffer[1536];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));
  if (n == 0 || n >= sizeof(buffer)) {
    Serial.printf("[MQTT] JSON truncado/vacío · n=%u · no se publica\n", (unsigned)n);
    return;
  }
  bool ok = mqtt_publish(MQTT_TOPIC_TELEMETRY, (const uint8_t*)buffer, n, false);
  Serial.printf("[MQTT] publish → %s · %uB · %s\n",
                MQTT_TOPIC_TELEMETRY, (unsigned)n, ok ? "OK" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Aquaponic ESP32 (modular) · arrancando ===");

  config_store_begin();
  sensors_begin();
  wifi_begin();
  config_portal_begin();
  mqtt_begin();
}

void loop() {
  config_portal_loop();
  wifi_ensure_connected();
  mqtt_ensure_connected();
  mqtt_loop();

  if (millis() - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = millis();
    if (mqtt_connected()) publishTelemetry();
  }
}
