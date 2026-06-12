// Configuración del cliente.
//
// Prioridad de resolución:
//   1. Runtime (window.__APP_CONFIG__) — inyectado por el contenedor en
//      producción (Docker/Coolify) vía /config.js. Permite cambiar URLs sin
//      reconstruir la imagen.
//   2. Variables de build de Vite (import.meta.env.VITE_*) — para desarrollo
//      local con frontend/.env.
//   3. Valores por defecto.
const runtime =
  (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};
const env = import.meta.env;

function pick(runtimeKey, envKey, fallback) {
  const r = runtime[runtimeKey];
  if (r !== undefined && r !== null && r !== '') return r;
  const e = env[envKey];
  if (e !== undefined && e !== null && e !== '') return e;
  return fallback;
}

// Booleano configurable: cualquier valor distinto de 'false' se considera true.
function flag(runtimeKey, envKey, fallback) {
  const v = pick(runtimeKey, envKey, fallback);
  return String(v) !== 'false';
}

export const apiConfig = {
  // Muestra el aviso de demostración al cargar la página.
  demoMode: flag('demoMode', 'VITE_DEMO_MODE', false),
  api: {
    // Base HTTP del backend NestJS (para alertas manuales, historial, etc.)
    baseUrl: pick('apiUrl', 'VITE_API_URL', 'http://localhost:8080'),
  },
  websocket: {
    enabled: flag('wsEnabled', 'VITE_WS_ENABLED', true),
    url: pick('wsUrl', 'VITE_WS_URL', 'ws://localhost:8080/ws'),
    reconnectMs: 3000,
    maxRetries: Infinity,
  },
  mqtt: {
    enabled: flag('mqttEnabled', 'VITE_MQTT_ENABLED', true),
    url: pick('mqttUrl', 'VITE_MQTT_URL', 'ws://localhost:9001'),
    clientId:
      pick('mqttClientId', 'VITE_MQTT_CLIENT_ID', '') ||
      `aquaponic-${Date.now()}`,
    username: pick('mqttUsername', 'VITE_MQTT_USERNAME', '') || undefined,
    password: pick('mqttPassword', 'VITE_MQTT_PASSWORD', '') || undefined,
    reconnectMs: 3000,
    topics: {
      sensors: pick('mqttTopicSensors', 'VITE_MQTT_TOPIC_SENSORS', 'aquaponic/sensors/#'),
      fish: pick('mqttTopicFish', 'VITE_MQTT_TOPIC_FISH', 'aquaponic/fish/#'),
      plants: pick('mqttTopicPlants', 'VITE_MQTT_TOPIC_PLANTS', 'aquaponic/plants/#'),
      cameras: pick('mqttTopicCameras', 'VITE_MQTT_TOPIC_CAMERAS', 'aquaponic/cameras/#'),
    },
  },
  cameras: {
    fish: pick('cameraFishUrl', 'VITE_CAMERA_FISH_URL', ''),
    plants: pick('cameraPlantsUrl', 'VITE_CAMERA_PLANTS_URL', ''),
  },
};

export const MQTT_TOPICS = Object.values(apiConfig.mqtt.topics);
