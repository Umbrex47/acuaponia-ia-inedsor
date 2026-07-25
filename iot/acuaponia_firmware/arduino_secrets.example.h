#pragma once

// Copia este archivo como arduino_secrets.h y completa tus credenciales.
// arduino_secrets.h está en .gitignore y NO debe subirse al repositorio.
//
// Estos valores son la SEMILLA inicial. Tras el primer arranque puedes
// cambiar WiFi/MQTT desde el portal SoftAP (Aquaponic-Setup → 192.168.4.1);
// lo guardado en NVS tiene prioridad sobre este archivo.
//
// Si guardaste un broker LAN (IP 10.x / 192.168.x, puerto 1883, TLS off) y
// luego pasaste a EMQX Cloud aquí, el firmware migra solo ese caso al boot.
// También: SoftAP → «Restaurar broker de fábrica», o Erase Flash al subir.

// WiFi (red del hogar / laboratorio)
#define WIFI_SSID       "TU_RED_WIFI"
#define WIFI_PASSWORD   "TU_CLAVE_WIFI"

// Broker MQTT.
//   · Local (Mosquitto en tu PC):  host = IP del PC, puerto 1883, MQTT_TLS 0
//   · Nube (EMQX / HiveMQ):        host = xxxx.emqxsl.com, puerto 8883, MQTT_TLS 1
// Con MQTT_TLS 1 se valida el root CA de src/net/ca_certs.h y se sincroniza
// la hora por NTP (el certificado tiene fecha de caducidad).
#define MQTT_HOST       "192.168.1.100"
#define MQTT_PORT       1883
#define MQTT_TLS        0
#define MQTT_CLIENT_ID  "esp32-acuaponia-01"

// Con broker en la nube son obligatorios; en Mosquitto anónimo usa NULL.
#define MQTT_USERNAME   NULL
#define MQTT_PASSWORD   NULL

// Topics (fijos en firmware; no se editan desde el portal)
#define MQTT_TOPIC_TELEMETRY  "aquaponic/sensors/telemetry"
#define MQTT_TOPIC_STATUS     "aquaponic/sensors/status"
