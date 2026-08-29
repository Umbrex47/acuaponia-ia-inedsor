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
  demo: {
    // Escenario de simulación. Permite forzar condiciones de prueba sin
    // alterar el código. Cambiable en runtime vía POST /demo/scenario.
    scenario: (process.env.DEMO_SCENARIO ?? 'realistic') as
      | 'stable'
      | 'realistic'
      | 'unstable'
      | 'chaotic'
      | 'lowOxygen'
      | 'lowPh'
      | 'highTurbidity'
      | 'highEC'
      | 'dryTank',
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
    aerator: {
      // Identificador del actuador del aireador.
      actuatorId: process.env.AERATOR_ACTUATOR_ID || 'aireador',
      // Si el oxígeno disuelto cae por debajo de este valor, se enciende el aireador.
      oxygenOnBelow: parseFloat(process.env.AERATOR_OXYGEN_ON_BELOW ?? '5'),
      // Histéresis: se apaga cuando supera este valor.
      oxygenOffAbove: parseFloat(process.env.AERATOR_OXYGEN_OFF_ABOVE ?? '7'),
      // Si el pH cae por debajo de este valor también se enciende el aireador
      // (acidificación afecta la disponibilidad de oxígeno).
      phOnBelow: parseFloat(process.env.AERATOR_PH_ON_BELOW ?? '6.5'),
      // Tiempo mínimo entre cambios de estado.
      minStateMs: parseInt(process.env.AERATOR_MIN_STATE_MS ?? '60000', 10),
    },
    filter: {
      // Umbral de turbidez (NTU) que se considera señal de filtro sucio.
      turbidityThreshold: parseFloat(process.env.FILTER_TURBIDITY_THRESHOLD ?? '25'),
      // Lecturas consecutivas por encima del umbral para disparar alerta.
      consecutiveReadings: parseInt(process.env.FILTER_CONSECUTIVE_READINGS ?? '3', 10),
      // Intervalo en horas entre recordatorios preventivos de limpieza.
      periodicAlertHours: parseInt(process.env.FILTER_PERIODIC_ALERT_HOURS ?? '168', 10),
      // Cooldown entre alertas por turbidez (ms).
      cooldownMs: parseInt(process.env.FILTER_COOLDOWN_MS ?? '300000', 10),
    },
    earlyWarning: {
      // Reporte periódico de alertas activas y estado del control automático.
      enabled: process.env.EARLY_WARNING_ENABLED !== 'false',
      // Expresión cron. Por defecto cada 6 horas.
      cron: process.env.EARLY_WARNING_CRON || '0 */6 * * *',
      // Intervalo en horas (solo informativo, debe coincidir con el cron).
      reportIntervalHours: parseInt(process.env.EARLY_WARNING_INTERVAL_HOURS ?? '6', 10),
      // Mínima severidad para incluir en el reporte: 'low' incluye bajos y altos;
      // 'high' solo incluye valores por encima del rango óptimo.
      minSeverity: (process.env.EARLY_WARNING_MIN_SEVERITY ?? 'low') as 'low' | 'high',
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
    flow: {
      enabled: process.env.DECISION_FLOW_ENABLED !== 'false',
      escalationMs: parseInt(process.env.DECISION_FLOW_ESCALATION_MS ?? '60000', 10),
      normalizationStepMs: parseInt(
        process.env.DECISION_FLOW_NORMALIZATION_STEP_MS ?? '5000',
        10,
      ),
      normalizationMaxSteps: parseInt(
        process.env.DECISION_FLOW_NORMALIZATION_MAX_STEPS ?? '20',
        10,
      ),
      normalizationTolerancePct: parseInt(
        process.env.DECISION_FLOW_NORMALIZATION_TOLERANCE_PCT ?? '10',
        10,
      ),
      useGemini: process.env.DECISION_FLOW_USE_GEMINI !== 'false',
      rulesFallback: process.env.DECISION_FLOW_RULES_FALLBACK !== 'false',
      reportEmail: process.env.DECISION_FLOW_REPORT_EMAIL !== 'false',
      reportCooldownMs: parseInt(
        process.env.DECISION_FLOW_REPORT_COOLDOWN_MS ?? '300000',
        10,
      ),
      maxParallel: parseInt(process.env.DECISION_FLOW_MAX_PARALLEL ?? '3', 10),
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
  actuators: {
    // Tiempo mínimo (ms) entre cambios para un mismo actuador (anti-ciclado).
    // Por defecto 60 s, igual que la bomba.
    minStateMs: parseInt(process.env.ACTUATORS_MIN_STATE_MS ?? '60000', 10),
    // TTL del lock de edición multi-usuario (ms).
    lockTtlMs: parseInt(process.env.ACTUATORS_LOCK_TTL_MS ?? '10000', 10),
    // Máximo de propuestas pendientes en la cola antes de descartar (FIFO).
    maxProposals: parseInt(process.env.ACTUATORS_MAX_PROPOSALS ?? '10', 10),
    // Caducidad en ms de la propuesta si nadie la aprueba/rechaza.
    proposalMaxAgeMs: parseInt(
      process.env.ACTUATORS_PROPOSAL_MAX_AGE_MS ?? '600000',
      10,
    ),
    // El modo "manual" existe para impedir que la IA/automatismos actúen,
    // no para bloquear al operador. Con esto el actor `user` (botones de la
    // web) puede accionar aunque el actuador esté en manual.
    // Por defecto activo fuera de producción; en prod se exige opt-in.
    allowManualUserOverride:
      (process.env.ACTUATORS_ALLOW_MANUAL_USER_OVERRIDE ??
        (process.env.NODE_ENV === 'production' ? 'false' : 'true')) !== 'false',
  },
  emergency: {
    enabled: process.env.EMERGENCY_ENABLED !== 'false',
    cooldownMs: parseInt(process.env.EMERGENCY_COOLDOWN_MS ?? '60000', 10),
  },
  feeder: {
    enabled: process.env.FEEDER_ENABLED !== 'false',
    // CSV de horarios (HH:mm). Default: 08:00, 12:00, 17:00.
    times: process.env.FEEDER_TIMES || '08:00,12:00,17:00',
    durationMs: parseInt(process.env.FEEDER_DURATION_MS ?? '20000', 10),
    portionG: parseInt(process.env.FEEDER_PORTION_G ?? '15', 10),
  },
  ollama: {
    // Mantenido por compatibilidad: lee los mismos env vars pero el servicio
    // activo ahora es Gemini (ver clave `gemini` más abajo).
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b-q4_0',
  },
  gemini: {
    // API key de Google AI Studio. Vacía = el asistente se deshabilita.
    // Debe ir SIN comillas en el .env: las comillas se envían literalmente
    // en la query string y Google responde 400 API_KEY_INVALID.
    apiKey: (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, ''),
    // Modelo por defecto: Gemini 2.5 Flash.
    // Si tu cuenta devuelve 404 con este modelo, usa GEMINI_MODEL para forzar
    // otro nombre o revisa la facturación/cuota en Google AI Studio.
    model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    baseUrl:
      process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
    // 2048 deja margen para texto + tool-calls sin agotar el cupo de salida.
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? '2048', 10),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE ?? '0.2'),
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS ?? '60000', 10),
  },
  notifications: {
    // Canales activos (CSV). Vacío = solo WebSocket interno.
    // Valores válidos: email, telegram, websocket.
    channels: (process.env.NOTIFICATIONS_CHANNELS || 'websocket')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
    // Tiempo mínimo (ms) entre notificaciones idénticas (anti-spam).
    cooldownMs: parseInt(process.env.NOTIFICATIONS_COOLDOWN_MS ?? '60000', 10),
    // Tamaño máximo de la cola en memoria (clientes WS lentos).
    maxQueue: parseInt(process.env.NOTIFICATIONS_MAX_QUEUE ?? '50', 10),
  },
  assistant: {
    enabled: process.env.ASSISTANT_ENABLED !== 'false',
    systemPrompt: process.env.ASSISTANT_SYSTEM_PROMPT || '',
    // TTL de sesiones de chat inactivas (ms).
    sessionTtlMs: parseInt(process.env.ASSISTANT_SESSION_TTL_MS ?? '1800000', 10),
  },
  security: {
    // API key para endpoints de escritura. Vacío = deshabilitado (no se valida).
    apiKey: process.env.ASSISTANT_API_KEY || '',
    // Requerir siempre la API key (incluso en dev). false = solo en prod.
    requireApiKey: process.env.REQUIRE_API_KEY === 'true',
  },
  throttle: {
    chatPerMinute: parseInt(process.env.THROTTLE_CHAT ?? '60', 10),
    actuatorPerMinute: parseInt(process.env.THROTTLE_ACTUATOR ?? '30', 10),
  },
});
