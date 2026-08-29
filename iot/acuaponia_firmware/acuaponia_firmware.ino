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
#include "src/actuators/actuator_relay.h"
#include "src/actuators/buzzer.h"
#include "src/actuators/led_indicators.h"
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

  // Publicamos SIEMPRE, incluso si todos los sensores son inválidos:
  // el dashboard necesita saber que la ESP32 está viva y qué slots
  // están en estado "unavailable". Si no publicáramos nada, el backend
  // no podría distinguir "ESP32 caída" de "ESP32 sin sensores conectados".
  int validCount   = 0;
  int invalidCount = 0;
  for (JsonPair kv : sensors) {
    JsonObject o = kv.value().as<JsonObject>();
    const char* s = o["status"] | "unknown";
    if (strcmp(s, "unavailable") == 0) invalidCount++;
    else                              validCount++;
  }

  const char* sysStatus   = (validCount > 0) ? "stable" : "no_sensors";
  const char* sysStatusLb = (validCount > 0) ? "Estable" : "Sin sensores";

  JsonObject system = doc.createNestedObject("system");
  system["status"]      = sysStatus;
  system["statusLabel"] = sysStatusLb;
  system["validCount"]   = validCount;
  system["invalidCount"] = invalidCount;
  doc["device"]   = mqtt_client_id();
  doc["uptimeMs"] = millis();

  char buffer[1536];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));
  if (n == 0 || n >= sizeof(buffer)) {
    Serial.printf("[MQTT] JSON truncado/vacío · n=%u · no se publica\n", (unsigned)n);
    return;
  }
  bool ok = mqtt_publish(MQTT_TOPIC_TELEMETRY, (const uint8_t*)buffer, n, false);
  Serial.printf("[MQTT] publish → %s · %uB · %s · válidos=%d inválidos=%d\n",
                MQTT_TOPIC_TELEMETRY, (unsigned)n, ok ? "OK" : "FAIL",
                validCount, invalidCount);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("=== Aquaponic ESP32 (modular) · arrancando ===");

  // Apagar actuadores/indicadores lo antes posible para evitar pulsos
  // de encendido durante el arranque de WiFi/MQTT.
  relay_begin();
  led_begin();
  buzzer_begin();

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
  led_loop();
  buzzer_loop();
  relay_loop();

  if (millis() - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = millis();
    if (mqtt_connected()) publishTelemetry();
  }
}
