#pragma once

#include <Arduino.h>

// Credenciales persistentes (NVS). Si NVS está vacío se usan los
// valores de arduino_secrets.h como semilla inicial.

struct DeviceConfig {
  char wifiSsid[33];
  char wifiPassword[65];
  char mqttHost[80];
  uint16_t mqttPort;
  char mqttClientId[32];
  char mqttUsername[32];
  char mqttPassword[64];
  bool mqttTls;          // true → MQTT sobre TLS (8883, valida el root CA)
};

void config_store_begin();
const DeviceConfig& config_get();

// Copia los defaults de arduino_secrets.h (sin escribir NVS).
void config_load_defaults(DeviceConfig& out);

// Persiste y actualiza la copia en RAM. Devuelve false si falla la escritura.
bool config_save(const DeviceConfig& cfg);

// true si ya había datos guardados en NVS (no solo defaults en RAM).
bool config_was_persisted();
