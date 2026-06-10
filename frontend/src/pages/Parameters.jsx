import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CircleGauge from '../components/CircleGauge';
import PhScaleBar from '../components/PhScaleBar';
import WaterTankGauge from '../components/WaterTankGauge';
import ThermometerGauge from '../components/ThermometerGauge';
import { useAquaponic } from '../context/useAquaponic';
import { formatSensorReading } from '../data/normalizer';
import { SENSOR_META, SENSOR_ORDER, sensorPercent, getSensorRisk } from '../data/defaults';
import { apiConfig } from '../config/api';

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
  const [toast, setToast] = useState(null);

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

  const submit = (e) => {
    e.preventDefault();

    // Construye el bloque de sensores solo con los campos numéricos válidos.
    const sensorsPayload = {};
    let outOfRange = 0;
    Object.entries(FIELD_TO_KEY).forEach(([field, key]) => {
      const raw = form[field];
      if (raw === '' || raw == null) return;
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      sensorsPayload[key] = {
        value,
        unit: SENSOR_META[key].unit,
        percent: sensorPercent(key, value),
        status: 'ok',
      };
      // Detecta si el valor cae fuera del rango estable.
      const risk = getSensorRisk(key, value);
      if (risk && risk.level !== 'stable') outOfRange += 1;
    });

    if (Object.keys(sensorsPayload).length === 0) {
      showToast('Ingresa al menos un valor numérico');
      return;
    }

    const payload = {
      sensors: sensorsPayload,
      source: 'dashboard-manual',
      timestamp: new Date().toISOString(),
    };

    // 1) Actualiza el dashboard al instante (siempre funciona).
    ingestMessage(payload, 'manual');

    // 2) Best-effort: propaga al backend / broker si hay conexión.
    const sentMqtt = mqtt.publish?.('aquaponic/sensors/manual', payload);
    const sentWs = ws.send?.(payload);

    // 3) Avisa al backend para que envíe alertas por correo si algo sale de rango.
    notifyBackend(payload);

    showToast(
      outOfRange > 0
        ? `Parámetros aplicados · ${outOfRange} fuera de rango, alerta enviada`
        : sentMqtt || sentWs
        ? 'Parámetros aplicados y enviados al sistema'
        : 'Parámetros aplicados en el panel'
    );

    setForm({
      ph: '',
      nitratos: '',
      oxigeno: '',
      temperatura: '',
      nivel: '',
      electroconductividad: '',
      turbidez: '',
    });
  };

  // Envía los parámetros al backend para evaluar y notificar por correo.
  const notifyBackend = (payload) => {
    fetch(`${apiConfig.api.baseUrl}/alerts/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn('[alerts] No se pudo notificar al backend:', err.message);
    });
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
    }, 2200);
  };

  const fields = [
    { k: 'ph', label: 'Ingresa valor de pH' },
    { k: 'nitratos', label: 'Ingresa valor de Nitratos' },
    { k: 'oxigeno', label: 'Ingresa Oxígeno Disuelto' },
    { k: 'temperatura', label: 'Ingresa Temperatura' },
    { k: 'nivel', label: 'Ingresa Nvl de agua' },
    { k: 'electroconductividad', label: 'Ingresa Electroconductividad (mS/cm)' },
    { k: 'turbidez', label: 'Ingresa Turbidez (NTU)' },
  ];

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
      <div className="lg:col-span-3">
        <h2 className="font-display font-bold text-2xl mb-6">
          Lecturas en tiempo real
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 justify-items-center">
          {SENSOR_ORDER.map((key, i) => {
            const reading = sensors[key];
            return (
              <div data-anim="param-gauge" key={key}>
                {key === 'ph' ? (
                  <PhScaleBar
                    label={SENSOR_META[key].label}
                    value={reading?.value ?? 0}
                    min={SENSOR_META[key].min}
                    max={SENSOR_META[key].max}
                    delay={0.1 + i * 0.05}
                    status={reading ? getSensorRisk(key, reading.value) : null}
                    inactive={!reading}
                  />
                ) : key === 'nivelAgua' ? (
                  <WaterTankGauge
                    label={SENSOR_META[key].label}
                    value={reading?.percent ?? 0}
                    reading={reading ? formatSensorReading(reading) : null}
                    delay={0.1 + i * 0.05}
                    status={reading ? getSensorRisk(key, reading.value) : null}
                    inactive={!reading}
                  />
                ) : key === 'temperatura' ? (
                  <ThermometerGauge
                    label={SENSOR_META[key].label}
                    value={reading?.percent ?? 0}
                    reading={reading ? formatSensorReading(reading) : null}
                    min={SENSOR_META[key].min}
                    max={SENSOR_META[key].max}
                    delay={0.1 + i * 0.05}
                    status={reading ? getSensorRisk(key, reading.value) : null}
                    inactive={!reading}
                  />
                ) : (
                  <CircleGauge
                    label={SENSOR_META[key].label}
                    value={reading?.percent ?? 0}
                    reading={reading ? formatSensorReading(reading) : null}
                    delay={0.1 + i * 0.05}
                    color={SENSOR_META[key].color}
                    status={reading ? getSensorRisk(key, reading.value) : null}
                    inactive={!reading}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form
        data-anim="form"
        onSubmit={submit}
        className="lg:col-span-2 bg-white rounded-2xl border border-black/5 shadow-sm p-6 self-start"
      >
        <h3 className="font-display font-bold text-2xl text-center mb-6">
          Ingresar Parámetros
        </h3>

        <div className="space-y-3">
          {fields.map((f) => (
            <div data-anim="row" key={f.k}>
              <input
                type="text"
                className="input-field"
                placeholder={f.label}
                aria-label={f.label}
                value={form[f.k]}
                onChange={handleChange(f.k)}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button type="submit" className="btn-outline">
            Actualizar datos
          </button>
        </div>

        {toast && (
          <div
            data-anim="toast"
            className="mt-5 px-4 py-3 rounded-lg bg-accent-green/10 text-accent-green text-sm font-medium border border-accent-green/30 text-center"
          >
            {toast}
          </div>
        )}
      </form>
    </div>
  );
}
