#pragma once

// Copia este archivo como arduino_secrets.h y completa tus credenciales.
// arduino_secrets.h está en .gitignore y NO debe subirse al repositorio.

// WiFi
#define WIFI_SSID       "TU_RED_WIFI"
#define WIFI_PASSWORD   "TU_CLAVE_WIFI"

// Broker MQTT (IP del PC con Mosquitto / backend)
#define MQTT_HOST       "192.168.1.100"
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "esp32-acuaponia-01"

#define MQTT_USERNAME   NULL
#define MQTT_PASSWORD   NULL

#define MQTT_TOPIC_TELEMETRY  "aquaponic/sensors/telemetry"
#define MQTT_TOPIC_STATUS     "aquaponic/sensors/status"
