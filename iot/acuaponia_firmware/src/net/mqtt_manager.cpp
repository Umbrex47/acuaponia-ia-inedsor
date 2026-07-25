#include "mqtt_manager.h"
#include "ca_certs.h"
#include "config_store.h"
#include "wifi_manager.h"
#include "../config.h"
#include "../../arduino_secrets.h"

#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

static WiFiClient       plainClient;
static WiFiClientSecure tlsClient;
static PubSubClient     client;
static unsigned long lastTryMs = 0;
static bool timeSynced = false;

// TLS valida las fechas del certificado, así que el reloj debe estar en hora.
static bool ensureTimeSynced() {
  if (timeSynced) return true;

  configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);

  const time_t MIN_VALID = 1700000000;  // ~nov 2023: descarta el reloj sin sincronizar
  unsigned long start = millis();
  time_t now = time(nullptr);
  while (now < MIN_VALID && millis() - start < NTP_TIMEOUT_MS) {
    delay(200);
    now = time(nullptr);
  }

  timeSynced = now >= MIN_VALID;
  if (timeSynced) {
    Serial.printf("[NTP] Hora sincronizada · epoch=%ld\n", (long)now);
  } else {
    Serial.println("[NTP] Sin hora válida · TLS fallará (se reintentará)");
  }
  return timeSynced;
}

void mqtt_begin() {
  const DeviceConfig& cfg = config_get();

  if (cfg.mqttTls) {
    tlsClient.setCACert(MQTT_ROOT_CA);
    tlsClient.setTimeout(MQTT_TLS_TIMEOUT_S);
    client.setClient(tlsClient);
  } else {
    client.setClient(plainClient);
  }

  client.setServer(cfg.mqttHost, cfg.mqttPort);
  client.setKeepAlive(30);
  // 7 sensores + system/device pueden superar 512 B fácilmente.
  client.setBufferSize(1536);
}

void mqtt_apply_config() {
  if (client.connected()) client.disconnect();
  mqtt_begin();
  lastTryMs = 0;
}

static bool connectOnce() {
  const DeviceConfig& cfg = config_get();
  const char* user = cfg.mqttUsername[0] ? cfg.mqttUsername : nullptr;
  const char* pass = cfg.mqttPassword[0] ? cfg.mqttPassword : nullptr;

  Serial.printf("[MQTT] Conectando a %s:%u%s como %s\n",
                cfg.mqttHost, (unsigned)cfg.mqttPort,
                cfg.mqttTls ? " (TLS)" : "", cfg.mqttClientId);

  // Last Will: el broker publica "offline" si el ESP32 se desconecta.
  bool ok = client.connect(
      cfg.mqttClientId, user, pass,
      MQTT_TOPIC_STATUS, 0, true, "{\"online\":false}");

  if (ok) {
    Serial.println("[MQTT] Conectado");
    client.publish(MQTT_TOPIC_STATUS, "{\"online\":true}", true);
  } else {
    // PubSubClient: -4 timeout, -3 lost, -2 failed, -1 disconnected,
    // 1..5 = refusals del broker (4=bad user/pass, 5=unauthorized).
    Serial.printf("[MQTT] Falló (rc=%d) · revisa host/TLS/NTP/credenciales\n",
                  client.state());
  }
  return ok;
}

void mqtt_ensure_connected() {
  if (client.connected()) return;
  if (!wifi_connected()) return;
  if (millis() - lastTryMs < MQTT_RETRY_MS) return;
  lastTryMs = millis();

  if (config_get().mqttTls && !ensureTimeSynced()) return;
  connectOnce();
}

void mqtt_loop() { client.loop(); }

bool mqtt_connected() { return client.connected(); }

bool mqtt_publish(const char* topic, const uint8_t* payload,
                  unsigned int len, bool retain) {
  return client.publish(topic, payload, len, retain);
}

const char* mqtt_client_id() {
  return config_get().mqttClientId;
}
