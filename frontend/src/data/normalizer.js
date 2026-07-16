import { SENSOR_META, SENSOR_ORDER } from './defaults';

// Alias aceptados por cada sensor (ESP32, backend, entrada manual…).
const SENSOR_ALIASES = {
  temperatura: ['temperatura', 'temperature', 'temp'],
  ph: ['ph', 'pH'],
  oxigeno: ['oxigeno', 'oxygen', 'do', 'oxigenoDisuelto'],
  nivelAgua: ['nivelAgua', 'nivel', 'waterLevel', 'nivel_agua'],
  nitratos: ['nitratos', 'nitrates', 'no3'],
  co2: ['co2', 'CO2'],
  electroconductividad: [
    'electroconductividad',
    'electrocontinuidad',
    'ec',
    'EC',
    'conductividad',
  ],
  turbiedad: ['turbiedad', 'turbidez', 'turbidity', 'ntu'],
  temperaturaAmbiente: ['temperaturaAmbiente', 'tempAmbiente', 'ambientTemp', 'airTemperature'],
  humedad: ['humedad', 'humidity', 'hr', 'relativeHumidity'],
  presion: ['presion', 'pressure', 'barometricPressure'],
};

function toNumber(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

/**
 * Construye un sensor SOLO si llega un valor real. Acepta dos formatos:
 *  - Objeto:  { value, percent, unit, status }
 *  - Escalar: 27.4  (+ opcional `${key}Percent` o `percent` a nivel raíz)
 * Devuelve `undefined` si el sensor no viene en el payload.
 */
function buildSensor(source, key) {
  const raw = pick(source, SENSOR_ALIASES[key]);
  if (raw == null) return undefined;

  const meta = SENSOR_META[key] ?? {};

  if (typeof raw === 'object') {
    const value = toNumber(raw.value);
    if (!Number.isFinite(value)) return undefined;
    return {
      value,
      percent: clampPercent(raw.percent),
      unit: raw.unit ?? meta.unit ?? '',
      status: raw.status ?? 'ok',
    };
  }

  const value = toNumber(raw);
  if (!Number.isFinite(value)) return undefined;

  const percent = pick(source, [`${SENSOR_ALIASES[key][0]}Percent`, 'percent']);
  return {
    value,
    percent: clampPercent(percent),
    unit: meta.unit ?? '',
    status: source.status ?? 'ok',
  };
}

/**
 * Normaliza payloads JSON (WebSocket o MQTT) y devuelve un parche que
 * contiene ÚNICAMENTE los datos realmente presentes en el mensaje.
 */
export function normalizePayload(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;

  const patch = {};

  // ── Sensores: solo los que vengan en el mensaje ──
  const sensorsSource = data.sensors ?? data;
  const sensorsPatch = {};
  for (const key of SENSOR_ORDER) {
    const sensor = buildSensor(sensorsSource, key);
    if (sensor) sensorsPatch[key] = sensor;
  }
  if (Object.keys(sensorsPatch).length > 0) {
    patch.sensors = sensorsPatch;
  }

  // ── Peces ──
  const fish = data.fish ?? data.peces;
  if (fish && typeof fish === 'object') {
    const fishPatch = {};
    const mood = pick(fish, ['mood', 'estadoAnimo']);
    if (mood != null) fishPatch.mood = mood;
    const species = pick(fish, ['species', 'especie', 'tipo']);
    if (species != null) fishPatch.species = species;
    const nextFeeding = pick(fish, ['nextFeeding', 'proximaComida']);
    if (nextFeeding != null) fishPatch.nextFeeding = nextFeeding;
    const growth30 = pick(fish, ['growth30', 'crecimiento30']);
    if (growth30 != null) fishPatch.growth30 = growth30;
    const growth90 = pick(fish, ['growth90', 'crecimiento90']);
    if (growth90 != null) fishPatch.growth90 = growth90;
    const cameraUrl = pick(fish, ['cameraUrl', 'streamUrl', 'cam1']);
    if (cameraUrl != null) fishPatch.cameraUrl = cameraUrl;
    if (fish.cameraStatus != null) fishPatch.cameraStatus = fish.cameraStatus;
    if (fish.count != null) fishPatch.count = fish.count;
    if (fish.detections != null) fishPatch.detections = fish.detections;
    if (fish.confidenceAvg != null) fishPatch.confidenceAvg = fish.confidenceAvg;
    if (fish.behavior != null && typeof fish.behavior === 'object') {
      fishPatch.behavior = fish.behavior;
    }
    if (fish.assessment != null && typeof fish.assessment === 'object') {
      fishPatch.assessment = fish.assessment;
    }
    if (Object.keys(fishPatch).length > 0) patch.fish = fishPatch;
  }

  // ── Plantas ──
  const plants = data.plants ?? data.plantas;
  if (plants && typeof plants === 'object') {
    const plantsPatch = {};
    const status = pick(plants, ['status', 'estado']);
    if (status != null) plantsPatch.status = status;
    const species = pick(plants, ['species', 'especie']);
    if (species != null) plantsPatch.species = species;
    const growth = plants.growthPercent ?? plants.crecimiento;
    if (growth != null) plantsPatch.growthPercent = clampPercent(growth);
    const bed = pick(plants, ['bed', 'cama']);
    if (bed != null) plantsPatch.bed = bed;
    const cameraUrl = pick(plants, ['cameraUrl', 'streamUrl', 'cam2']);
    if (cameraUrl != null) plantsPatch.cameraUrl = cameraUrl;
    if (plants.cameraStatus != null) plantsPatch.cameraStatus = plants.cameraStatus;
    if (plants.count != null) plantsPatch.count = plants.count;
    if (plants.healthMethod != null) plantsPatch.healthMethod = plants.healthMethod;
    if (plants.avgHealthScore != null) plantsPatch.avgHealthScore = plants.avgHealthScore;
    if (Array.isArray(plants.findings)) plantsPatch.findings = plants.findings;
    if (plants.assessment != null && typeof plants.assessment === 'object') {
      plantsPatch.assessment = plants.assessment;
    }
    if (Object.keys(plantsPatch).length > 0) patch.plants = plantsPatch;
  }

  // ── Dispositivos (lista explícita, si llega) ──
  const devices = data.devices ?? data.dispositivos;
  if (Array.isArray(devices)) {
    patch.devices = devices.map((d) => ({
      id: d.id ?? d.name,
      name: d.name ?? d.id,
      status: d.status ?? 'ok',
    }));
  }

  // ── Estado del sistema ──
  const system = data.system ?? data.sistema;
  if (system && typeof system === 'object') {
    const status = pick(system, ['status', 'estado']);
    patch.system = {
      ...(status != null && { status }),
      ...(system.statusLabel != null && { statusLabel: system.statusLabel }),
    };
  }

  if (Object.keys(patch).length === 0) return null;

  // Marca de tiempo de la última recepción real.
  patch.system = { ...(patch.system ?? {}), lastUpdate: new Date().toISOString() };

  return patch;
}

export function mergeState(prev, patch) {
  if (!patch) return prev;

  return {
    ...prev,
    sensors: patch.sensors ? { ...prev.sensors, ...patch.sensors } : prev.sensors,
    fish: patch.fish ? { ...prev.fish, ...patch.fish } : prev.fish,
    plants: patch.plants ? { ...prev.plants, ...patch.plants } : prev.plants,
    devices: patch.devices ?? prev.devices,
    system: patch.system ? { ...prev.system, ...patch.system } : prev.system,
  };
}

export function formatSensorReading(sensor) {
  if (!sensor || !Number.isFinite(sensor.value)) return '—';
  const { value, unit } = sensor;
  if (unit === '°C') return `${value.toFixed(1)}°C`;
  if (unit === 'L') return `${Math.round(value)}L`;
  if (unit === 'cm') return `${value.toFixed(1)} cm`;
  if (unit === 'mg/L') return `${value} mg/L`;
  if (unit === 'ppm') return `${value} ppm`;
  if (unit === 'mS/cm') return `${value.toFixed(2)} mS/cm`;
  if (unit === 'NTU') return `${value.toFixed(1)} NTU`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'hPa') return `${value.toFixed(1)} hPa`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
