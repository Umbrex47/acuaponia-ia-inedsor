// Metadatos de cada sensor (etiqueta, unidad, color, rango y orden).
// NO contiene valores: el estado se llena únicamente con lo que llega por MQTT.
// `min`/`max` definen la escala del medidor (para calcular el % del gauge).
// `optimal` define el rango saludable: por debajo es "bajo", por encima es
// "riesgoso" y dentro es "estable".
export const SENSOR_META = {
  temperatura: { label: 'Temperatura', unit: '°C', color: '#0A0A0A', min: 15, max: 35, optimal: { min: 20, max: 28 } },
  ph: { label: 'pH', unit: '', color: '#0A0A0A', min: 0, max: 14, optimal: { min: 6.5, max: 8 } },
  oxigeno: { label: 'Oxígeno D', unit: 'mg/L', color: '#2563EB', min: 0, max: 15, optimal: { min: 5, max: 12 } },
  nivelAgua: { label: 'Nvl de agua', unit: 'cm', color: '#0A0A0A', min: 0, max: 32, optimal: { min: 24, max: 32 } },
  nitratos: { label: 'Nitratos', unit: 'ppm', color: '#0A0A0A', min: 0, max: 50, optimal: { min: 5, max: 40 } },
  co2: { label: 'CO₂', unit: 'ppm', color: '#0A0A0A', min: 0, max: 1000, optimal: { min: 50, max: 600 } },
  electroconductividad: { label: 'Electrocond.', unit: 'mS/cm', color: '#16A34A', min: 0, max: 3, optimal: { min: 0.8, max: 2 } },
  turbiedad: { label: 'Turbidez', unit: 'NTU', color: '#0A0A0A', min: 0, max: 100, optimal: { min: 0, max: 25 } },
  temperaturaAmbiente: { label: 'Temp. ambiente', unit: '°C', color: '#0A0A0A', min: 5, max: 45, optimal: { min: 18, max: 32 } },
  humedad: { label: 'Humedad', unit: '%', color: '#2563EB', min: 0, max: 100, optimal: { min: 40, max: 75 } },
  presion: { label: 'Presión', unit: 'hPa', color: '#0A0A0A', min: 900, max: 1100, optimal: { min: 950, max: 1050 } },
};

// Niveles de riesgo y su presentación (texto + color de la barra de progreso).
export const RISK_LEVELS = {
  low: { label: 'Bajo', color: '#2563EB' },
  stable: { label: 'Estable', color: '#16A34A' },
  high: { label: 'Riesgoso', color: '#DC2626' },
};

// Evalúa qué tan riesgoso es el valor de un sensor según su rango óptimo.
// Devuelve { level, label, color } listo para usar en el medidor.
export function getSensorRisk(key, value) {
  const meta = SENSOR_META[key];
  if (!meta || !meta.optimal || !Number.isFinite(value)) return null;
  if (value < meta.optimal.min) return { level: 'low', ...RISK_LEVELS.low };
  if (value > meta.optimal.max) return { level: 'high', ...RISK_LEVELS.high };
  return { level: 'stable', ...RISK_LEVELS.stable };
}

// Calcula el porcentaje (0–100) de un valor según la escala del sensor.
export function sensorPercent(key, value) {
  const meta = SENSOR_META[key];
  if (!meta || !Number.isFinite(value)) return 0;
  const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Orden en el que se muestran los sensores cuando están activos.
export const SENSOR_ORDER = Object.keys(SENSOR_META);

// Sensores esenciales que se muestran de entrada en el dashboard.
// El resto queda detrás del botón "Ver más".
export const ESSENTIAL_SENSORS = [
  'ph',
  'electroconductividad',
  'nivelAgua',
  'turbiedad',
  'oxigeno',
  'temperatura',
];

export const DEFAULT_STATE = {
  // Vacío a propósito: solo se agregan los sensores que el sistema reporta.
  sensors: {},
  system: {
    status: null,
    statusLabel: 'Esperando datos',
    lastUpdate: null,
  },
  fish: {
    mood: 'Calmados',
    species: 'Tilapia',
    nextFeeding: '10 / 06 / 2026',
    growth30: '0.3 cm',
    growth90: '0.6 cm',
    cameraUrl: '',
    cameraStatus: 'ok',
    count: null,
    detections: null,
    confidenceAvg: null,
    behavior: null,
    assessment: null,
  },
  plants: {
    status: 'Saludables',
    species: 'Mangle rojo',
    growthPercent: 10,
    bed: 'Cama 1 · Sustrato hidropónico',
    cameraUrl: '',
    cameraStatus: 'ok',
  },
  // La lista de dispositivos se deriva de los sensores activos.
  devices: [],
  connection: {
    websocket: { connected: false, error: null, lastMessageAt: null },
    mqtt: { connected: false, error: null, lastMessageAt: null },
  },
};

export const SYSTEM_STATUS_MAP = {
  stable: { label: 'Estable', color: 'text-accent-green' },
  warning: { label: 'Atención', color: 'text-accent-amber' },
  critical: { label: 'Crítico', color: 'text-accent-red' },
};
