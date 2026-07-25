#include "wifi_manager.h"
#include "config_store.h"
#include "../config.h"

#include <WiFi.h>

static bool apStarted = false;

const char* wifi_ap_ssid() { return AP_SSID; }

bool wifi_ap_active() { return apStarted; }

IPAddress wifi_ap_ip() { return WiFi.softAPIP(); }

IPAddress wifi_sta_ip() { return WiFi.localIP(); }

int wifi_sta_rssi() {
  return wifi_connected() ? WiFi.RSSI() : 0;
}

static void startSoftAP() {
  if (apStarted) return;

  // Canal 1 fijo: estable junto a STA en la mayoría de routers domésticos.
  bool ok = WiFi.softAP(AP_SSID, AP_PASSWORD, 1, 0, 4);
  apStarted = ok;
  if (ok) {
    Serial.printf("[WiFi] SoftAP OK · SSID=%s · IP=%s\n",
                  AP_SSID, WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println("[WiFi] SoftAP falló");
  }
}

static void connectSta() {
  const DeviceConfig& cfg = config_get();
  if (cfg.wifiSsid[0] == '\0') {
    Serial.println("[WiFi] STA sin SSID configurado");
    return;
  }

  Serial.printf("[WiFi] STA conectando a %s\n", cfg.wifiSsid);
  WiFi.begin(cfg.wifiSsid, cfg.wifiPassword);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(400);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] STA OK · IP: %s · RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[WiFi] STA sin conexión (se reintentará)");
  }
}

void wifi_begin() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  startSoftAP();
  connectSta();
}

void wifi_ensure_connected() {
  if (WiFi.status() == WL_CONNECTED) return;
  // Reintento no bloqueante largo: vuelve a begin STA sin tumbar el SoftAP.
  static unsigned long lastTry = 0;
  if (millis() - lastTry < WIFI_TIMEOUT_MS) return;
  lastTry = millis();

  Serial.println("[WiFi] STA caído · reintentando");
  WiFi.disconnect(false, false);
  const DeviceConfig& cfg = config_get();
  if (cfg.wifiSsid[0] == '\0') return;
  WiFi.begin(cfg.wifiSsid, cfg.wifiPassword);
}

bool wifi_connected() {
  return WiFi.status() == WL_CONNECTED;
}
