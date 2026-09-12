/**
 * Simulador de telemetría para Aquaponic OS.
 *
 * Publica lecturas por MQTT que cambian "poco a poco": en lugar de valores
 * aleatorios bruscos, usa un random walk con reversión a la media (modelo tipo
 * Ornstein–Uhlenbeck). Cada tick desplaza cada sensor un paso pequeño y lo
 * empuja suavemente hacia el centro de su rango óptimo, de modo que las curvas
 * se ven realistas y estables.
 *
 * Alimenta todo el pipeline igual que el ESP32: persistencia en MongoDB,
 * alertas (correo/Telegram), motor de decisiones (bomba) y dashboard.
 *
 * Uso (desde la carpeta backend):
 *   node scripts/simulate-sensors.mjs                 # intervalo 5s
 *   node scripts/simulate-sensors.mjs --interval 2000 # cada 2s
 *   node scripts/simulate-sensors.mjs --speed 3       # cambios 3x más rápidos
 *   node scripts/simulate-sensors.mjs --only ph,temperatura,nivelAgua
 *   node scripts/simulate-sensors.mjs --drift         # deja que se salga de rango
 *   node scripts/simulate-sensors.mjs --scenario temperatura:critical
 *                                          # fija un sensor a un status concreto
 *                                          # (los demás siguen su random-walk)
 *   node scripts/simulate-sensors.mjs --scenario nivelAgua:critical,temperatura:warn
 *
 * Lee la config del broker desde backend/.env (MQTT_URL, MQTT_TOPIC_PREFIX…).
 */
import 'dotenv/config';
import mqtt from 'mqtt';

// ── Definición de sensores ──────────────────────────────────────────────
// min/max = escala del medidor · optimal = rango saludable
// step    = magnitud del paso por tick (qué tan "sutil" es el cambio)
// decimals= cómo se redondea el valor publicado
const SENSORS = {
  temperatura: { unit: '°C', min: 15, max: 35, optimal: [20, 28], step: 0.15, decimals: 1 },
  ph: { unit: '', min: 0, max: 14, optimal: [6.5, 8], step: 0.04, decimals: 2 },
  oxigeno: { unit: 'mg/L', min: 0, max: 15, optimal: [5, 12], step: 0.12, decimals: 1 },
  nivelAgua: { unit: 'cm', min: 0, max: 32, optimal: [24, 32], step: 0.3, decimals: 1 },
  nitratos: { unit: 'ppm', min: 0, max: 50, optimal: [5, 40], step: 0.4, decimals: 0 },
  co2: { unit: 'ppm', min: 0, max: 1000, optimal: [50, 600], step: 6, decimals: 0 },
  electroconductividad: { unit: 'mS/cm', min: 0, max: 3, optimal: [0.8, 2], step: 0.02, decimals: 2 },
  turbiedad: { unit: 'NTU', min: 0, max: 100, optimal: [0, 25], step: 0.8, decimals: 1 },
  temperaturaAmbiente: { unit: '°C', min: 5, max: 45, optimal: [18, 32], step: 0.2, decimals: 1 },
  humedad: { unit: '%', min: 0, max: 100, optimal: [40, 75], step: 0.6, decimals: 0 },
  presion: { unit: 'hPa', min: 900, max: 1100, optimal: [950, 1050], step: 0.5, decimals: 0 },
};

// ── Parseo de argumentos ────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { interval: 5000, speed: 1, drift: false, only: null, scenario: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--drift') args.drift = true;
    else if (arg === '--interval') args.interval = parseInt(argv[++i], 10) || args.interval;
    else if (arg === '--speed') args.speed = parseFloat(argv[++i]) || args.speed;
    else if (arg === '--only') {
      args.only = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--scenario') {
      const raw = String(argv[++i] || '');
      const valid = ['ok', 'warn', 'critical'];
      for (const pair of raw.split(',')) {
        const [k, v] = pair.split(':').map((s) => s && s.trim());
        if (!k || !v || !valid.includes(v)) {
          console.warn(`[sim] --scenario ignora entrada inválida: "${pair}" (esperado key:status)`);
          continue;
        }
        args.scenario[k] = v;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, d) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

// Selección de sensores a simular.
const keys = args.only
  ? args.only.filter((k) => {
      if (!SENSORS[k]) console.warn(`[sim] sensor desconocido, se omite: ${k}`);
      return Boolean(SENSORS[k]);
    })
  : Object.keys(SENSORS);

if (keys.length === 0) {
  console.error('[sim] no hay sensores válidos que simular');
  process.exit(1);
}

// Estado inicial: centro del rango óptimo de cada sensor.
const state = {};
for (const key of keys) {
  const [lo, hi] = SENSORS[key].optimal;
  state[key] = (lo + hi) / 2;
}

// ── Avance del random walk con reversión a la media ─────────────────────
function nextValue(key) {
  const def = SENSORS[key];
  const [lo, hi] = def.optimal;
  const center = (lo + hi) / 2;
  const halfRange = (hi - lo) / 2 || 1;

  // Paso aleatorio escalado por --speed.
  const wander = (Math.random() * 2 - 1) * def.step * args.speed;
  // Empuje suave hacia el centro (cuanto más lejos, más fuerte).
  const pull = ((center - state[key]) / halfRange) * def.step * 0.5;

  let value = state[key] + wander + pull;

  // Límite del recorrido: dentro del óptimo (con un pequeño margen) salvo --drift.
  if (args.drift) {
    value = clamp(value, def.min, def.max);
  } else {
    const margin = halfRange * 0.15;
    value = clamp(value, lo - margin, hi + margin);
    value = clamp(value, def.min, def.max);
  }

  state[key] = value;
  return round(value, def.decimals);
}

// ── Status según umbrales (mismo criterio que el firmware) ───────────────
// Optimal = "ok". Un 20 % más allá del optimal por lado = "warn".
// Más allá del 20 % = "critical". Así los tres rangos quedan bien separados.
function statusFromValue(key, value) {
  const [lo, hi] = SENSORS[key].optimal;
  const span = hi - lo;
  const warnMargin = span * 0.2;
  if (value >= lo && value <= hi) return 'ok';
  if (value >= lo - warnMargin && value <= hi + warnMargin) return 'warn';
  return 'critical';
}

// ── Valor forzado según status (para --scenario) ─────────────────────────
// Para "warn" elegimos el lado más lejano del centro: si hi > lo, +5 %
// sobre hi; si lo < hi, −5 % sobre lo. Así garantizamos salir del optimal
// sin importar que optimal coincida con los extremos del sensor.
function valueForStatus(key, status) {
  const def = SENSORS[key];
  const [lo, hi] = def.optimal;
  const center = (lo + hi) / 2;
  const span = hi - lo;
  const step = Math.max(span * 0.05, (def.max - def.min) * 0.02);
  switch (status) {
    case 'ok':       return clamp(center, def.min, def.max);
    case 'warn': {
      // Elige el lado más amplio (en el span del sensor) para garantizar salida.
      const headroomHi = def.max - hi;
      const headroomLo = lo - def.min;
      if (headroomHi >= headroomLo) return clamp(hi + step, def.min, def.max);
      return clamp(lo - step, def.min, def.max);
    }
    case 'critical': {
      // Pega al extremo absoluto del sensor en el lado con más headroom.
      const headroomHi = def.max - hi;
      const headroomLo = lo - def.min;
      if (headroomHi >= headroomLo) return def.max - (def.max - def.min) * 0.02;
      return def.min + (def.max - def.min) * 0.02;
    }
    default: return center;
  }
}

function buildPayload() {
  const sensors = {};
  for (const key of keys) {
    const def = SENSORS[key];
    const forcedStatus = args.scenario[key] || null;

    let value, status;
    if (forcedStatus) {
      status = forcedStatus;
      value = valueForStatus(key, forcedStatus);
      state[key] = value;  // sincroniza el walk para que al soltar el override no salte
    } else {
      value = nextValue(key);
      status = statusFromValue(key, value);
    }

    const percent = clamp(
      Math.round(((value - def.min) / (def.max - def.min)) * 100),
      0,
      100,
    );
    sensors[key] = { value: round(value, def.decimals), unit: def.unit, percent, status };
  }
  return {
    sensors,
    source: 'simulator',
    timestamp: new Date().toISOString(),
  };
}

// ── Conexión MQTT ───────────────────────────────────────────────────────
const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
const prefix = (process.env.MQTT_TOPIC_PREFIX || 'aquaponic').replace(/\/+$/, '');
const topic = `${prefix}/sensors/telemetry`;

const options = {
  clientId: `aquaponic-simulator-${Date.now()}`,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  reconnectPeriod: 3000,
  connectTimeout: 10_000,
};

console.log(`[sim] conectando a ${url}…`);
const client = mqtt.connect(url, options);

let timer = null;

client.on('connect', () => {
  console.log(`[sim] conectado. Publicando en "${topic}" cada ${args.interval} ms`);
  console.log(`[sim] sensores: ${keys.join(', ')}`);
  console.log(`[sim] modo: ${args.drift ? 'drift (puede salirse de rango)' : 'estable'} · speed=${args.speed}`);
  const scenarioKeys = Object.keys(args.scenario);
  if (scenarioKeys.length) {
    console.log(`[sim] escenarios forzados:`);
    for (const k of scenarioKeys) console.log(`       - ${k} → ${args.scenario[k]}`);
  }
  console.log('[sim] Ctrl+C para detener.\n');

  const tick = () => {
    const payload = buildPayload();
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error(`[sim] error al publicar: ${err.message}`);
        return;
      }
      const resumen = keys
        .map((k) => `${k}=${payload.sensors[k].value}${SENSORS[k].unit}`)
        .join('  ');
      console.log(`[sim] ${new Date().toLocaleTimeString()}  ${resumen}`);
    });
  };

  tick();
  timer = setInterval(tick, args.interval);
});

client.on('error', (err) => {
  console.error(`[sim] MQTT error: ${err.message}`);
});

function shutdown() {
  console.log('\n[sim] deteniendo…');
  if (timer) clearInterval(timer);
  client.end(true, () => process.exit(0));
  // Salida forzada si el broker no responde.
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
