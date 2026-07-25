#include "config_store.h"
#include "../../arduino_secrets.h"

#include <Preferences.h>
#include <string.h>

static Preferences prefs;
static DeviceConfig g_cfg;
static bool g_persisted = false;

static void copy_cstr(char* dst, size_t dstLen, const char* src) {
  if (!src) src = "";
  strncpy(dst, src, dstLen - 1);
  dst[dstLen - 1] = '\0';
}

void config_load_defaults(DeviceConfig& out) {
  memset(&out, 0, sizeof(out));
  copy_cstr(out.wifiSsid, sizeof(out.wifiSsid), WIFI_SSID);
  copy_cstr(out.wifiPassword, sizeof(out.wifiPassword), WIFI_PASSWORD);
  copy_cstr(out.mqttHost, sizeof(out.mqttHost), MQTT_HOST);
  out.mqttPort = (uint16_t)MQTT_PORT;
  copy_cstr(out.mqttClientId, sizeof(out.mqttClientId), MQTT_CLIENT_ID);
  copy_cstr(out.mqttUsername, sizeof(out.mqttUsername),
            MQTT_USERNAME ? MQTT_USERNAME : "");
  copy_cstr(out.mqttPassword, sizeof(out.mqttPassword),
            MQTT_PASSWORD ? MQTT_PASSWORD : "");
  out.mqttTls = (MQTT_TLS != 0);
}

void config_store_begin() {
  config_load_defaults(g_cfg);
  g_persisted = false;

  if (!prefs.begin("aquaponic", true)) {
    Serial.println("[CFG] NVS no disponible · usando arduino_secrets.h");
    return;
  }

  if (!prefs.isKey("wifiSsid")) {
    prefs.end();
    Serial.println("[CFG] Sin datos en NVS · usando arduino_secrets.h");
    return;
  }

  String ssid = prefs.getString("wifiSsid", g_cfg.wifiSsid);
  String pass = prefs.getString("wifiPass", g_cfg.wifiPassword);
  String host = prefs.getString("mqttHost", g_cfg.mqttHost);
  uint16_t port = prefs.getUShort("mqttPort", g_cfg.mqttPort);
  String cid  = prefs.getString("mqttCid", g_cfg.mqttClientId);
  String user = prefs.getString("mqttUser", g_cfg.mqttUsername);
  String mpw  = prefs.getString("mqttPass", g_cfg.mqttPassword);
  bool tls    = prefs.getBool("mqttTls", g_cfg.mqttTls);
  prefs.end();

  copy_cstr(g_cfg.wifiSsid, sizeof(g_cfg.wifiSsid), ssid.c_str());
  copy_cstr(g_cfg.wifiPassword, sizeof(g_cfg.wifiPassword), pass.c_str());
  copy_cstr(g_cfg.mqttHost, sizeof(g_cfg.mqttHost), host.c_str());
  g_cfg.mqttPort = port;
  copy_cstr(g_cfg.mqttClientId, sizeof(g_cfg.mqttClientId), cid.c_str());
  copy_cstr(g_cfg.mqttUsername, sizeof(g_cfg.mqttUsername), user.c_str());
  copy_cstr(g_cfg.mqttPassword, sizeof(g_cfg.mqttPassword), mpw.c_str());
  g_cfg.mqttTls = tls;
  g_persisted = true;

  Serial.printf("[CFG] Cargado desde NVS · WiFi=%s · MQTT=%s:%u (TLS %s)\n",
                g_cfg.wifiSsid, g_cfg.mqttHost, (unsigned)g_cfg.mqttPort,
                g_cfg.mqttTls ? "sí" : "no");
}

const DeviceConfig& config_get() { return g_cfg; }

bool config_was_persisted() { return g_persisted; }

bool config_save(const DeviceConfig& cfg) {
  if (!prefs.begin("aquaponic", false)) {
    Serial.println("[CFG] No se pudo abrir NVS para escritura");
    return false;
  }

  prefs.putString("wifiSsid", cfg.wifiSsid);
  prefs.putString("wifiPass", cfg.wifiPassword);
  prefs.putString("mqttHost", cfg.mqttHost);
  prefs.putUShort("mqttPort", cfg.mqttPort);
  prefs.putString("mqttCid", cfg.mqttClientId);
  prefs.putString("mqttUser", cfg.mqttUsername);
  prefs.putString("mqttPass", cfg.mqttPassword);
  prefs.putBool("mqttTls", cfg.mqttTls);
  prefs.end();

  g_cfg = cfg;
  g_persisted = true;
  Serial.println("[CFG] Guardado en NVS");
  return true;
}
