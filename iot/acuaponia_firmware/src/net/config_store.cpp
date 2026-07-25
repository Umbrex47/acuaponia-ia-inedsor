#include "config_store.h"
#include "../../arduino_secrets.h"

#include <Preferences.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>

static Preferences prefs;
static DeviceConfig g_cfg;
static bool g_persisted = false;

// Declaración anticipada: begin() puede migrar NVS llamando a save().
bool config_save(const DeviceConfig& cfg);

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

// Detecta brokers LAN típicos (IP privada / sin TLS) que suelen quedar
// pegados en NVS tras una config SoftAP anterior al paso a EMQX Cloud.
static bool host_looks_like_ip(const char* host) {
  if (!host || !host[0]) return false;
  for (const char* p = host; *p; ++p) {
    if (!(isdigit((unsigned char)*p) || *p == '.')) return false;
  }
  return true;
}

static bool is_private_ipv4(const char* host) {
  if (!host_looks_like_ip(host)) return false;
  int a = 0, b = 0, c = 0, d = 0;
  if (sscanf(host, "%d.%d.%d.%d", &a, &b, &c, &d) != 4) return false;
  if (a == 10) return true;
  if (a == 192 && b == 168) return true;
  if (a == 172 && b >= 16 && b <= 31) return true;
  return false;
}

static bool mqtt_looks_like_stale_lan(const DeviceConfig& cfg) {
  // Caso típico: 10.x / 192.168.x en 1883 sin TLS (Mosquitto local viejo).
  if (cfg.mqttTls) return false;
  if (cfg.mqttPort != 1883 && cfg.mqttPort != 1880) return false;
  return is_private_ipv4(cfg.mqttHost);
}

static bool secrets_look_like_cloud(const DeviceConfig& secrets) {
  return secrets.mqttTls && secrets.mqttPort == 8883 &&
         !host_looks_like_ip(secrets.mqttHost) &&
         secrets.mqttHost[0] != '\0';
}

static void apply_mqtt_from(const DeviceConfig& src, DeviceConfig& dst) {
  copy_cstr(dst.mqttHost, sizeof(dst.mqttHost), src.mqttHost);
  dst.mqttPort = src.mqttPort;
  copy_cstr(dst.mqttClientId, sizeof(dst.mqttClientId), src.mqttClientId);
  copy_cstr(dst.mqttUsername, sizeof(dst.mqttUsername), src.mqttUsername);
  copy_cstr(dst.mqttPassword, sizeof(dst.mqttPassword), src.mqttPassword);
  dst.mqttTls = src.mqttTls;
}

void config_store_begin() {
  DeviceConfig secrets;
  config_load_defaults(secrets);
  g_cfg = secrets;
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

  // Migración automática: NVS con Mosquitto LAN viejo + secrets apuntan a EMQX.
  // Conserva el WiFi del NVS; solo corrige broker/TLS/usuario.
  if (mqtt_looks_like_stale_lan(g_cfg) && secrets_look_like_cloud(secrets)) {
    Serial.printf(
        "[CFG] NVS tiene broker LAN antiguo (%s:%u, TLS off) · "
        "aplicando EMQX de arduino_secrets.h (%s:%u TLS)\n",
        g_cfg.mqttHost, (unsigned)g_cfg.mqttPort,
        secrets.mqttHost, (unsigned)secrets.mqttPort);
    apply_mqtt_from(secrets, g_cfg);
    if (config_save(g_cfg)) {
      Serial.println("[CFG] Migración guardada en NVS");
    } else {
      Serial.println("[CFG] Migración solo en RAM (falló escritura NVS)");
    }
  }
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

bool config_restore_mqtt_defaults() {
  DeviceConfig secrets;
  config_load_defaults(secrets);
  apply_mqtt_from(secrets, g_cfg);
  // Conserva WiFi actual; solo reescribe bloque MQTT.
  return config_save(g_cfg);
}

bool config_clear_nvs() {
  if (!prefs.begin("aquaponic", false)) {
    Serial.println("[CFG] No se pudo abrir NVS para borrar");
    return false;
  }
  prefs.clear();
  prefs.end();
  config_load_defaults(g_cfg);
  g_persisted = false;
  Serial.println("[CFG] NVS borrado · defaults de arduino_secrets.h en RAM");
  return true;
}
