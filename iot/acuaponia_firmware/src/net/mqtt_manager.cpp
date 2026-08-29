#include "mqtt_manager.h"
#include "ca_certs.h"
#include "config_store.h"
#include "wifi_manager.h"
#include "../actuators/actuator_relay.h"
#include "../actuators/buzzer.h"
#include "../actuators/led_indicators.h"
#include "../config.h"
#include "../../arduino_secrets.h"

#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>
#include <string.h>

static WiFiClient       plainClient;
static WiFiClientSecure tlsClient;
static PubSubClient     client;
static unsigned long lastTryMs = 0;
static bool timeSynced = false;

// Forward declaration: definidas más abajo en este archivo.
static void onMqttMessage(char* topic, byte* payload, unsigned int length);
static void publishActuatorStatus(const char* id, bool on, const char* reason);

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

static void onRelayStatusChanged(const char* id, bool on, const char* reason) {
  publishActuatorStatus(id, on, reason);
}

void mqtt_begin() {
  relay_begin();
  relay_set_status_callback(onRelayStatusChanged);

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
  client.setCallback(onMqttMessage);
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

    // Suscripción al estado de actuadores para reflejarlo en los LEDs.
    int subId = client.subscribe(MQTT_TOPIC_ACTUATOR_STATUS_FMT, 1);
    Serial.printf("[MQTT] Suscrito: %s (subId=%d, %s)\n",
                  MQTT_TOPIC_ACTUATOR_STATUS_FMT, subId,
                  subId >= 0 ? "OK" : "FAIL");

    // Suscripción a todos los comandos de actuadores para encender/apagar
    // relés físicos y disparar el buzzer del dispensador.
    int cmdId = client.subscribe(MQTT_TOPIC_ACTUATOR_COMMANDS_FMT, 1);
    Serial.printf("[MQTT] Suscrito: %s (cmdId=%d, %s)\n",
                  MQTT_TOPIC_ACTUATOR_COMMANDS_FMT, cmdId,
                  cmdId >= 0 ? "OK" : "FAIL");
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

// Helper: publica el estado físico real del actuador en el topic de status.
static void publishActuatorStatus(const char* id, bool on, const char* reason) {
  StaticJsonDocument<256> doc;
  doc["on"] = on;
  doc["reason"] = reason ? reason : "";
  doc["actor"] = "esp32";
  doc["ts"] = millis();

  char payload[256];
  size_t n = serializeJson(doc, payload, sizeof(payload));
  if (n == 0 || n >= sizeof(payload)) return;

  char statusTopic[80];
  snprintf(statusTopic, sizeof(statusTopic), "aquaponic/actuators/status/%s", id);
  // Estado sin retain: si la ESP32 se reinicia no queremos que reciba su
  // propio mensaje viejo y encienda LEDs de forma errónea.
  bool ok = mqtt_publish(statusTopic, (const uint8_t*)payload, (unsigned int)n, false);
  Serial.printf("[MQTT] status publish → %s · %s\n", statusTopic, ok ? "OK" : "FAIL");
}

// ── Handler de mensajes MQTT ────────────────────────────────────────────
// Procesa:
//   - `aquaponic/actuators/status/<id>` → refleja el estado en los LEDs.
//   - `aquaponic/commands/<id>`         → ejecuta relé físico y reenvía status.
// Otros topics se ignoran silenciosamente.
static void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (!topic) return;
  const size_t tlen = strlen(topic);
  if (tlen == 0) return;

  Serial.printf("[MQTT] msg recibido · topic=%s · len=%u\n", topic, length);

  // ── 1) Comando de actuador → relé físico + buzzer del dispensador ───
  static const char CMD_MARKER[] = "aquaponic/commands/";
  const size_t cmdLen = sizeof(CMD_MARKER) - 1;
  if (tlen > cmdLen && strncmp(topic, CMD_MARKER, cmdLen) == 0) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
      Serial.printf("[MQTT] payload inválido en %s\n", topic);
      return;
    }
    // Copiamos id a un buffer local porque 'topic' es un buffer interno de
    // PubSubClient que puede reutilizarse después del callback.
    char id[32];
    strncpy(id, topic + cmdLen, sizeof(id) - 1);
    id[sizeof(id) - 1] = '\0';

    const char* actionTmp = doc["action"] | "";
    char action[16];
    strncpy(action, actionTmp, sizeof(action) - 1);
    action[sizeof(action) - 1] = '\0';

    if (strcmp(action, "on") != 0 && strcmp(action, "off") != 0
        && strcmp(action, "dispense") != 0) {
      Serial.printf("[MQTT] acción desconocida para %s: %s\n", id, action);
      return;
    }

    Serial.printf("[MQTT] Comando recibido · %s → %s\n", id, action);

    bool applied = false;
    if (strcmp(id, "dispensador_comida") == 0 && strcmp(action, "dispense") == 0) {
      // El dispensador arranca con una cuenta regresiva de aviso; el relé se
      // activa al final del countdown (ver buzzer.cpp). Encendemos el LED de
      // aviso inmediatamente para que el operador vea que hay una dispensación
      // programada.
      buzzer_start_countdown();
      publishActuatorStatus(id, true, "dispensador en cuenta regresiva");
      applied = true;
    } else {
      applied = relay_execute(id, action);
      if (!applied) {
        Serial.printf("[MQTT] id de actuador desconocido: %s\n", id);
        return;
      }
      const char* reasonTmp = doc["reason"] | "";
      char reason[64];
      strncpy(reason, reasonTmp, sizeof(reason) - 1);
      reason[sizeof(reason) - 1] = '\0';
      publishActuatorStatus(id, relay_is_on(id), reason);
    }
    return;
  }

  // ── 2) Estado de actuadores → LEDs ────────────────────────────────
  // Buscamos el prefijo completo "aquaponic/actuators/status/" y lo que
  // venga después es el id del actuador.
  static const char STATUS_PREFIX[] = "aquaponic/actuators/status/";
  const size_t slen = sizeof(STATUS_PREFIX) - 1;
  if (tlen <= slen || strncmp(topic, STATUS_PREFIX, slen) != 0) return;

  Serial.printf("[MQTT] msg es status · topic=%s\n", topic);

  const char* idRaw = topic + slen;  // id tras el prefijo
  if (!*idRaw) return;
  char id[32];
  strncpy(id, idRaw, sizeof(id) - 1);
  id[sizeof(id) - 1] = '\0';

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
    Serial.printf("[MQTT] payload inválido en %s\n", topic);
    return;
  }
  if (!doc["on"].is<bool>()) {
    Serial.println("[MQTT] status sin campo bool 'on'");
    return;
  }

  Serial.printf("[MQTT] actualizando LED · %s → %s\n", id, doc["on"].as<bool>() ? "ON" : "OFF");
  setActuatorState(id, doc["on"].as<bool>());
}
