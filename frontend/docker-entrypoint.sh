#!/bin/sh
# Genera /config.js a partir de las variables de entorno APP_*.
# Se ejecuta automáticamente al arrancar el contenedor de nginx, antes de que
# el servidor empiece a atender peticiones.
set -e

CONFIG_FILE="/usr/share/nginx/html/config.js"

cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = {
  apiUrl: "${APP_API_URL}",
  wsUrl: "${APP_WS_URL}",
  wsEnabled: "${APP_WS_ENABLED:-true}",
  mqttUrl: "${APP_MQTT_URL}",
  mqttEnabled: "${APP_MQTT_ENABLED:-false}",
  mqttClientId: "${APP_MQTT_CLIENT_ID}",
  mqttUsername: "${APP_MQTT_USERNAME}",
  mqttPassword: "${APP_MQTT_PASSWORD}",
  cameraFishUrl: "${APP_CAMERA_FISH_URL}",
  cameraPlantsUrl: "${APP_CAMERA_PLANTS_URL}",
  demoMode: "${APP_DEMO_MODE:-true}"
};
EOF

echo "[entrypoint] config.js generado (apiUrl='${APP_API_URL}', wsUrl='${APP_WS_URL}')"
