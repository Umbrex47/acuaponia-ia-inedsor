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

/**
 * Normaliza la URL del WebSocket del backend Nest (`@WebSocketGateway({ path: '/ws' })`).
 * - Convierte http(s) → ws(s) si alguien pegó la URL de la API.
 * - Si la URL no tiene path (o solo `/`), fuerza `/ws`.
 * - Si ya termina en `/ws`, la deja igual.
 */
function normalizeWsUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'ws://localhost:8080/ws';

  let value = raw.trim();
  if (value.startsWith('https://')) value = `wss://${value.slice('https://'.length)}`;
  else if (value.startsWith('http://')) value = `ws://${value.slice('http://'.length)}`;

  try {
    const parsed = new URL(value);
    // Origen puro (wss://host o wss://host/) → siempre /ws.
    // Un path explícito distinto (p. ej. /ws, /mqtt) se respeta.
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/ws';
    }
    // Evitar barra final: wss://host/ws/ no es el path del gateway.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '') ||
      'ws://localhost:8080/ws';
  } catch {
    return 'ws://localhost:8080/ws';
  }
}

function resolveWsUrl() {
  const explicit = pick('wsUrl', 'VITE_WS_URL', '');
  if (explicit) return normalizeWsUrl(explicit);

  // Sin VITE_WS_URL: derivar del host HTTP de la API + /ws.
  const apiBase = pick('apiUrl', 'VITE_API_URL', 'http://localhost:8080');
  return normalizeWsUrl(apiBase);
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
    url: resolveWsUrl(),
    reconnectMs: 3000,
    maxRetries: Infinity,
  },
  assistant: {
    enabled: flag('assistantEnabled', 'VITE_ASSISTANT_ENABLED', true),
    url: normalizeAssistantUrl(
      pick('assistantUrl', 'VITE_ASSISTANT_URL', '') ||
        pick('chatUrl', 'VITE_CHAT_URL', ''),
    ),
    apiKey: pick('assistantApiKey', 'VITE_ASSISTANT_API_KEY', ''),
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

function normalizeAssistantUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    const apiBase = pick('apiUrl', 'VITE_API_URL', 'http://localhost:8080');
    return normalizeWsUrl(apiBase.replace(/^http/, 'ws') + '/chat');
  }
  return normalizeWsUrl(raw);
}

export const MQTT_TOPICS = Object.values(apiConfig.mqtt.topics);
