export default () => ({
  port: parseInt(process.env.PORT ?? '8080', 10),
  mqtt: {
    url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID ?? 'aquaponic-backend',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectMs: parseInt(process.env.MQTT_RECONNECT_MS ?? '3000', 10),
    topicPrefix: process.env.MQTT_TOPIC_PREFIX ?? 'aquaponic',
    // Activo por defecto salvo MQTT_DEMO_ENABLED=false explícito.
    demoEnabled: process.env.MQTT_DEMO_ENABLED !== 'false',
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
  decision: {
    // Motor de decisiones (reglas + reportes). Apágalo con DECISION_ENABLED=false.
    enabled: process.env.DECISION_ENABLED !== 'false',
    pump: {
      // Identificador del actuador; se publica en <prefix>/commands/<id>.
      actuatorId: process.env.PUMP_ACTUATOR_ID || 'bomba_agua',
      // Histéresis por nivel de agua (cm). Por debajo de offLevel se apaga la
      // bomba (protección anti-marcha en seco); al alcanzar onLevel se enciende.
      onLevel: parseFloat(process.env.PUMP_ON_LEVEL ?? '24'),
      offLevel: parseFloat(process.env.PUMP_OFF_LEVEL ?? '20'),
      // Tiempo mínimo (ms) que se mantiene un estado antes de poder cambiarlo,
      // evita el ciclado rápido (encendido/apagado en bucle).
      minStateMs: parseInt(process.env.PUMP_MIN_STATE_MS ?? '60000', 10),
    },
    report: {
      // Reporte de progreso por correo + Telegram.
      enabled: process.env.REPORT_ENABLED !== 'false',
      // Expresión cron (zona del servidor). Por defecto: 08:00 cada día.
      cron: process.env.REPORT_CRON || '0 8 * * *',
      // Ventana de análisis en horas para el reporte.
      windowHours: parseInt(process.env.REPORT_WINDOW_HOURS ?? '24', 10),
    },
    fishAssessment: {
      // Evaluación conductual de peces → correo (sin actuadores).
      enabled: process.env.FISH_ASSESSMENT_ENABLED !== 'false',
      // Probabilidad mínima (%) de una hipótesis para enviar correo.
      mailThreshold: parseInt(
        process.env.FISH_ASSESS_MAIL_THRESHOLD ?? '50',
        10,
      ),
      // Anti-spam entre correos de peces.
      cooldownMs: parseInt(
        process.env.FISH_ASSESS_MAIL_COOLDOWN_MS ?? '300000',
        10,
      ),
    },
    plantAssessment: {
      enabled: process.env.PLANT_ASSESSMENT_ENABLED !== 'false',
      mailThreshold: parseInt(
        process.env.PLANT_ASSESS_MAIL_THRESHOLD ?? '50',
        10,
      ),
      cooldownMs: parseInt(
        process.env.PLANT_ASSESS_MAIL_COOLDOWN_MS ?? '300000',
        10,
      ),
    },
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
