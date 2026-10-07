import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import SensorGauge from '../components/SensorGauge';
import { useAquaponic } from '../context/useAquaponic';
import { SENSOR_META, SENSOR_ORDER, sensorPercent, getSensorRisk } from '../data/defaults';
import { apiConfig } from '../config/api';
import { Icon } from '../components/Icon';

// Mapea los campos del formulario a las claves de sensor del sistema.
const FIELD_TO_KEY = {
  ph: 'ph',
  nitratos: 'nitratos',
  oxigeno: 'oxigeno',
  temperatura: 'temperatura',
  nivel: 'nivelAgua',
  electroconductividad: 'electroconductividad',
  turbidez: 'turbiedad',
};

const QUICK_PRESETS = [
  {
    name: 'Condición Óptima',
    type: 'optimo',
    values: { ph: '6.9', oxigeno: '6.8', temperatura: '23.8', nivel: '28', nitratos: '25', electroconductividad: '1.45', turbidez: '8.5' },
  },
  {
    name: 'Acidosis Grave (pH 5.1)',
    type: 'acidosis',
    values: { ph: '5.1', oxigeno: '5.9', temperatura: '22.5', nivel: '26', nitratos: '35', electroconductividad: '1.6', turbidez: '14.0' },
  },
  {
    name: 'Alcalosis Severa (pH 8.6)',
    type: 'alcalosis',
    values: { ph: '8.6', oxigeno: '6.2', temperatura: '26.2', nivel: '28', nitratos: '20', electroconductividad: '1.35', turbidez: '11.0' },
  },
  {
    name: 'Hipoxia Crítica (OD 2.6)',
    type: 'hipoxia',
    values: { ph: '6.8', oxigeno: '2.6', temperatura: '27.2', nivel: '26', nitratos: '38', electroconductividad: '1.4', turbidez: '24.0' },
  },
  {
    name: 'Nivel Crítico (17 cm)',
    type: 'marcha_seco',
    values: { ph: '7.0', oxigeno: '6.2', temperatura: '23.0', nivel: '17', nitratos: '22', electroconductividad: '1.2', turbidez: '12.0' },
  },
  {
    name: 'Calor Extremo (32°C)',
    type: 'calor',
    values: { ph: '7.1', oxigeno: '4.4', temperatura: '32.2', nivel: '25', nitratos: '42', electroconductividad: '1.9', turbidez: '19.0' },
  },
];

const renderPresetIcon = (type) => {
  switch (type) {
    case 'optimo':
      return <Icon.CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />;
    case 'acidosis':
    case 'alcalosis':
      return <Icon.pH className="w-4 h-4 text-rose-600 shrink-0" />;
    case 'hipoxia':
      return <Icon.O2 className="w-4 h-4 text-rose-600 shrink-0" />;
    case 'marcha_seco':
      return <Icon.AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
    case 'calor':
      return <Icon.Flame className="w-4 h-4 text-amber-600 shrink-0" />;
    default:
      return <Icon.Activity className="w-4 h-4 text-ink shrink-0" />;
  }
};

export default function Parameters() {
  const ref = useRef(null);
  const { state, ws, mqtt, ingestMessage } = useAquaponic();
  const { sensors } = state;

  const [form, setForm] = useState({
    ph: '',
    nitratos: '',
    oxigeno: '',
    temperatura: '',
    nivel: '',
    electroconductividad: '',
    turbidez: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [alertSummary, setAlertSummary] = useState(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="param-gauge"]', {
        opacity: 0,
        scale: 0.85,
        duration: 0.7,
        ease: 'back.out(1.4)',
        stagger: 0.08,
      });
      gsap.from('[data-anim="form"]', {
        opacity: 0,
        x: 30,
        duration: 0.6,
        ease: 'power3.out',
        delay: 0.2,
      });
      gsap.from('[data-anim="row"]', {
        opacity: 0,
        x: 20,
        duration: 0.45,
        ease: 'power2.out',
        delay: 0.4,
        stagger: 0.08,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const handleChange = (k) => (e) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const applyPreset = (preset) => {
    setForm((prev) => ({ ...prev, ...preset.values }));
    showToast(`Preset "${preset.name}" cargado en el formulario`);
  };

  const loadLiveValues = () => {
    const live = {
      ph: sensors.ph?.value != null ? String(sensors.ph.value) : '6.9',
      oxigeno: sensors.oxigeno?.value != null ? String(sensors.oxigeno.value) : '6.8',
      temperatura: sensors.temperatura?.value != null ? String(sensors.temperatura.value) : '23.8',
      nivel: sensors.nivelAgua?.value != null ? String(sensors.nivelAgua.value) : '28',
      nitratos: sensors.nitratos?.value != null ? String(sensors.nitratos.value) : '25',
      electroconductividad: sensors.electroconductividad?.value != null ? String(sensors.electroconductividad.value) : '1.45',
      turbidez: sensors.turbiedad?.value != null ? String(sensors.turbiedad.value) : '8.5',
    };
    setForm(live);
    showToast('Lecturas en vivo cargadas en los campos del formulario');
  };

  const parseNum = (val) => {
    if (val === '' || val == null) return null;
    const clean = String(val).trim().replace(',', '.');
    const num = Number(clean);
    return Number.isFinite(num) ? num : null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Construye el bloque de sensores; si un campo está vacío, toma el valor actual del sensor para que siempre evalúe
      const sensorsPayload = {};
      let outOfRange = 0;
      const detectedIssues = [];

      Object.entries(FIELD_TO_KEY).forEach(([field, key]) => {
        let value = parseNum(form[field]);
        if (value === null && sensors[key]?.value != null) {
          value = Number(sensors[key].value);
        }
        // Fallback por defecto si no hay telemetría aún
        if (value === null) {
          const defaults = { ph: 6.9, oxigeno: 6.8, temperatura: 23.8, nivelAgua: 28, nitratos: 25, electroconductividad: 1.45, turbiedad: 8.5 };
          value = defaults[key] ?? 0;
        }

        sensorsPayload[key] = {
          value,
          unit: SENSOR_META[key].unit,
          percent: sensorPercent(key, value),
          status: 'ok',
        };

        // Detecta si el valor cae fuera del rango estable
        const risk = getSensorRisk(key, value);
        if (risk && risk.level !== 'stable') {
          outOfRange += 1;
          detectedIssues.push(`${SENSOR_META[key].label}: ${value} ${SENSOR_META[key].unit} (${risk.label})`);
        }
      });

      const payload = {
        sensors: sensorsPayload,
        source: 'dashboard-manual',
        timestamp: new Date().toISOString(),
      };

      // 1) Actualiza el estado local del frontend
      ingestMessage(payload, 'manual');

      // 2) Difunde por WebSocket y MQTT
      try {
        ws.send?.(payload);
        mqtt.publish?.('aquaponic/sensors/manual', payload);
      } catch {
        /* ignore */
      }

      // 3) Envía al backend para evaluar y disparar alertas a Telegram y Correo
      let backendAlertOk = false;
      try {
        const res = await fetch(`${apiConfig.api.baseUrl}/alerts/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const resData = await res.json();
          backendAlertOk = true;
          setAlertSummary({
            count: resData.outOfRange ?? outOfRange,
            issues: detectedIssues,
            humanActions: resData.humanActions || [],
            allOk: (resData.outOfRange ?? outOfRange) === 0,
          });
        }
      } catch (err) {
        console.warn('[alerts] Error notificando al backend:', err.message);
        setAlertSummary({
          count: outOfRange,
          issues: detectedIssues,
          humanActions: [],
          allOk: outOfRange === 0,
        });
      }

      // 4) Notifica al motor de decisiones TypeSafe AI para evaluación continua
      try {
        const currentPh = parseNum(form.ph) ?? sensors.ph?.value ?? 6.9;
        const currentOd = parseNum(form.oxigeno) ?? sensors.oxigeno?.value ?? 6.8;
        const currentTemp = parseNum(form.temperatura) ?? sensors.temperatura?.value ?? 23.5;
        const currentLevel = parseNum(form.nivel) ?? sensors.nivelAgua?.value ?? 28;
        const currentEc = parseNum(form.electroconductividad) ?? sensors.electroconductividad?.value ?? 1.4;
        const currentTurb = parseNum(form.turbidez) ?? sensors.turbiedad?.value ?? 8.0;

        void fetch(`${apiConfig.api.baseUrl}/decision/typesafe/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            params: {
              ph: currentPh,
              oxigenoDisuelto: currentOd,
              temperaturaAgua: currentTemp,
              nivelAgua: (currentLevel / 32) * 100, // porcentaje
              electroconductividad: currentEc,
              turbidez: currentTurb,
            },
            options: { executeIot: true },
          }),
        });
      } catch {
        /* ignore */
      }

      if (outOfRange > 0) {
        showToast(
          backendAlertOk
            ? `${outOfRange} parámetro(s) fuera de rango · Alerta despachada a Telegram y Correo`
            : `${outOfRange} parámetro(s) fuera de rango`
        );
      } else {
        showToast('Parámetros en rango óptimo actualizados en el sistema');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (message) => {
    setToast(message);
    requestAnimationFrame(() => {
      gsap.fromTo(
        '[data-anim="toast"]',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }
      );
    });
    setTimeout(() => {
      gsap.to('[data-anim="toast"]', {
        y: 20,
        opacity: 0,
        duration: 0.4,
        onComplete: () => setToast(null),
      });
    }, 3200);
  };

  const fields = [
    { k: 'ph', label: 'pH (ej: 6.8 o 5.1)' },
    { k: 'oxigeno', label: 'Oxígeno Disuelto mg/L (ej: 6.5 o 2.8)' },
    { k: 'temperatura', label: 'Temperatura °C (ej: 24.0 o 32.5)' },
    { k: 'nivel', label: 'Nivel de agua cm (ej: 28 o 16)' },
    { k: 'nitratos', label: 'Nitratos ppm (ej: 25 o 45)' },
    { k: 'electroconductividad', label: 'Electroconductividad mS/cm (ej: 1.45)' },
    { k: 'turbidez', label: 'Turbidez NTU (ej: 8.5 o 32.0)' },
  ];

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
      <div className="lg:col-span-3 space-y-6">
        <div>
          <h2 className="font-display font-bold text-2xl mb-1 text-ink">
            Lecturas en tiempo real
          </h2>
          <p className="text-xs text-ink/60">
            Monitoreo en vivo de los sensores fisicoquímicos del ecosistema.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 justify-items-center">
          {SENSOR_ORDER.map((key, i) => {
            const reading = sensors[key];
            return (
              <div data-anim="param-gauge" key={key}>
                <SensorGauge
                  sensorKey={key}
                  reading={reading}
                  label={SENSOR_META[key].label}
                  delay={0.1 + i * 0.05}
                  status={reading ? getSensorRisk(key, reading.value) : null}
                  inactive={!reading}
                />
              </div>
            );
          })}
        </div>

        {/* Resumen de alertas si se dispararon o confirmación de equilibrio */}
        {alertSummary?.allOk && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <Icon.CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Parámetros en Rango Óptimo: Sistema en Equilibrio</span>
            </div>
            <p className="text-emerald-900/80">
              Se evaluaron los parámetros fisicoquímicos. Todos los niveles se encuentran dentro de las tolerancias biológicas de confort para peces y plantas.
            </p>
          </div>
        )}

        {alertSummary && !alertSummary.allOk && alertSummary.count > 0 && (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-4">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <Icon.AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-sm">Desbalance Detectado: Notificaciones Enviadas</span>
            </div>
            <p className="text-rose-900/80">
              Se detectaron {alertSummary.count} anomalías. El sistema disparó alertas inmediatas por Telegram, Correo Electrónico y WebSocket:
            </p>
            <ul className="list-disc list-inside space-y-1 text-rose-950 font-medium">
              {alertSummary.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>

            {/* Protocolo de Acciones Humanas */}
            {alertSummary.humanActions && alertSummary.humanActions.length > 0 && (
              <div className="pt-3 border-t border-rose-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <Icon.Shield className="w-4 h-4 text-rose-700 shrink-0" />
                  <span className="text-xs uppercase tracking-wider">Acciones que debe realizar un humano (Protocolo de Remediación):</span>
                </div>
                <div className="space-y-3">
                  {alertSummary.humanActions.map((h, i) => (
                    <div key={i} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink text-xs">{h.parameter}</span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                          {h.condition}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-900 font-medium">{h.risk}</p>
                      <ol className="list-decimal list-inside space-y-1 text-ink/80 text-[11px] pt-1">
                        {h.actions.map((act, actIdx) => (
                          <li key={actIdx} className="leading-relaxed">{act}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        data-anim="form"
        onSubmit={submit}
        className="lg:col-span-2 bg-white rounded-2xl border border-black/10 shadow-sm p-6 self-start space-y-5"
      >
        <div>
          <h3 className="font-display font-bold text-xl text-ink">
            Ingresar Parámetros
          </h3>
          <p className="text-xs text-ink/50 mt-0.5">
            Ingresa lecturas para evaluar el sistema y disparar alertas en caso de desbalance.
          </p>
        </div>

        {/* Presets Rápidos */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50 block">
            Cargar Escenarios Rápidos:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_PRESETS.map((p) => (
              <button
                type="button"
                key={p.name}
                onClick={() => applyPreset(p)}
                className="text-left p-2 rounded-lg border border-black/10 hover:border-black/30 hover:bg-neutral-50 text-[11px] font-medium transition-all flex items-center gap-2"
              >
                {renderPresetIcon(p.type)}
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Campos del formulario */}
        <div className="space-y-2.5 pt-1">
          {fields.map((f) => (
            <div data-anim="row" key={f.k} className="space-y-1">
              <label className="text-[11px] font-semibold text-ink/70 block">
                {f.label}
              </label>
              <input
                type="text"
                className="input-field py-2 text-sm"
                placeholder={f.label}
                aria-label={f.label}
                value={form[f.k]}
                onChange={handleChange(f.k)}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadLiveValues}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
            >
              Cargar lecturas actuales
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ph: '',
                  nitratos: '',
                  oxigeno: '',
                  temperatura: '',
                  nivel: '',
                  electroconductividad: '',
                  turbidez: '',
                })
              }
              className="text-xs text-ink/40 hover:text-ink underline"
            >
              Limpiar
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-outline text-sm py-2.5 px-5 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold bg-ink text-white hover:bg-black transition-all"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Actualizando...</span>
              </>
            ) : (
              <span>Actualizar y Alertar</span>
            )}
          </button>
        </div>

        {toast && (
          <div
            data-anim="toast"
            className="mt-3 px-3 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium text-center shadow-md leading-relaxed"
          >
            {toast}
          </div>
        )}
      </form>
    </div>
  );
}
