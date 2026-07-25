#pragma once

#include <Arduino.h>
#include <IPAddress.h>

// WiFi en modo AP+STA: SoftAP siempre activo para el portal de config;
// STA se conecta a la red del hogar con credenciales de NVS / secrets.

void wifi_begin();             // arranca SoftAP + intenta STA
void wifi_ensure_connected();  // reconecta solo STA si se cayó
bool wifi_connected();         // STA conectado
bool wifi_ap_active();

IPAddress wifi_sta_ip();
IPAddress wifi_ap_ip();
const char* wifi_ap_ssid();
int wifi_sta_rssi();
