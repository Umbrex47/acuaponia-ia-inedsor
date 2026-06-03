const env = import.meta.env;

export const apiConfig = {
  api: {
    // Base HTTP del backend NestJS (para alertas manuales, historial, etc.)
    baseUrl: env.VITE_API_URL || 'http://localhost:8080',
  },
  websocket: {
    enabled: env.VITE_WS_ENABLED !== 'false',
    url: env.VITE_WS_URL || 'ws://localhost:8080/ws',
    reconnectMs: 3000,
    maxRetries: Infinity,
  },
  mqtt: {
    enabled: env.VITE_MQTT_ENABLED !== 'false',
    url: env.VITE_MQTT_URL || 'ws://localhost:9001',
    clientId: env.VITE_MQTT_CLIENT_ID || `aquaponic-${Date.now()}`,
    username: env.VITE_MQTT_USERNAME || undefined,
    password: env.VITE_MQTT_PASSWORD || undefined,
    reconnectMs: 3000,
    topics: {
      sensors: env.VITE_MQTT_TOPIC_SENSORS || 'aquaponic/sensors/#',
      fish: env.VITE_MQTT_TOPIC_FISH || 'aquaponic/fish/#',
      plants: env.VITE_MQTT_TOPIC_PLANTS || 'aquaponic/plants/#',
      cameras: env.VITE_MQTT_TOPIC_CAMERAS || 'aquaponic/cameras/#',
    },
  },
  cameras: {
    fish: env.VITE_CAMERA_FISH_URL || '',
    plants: env.VITE_CAMERA_PLANTS_URL || '',
  },
};

export const MQTT_TOPICS = Object.values(apiConfig.mqtt.topics);
