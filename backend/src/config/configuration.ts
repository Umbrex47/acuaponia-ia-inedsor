export default () => ({
  port: parseInt(process.env.PORT ?? '8080', 10),
  mqtt: {
    url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID ?? 'aquaponic-backend',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectMs: parseInt(process.env.MQTT_RECONNECT_MS ?? '3000', 10),
    topicPrefix: process.env.MQTT_TOPIC_PREFIX ?? 'aquaponic',
    demoEnabled: process.env.MQTT_DEMO_ENABLED === 'true',
    demoIntervalMs: parseInt(process.env.MQTT_DEMO_INTERVAL_MS ?? '5000', 10),
  },
  mail: {
    // Si MAIL_HOST está vacío, las alertas por correo quedan deshabilitadas.
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER || '',
    password: process.env.MAIL_PASSWORD || '',
    from: process.env.MAIL_FROM || 'Aquaponic OS <no-reply@aquaponic.local>',
    // Lista de destinatarios separada por comas.
    to: (process.env.MAIL_TO || '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean),
  },
  telegram: {
    // Si TELEGRAM_BOT_TOKEN está vacío, las alertas por Telegram se deshabilitan.
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    // IDs de chat destino separados por comas (usuarios, grupos o canales).
    chatIds: (process.env.TELEGRAM_CHAT_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  },
  alerts: {
    enabled: process.env.ALERTS_ENABLED !== 'false',
    // Tiempo mínimo (ms) entre correos para un mismo sensor, evita spam.
    cooldownMs: parseInt(process.env.ALERTS_COOLDOWN_MS ?? '300000', 10),
  },
  mongodb: {
    // Si MONGODB_URI está vacío, el registro en base de datos se deshabilita.
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || 'aquaponic',
  },
  readings: {
    // Permite apagar el guardado sin quitar la conexión.
    persistEnabled: process.env.READINGS_PERSIST_ENABLED !== 'false',
  },
});
