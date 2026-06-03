#pragma once
#include <Arduino.h>

// Gestión de la conexión MQTT.
void mqtt_begin();
void mqtt_ensure_connected();   // reconecta si hace falta (no bloqueante)
void mqtt_loop();               // mantener el cliente vivo (llamar en loop)
bool mqtt_connected();
bool mqtt_publish(const char* topic, const uint8_t* payload,
                  unsigned int len, bool retain);
