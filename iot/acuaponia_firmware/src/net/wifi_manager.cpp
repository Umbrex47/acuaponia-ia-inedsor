#include "wifi_manager.h"
#include "../config.h"
#include "../../arduino_secrets.h"

#include <WiFi.h>

void wifi_begin() {
  Serial.print("[WiFi] Conectando a ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] OK · IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WiFi] Sin conexión (se reintentará)");
  }
}

void wifi_ensure_connected() {
  if (WiFi.status() != WL_CONNECTED) wifi_begin();
}

bool wifi_connected() {
  return WiFi.status() == WL_CONNECTED;
}
