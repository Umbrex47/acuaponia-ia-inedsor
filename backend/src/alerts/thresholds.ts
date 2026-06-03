/**
 * Umbrales de cada sensor (espejo de frontend/src/data/defaults.js).
 * `optimal` define el rango saludable; fuera de él se considera "bajo" o
 * "riesgoso". Las alertas por correo se disparan al cruzar este rango.
 */
export type RiskLevel = 'low' | 'stable' | 'high';

export interface SensorThreshold {
  label: string;
  unit: string;
  optimal: { min: number; max: number };
  aliases: string[];
}

export const SENSOR_THRESHOLDS: Record<string, SensorThreshold> = {
  temperatura: {
    label: 'Temperatura',
    unit: '°C',
    optimal: { min: 20, max: 28 },
    aliases: ['temperatura', 'temperature', 'temp'],
  },
  ph: {
    label: 'pH',
    unit: '',
    optimal: { min: 6.5, max: 8 },
    aliases: ['ph', 'pH'],
  },
  oxigeno: {
    label: 'Oxígeno disuelto',
    unit: 'mg/L',
    optimal: { min: 5, max: 12 },
    aliases: ['oxigeno', 'oxygen', 'do', 'oxigenoDisuelto'],
  },
  nivelAgua: {
    label: 'Nivel de agua',
    unit: 'cm',
    optimal: { min: 24, max: 32 },
    aliases: ['nivelAgua', 'nivel', 'waterLevel', 'nivel_agua'],
  },
  nitratos: {
    label: 'Nitratos',
    unit: 'ppm',
    optimal: { min: 5, max: 40 },
    aliases: ['nitratos', 'nitrates', 'no3'],
  },
  co2: {
    label: 'CO₂',
    unit: 'ppm',
    optimal: { min: 50, max: 600 },
    aliases: ['co2', 'CO2'],
  },
  electroconductividad: {
    label: 'Electroconductividad',
    unit: 'mS/cm',
    optimal: { min: 0.8, max: 2 },
    aliases: [
      'electroconductividad',
      'electrocontinuidad',
      'ec',
      'EC',
      'conductividad',
    ],
  },
  turbiedad: {
    label: 'Turbidez',
    unit: 'NTU',
    optimal: { min: 0, max: 25 },
    aliases: ['turbiedad', 'turbidez', 'turbidity', 'ntu'],
  },
  temperaturaAmbiente: {
    label: 'Temperatura ambiente',
    unit: '°C',
    optimal: { min: 18, max: 32 },
    aliases: ['temperaturaAmbiente', 'tempAmbiente', 'ambientTemp', 'airTemperature'],
  },
  humedad: {
    label: 'Humedad relativa',
    unit: '%',
    optimal: { min: 40, max: 75 },
    aliases: ['humedad', 'humidity', 'hr', 'relativeHumidity'],
  },
  presion: {
    label: 'Presión barométrica',
    unit: 'hPa',
    optimal: { min: 950, max: 1050 },
    aliases: ['presion', 'pressure', 'barometricPressure'],
  },
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  stable: 'Estable',
  high: 'Riesgoso',
};

/** Clasifica un valor según el rango óptimo de su sensor. */
export function evaluateRisk(key: string, value: number): RiskLevel | null {
  const meta = SENSOR_THRESHOLDS[key];
  if (!meta || !Number.isFinite(value)) return null;
  if (value < meta.optimal.min) return 'low';
  if (value > meta.optimal.max) return 'high';
  return 'stable';
}

export interface SensorReading {
  key: string;
  value: number;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Extrae lecturas numéricas de un payload MQTT ya parseado.
 * Acepta { sensors: {...} } o los sensores en la raíz, y cada sensor puede
 * ser un escalar (27.4) o un objeto ({ value: 27.4, ... }).
 */
export function extractReadings(data: unknown): SensorReading[] {
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const source =
    record.sensors && typeof record.sensors === 'object'
      ? (record.sensors as Record<string, unknown>)
      : record;

  const readings: SensorReading[] = [];

  for (const [key, meta] of Object.entries(SENSOR_THRESHOLDS)) {
    let raw: unknown;
    for (const alias of meta.aliases) {
      if (source[alias] != null && source[alias] !== '') {
        raw = source[alias];
        break;
      }
    }
    if (raw == null) continue;

    const value =
      typeof raw === 'object'
        ? toNumber((raw as Record<string, unknown>).value)
        : toNumber(raw);

    if (Number.isFinite(value)) {
      readings.push({ key, value });
    }
  }

  return readings;
}
