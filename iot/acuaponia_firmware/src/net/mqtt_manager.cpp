#include "mqtt_manager.h"
#include "../config.h"
#include "../../arduino_secrets.h"

#include <WiFi.h>
#include <PubSubClient.h>

static WiFiClient   wifiClient;
static PubSubClient client(wifiClient);
static unsigned long lastTryMs = 0;

void mqtt_begin() {
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setKeepAlive(30);
  client.setBufferSize(512);
}

static bool connectOnce() {
  Serial.printf("[MQTT] Conectando a %s:%d como %s\n",
                MQTT_HOST, MQTT_PORT, MQTT_CLIENT_ID);

  // Last Will: el broker publica "offline" si el ESP32 se desconecta.
  bool ok = client.connect(
      MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD,
      MQTT_TOPIC_STATUS, 0, true, "{\"online\":false}");

  if (ok) {
    Serial.println("[MQTT] Conectado");
    client.publish(MQTT_TOPIC_STATUS, "{\"online\":true}", true);
  } else {
    Serial.printf("[MQTT] Falló (rc=%d)\n", client.state());
  }
  return ok;
}

void mqtt_ensure_connected() {
  if (client.connected()) return;
  if (millis() - lastTryMs < MQTT_RETRY_MS) return;
  lastTryMs = millis();
  connectOnce();
}

void mqtt_loop() { client.loop(); }

bool mqtt_connected() { return client.connected(); }

bool mqtt_publish(const char* topic, const uint8_t* payload,
                  unsigned int len, bool retain) {
  return client.publish(topic, payload, len, retain);
}
