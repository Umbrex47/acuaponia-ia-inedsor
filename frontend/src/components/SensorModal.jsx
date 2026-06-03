import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Icon } from './Icon';
import { formatSensorReading } from '../data/normalizer';

export default function SensorModal({ sensor, deviceStatus, sensorReading, onClose }) {
  const overlayRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
      tl.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.4)',
          clearProps: 'opacity,transform',
        },
        '-=0.1'
      );
      // Solo desplazamiento (sin opacidad) para garantizar que el texto
      // siempre quede legible aunque la animación se interrumpa.
      tl.fromTo(
        '[data-modal-row]',
        { y: 8 },
        {
          y: 0,
          duration: 0.35,
          ease: 'power2.out',
          stagger: 0.05,
          clearProps: 'transform',
        },
        0.2
      );
    }, overlayRef);

    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      ctx.revert();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleClose = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(cardRef.current, {
      opacity: 0,
      y: 20,
      scale: 0.97,
      duration: 0.2,
      ease: 'power2.in',
    });
    tl.to(
      overlayRef.current,
      { opacity: 0, duration: 0.2, ease: 'power2.in' },
      '-=0.15'
    );
  };

  if (!sensor) return null;

  const IconComp = Icon[sensor.icon] || Icon.Sensors;

  const statusMeta =
    deviceStatus === 'ok'
      ? { label: 'Operativo', color: 'bg-accent-green' }
      : deviceStatus === 'warn'
      ? { label: 'Atención', color: 'bg-accent-amber' }
      : deviceStatus === 'off'
      ? { label: 'No disponible', color: 'bg-neutral-400' }
      : { label: 'Falla', color: 'bg-accent-red' };

  const rows = [
    { label: 'Modelo', value: sensor.model },
    { label: 'Fabricante', value: sensor.manufacturer },
    { label: 'Parámetro medido', value: sensor.parameter },
    { label: 'Rango', value: sensor.range },
    { label: 'Precisión', value: sensor.accuracy },
    { label: 'Interfaz', value: sensor.interface },
    { label: 'Ubicación', value: sensor.location },
    { label: 'Pin / Conexión', value: sensor.pin },
  ];

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensor-modal-title"
    >
      <div
        ref={cardRef}
        className="bg-paper rounded-2xl border border-black/10 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-black/5">
          <div className="flex items-start gap-4">
            <div className="device-circle !w-16 !h-16 shrink-0">
              <IconComp className="w-8 h-8 text-ink" />
              <span
                className={
                  'badge ' +
                  (deviceStatus === 'ok'
                    ? 'badge-ok'
                    : deviceStatus === 'warn'
                    ? 'badge-warn'
                    : deviceStatus === 'off'
                    ? 'badge-off'
                    : 'badge-err')
                }
              >
                {deviceStatus === 'off' ? (
                  <Icon.Dash className="w-4 h-4" />
                ) : deviceStatus === 'ok' ? (
                  <Icon.Check className="w-4 h-4" />
                ) : (
                  <Icon.Alert className="w-4 h-4" />
                )}
              </span>
            </div>
            <div>
              <h2
                id="sensor-modal-title"
                className="font-display font-bold text-2xl leading-tight"
              >
                {sensor.name}
              </h2>
              <div className="mt-1 inline-flex items-center gap-2">
                <span className={'w-2 h-2 rounded-full ' + statusMeta.color} />
                <span className="text-sm font-medium text-ink/70">
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="nav-pill !bg-ink hover:!bg-ink/80 shrink-0"
            aria-label="Cerrar modal"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {sensor.description && (
            <p data-modal-row className="text-ink/75 leading-relaxed">
              {sensor.description}
            </p>
          )}

          {sensorReading && (
            <div data-modal-row className="bg-white border border-black/5 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink/50 font-medium">
                  Lectura actual
                </div>
                <div className="font-display font-bold text-2xl mt-1">
                  {formatSensorReading(sensorReading)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-ink/50 font-medium">
                  Carga
                </div>
                <div className="font-display font-bold text-2xl mt-1">
                  {Math.round(sensorReading.percent)}%
                </div>
              </div>
            </div>
          )}

          <div data-modal-row>
            <h3 className="font-display font-bold text-base mb-3">
              Especificaciones técnicas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-baseline justify-between gap-3 py-1.5 border-b border-black/5"
                >
                  <span className="text-ink/55">{r.label}</span>
                  <span className="font-medium text-right">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-modal-row className="rounded-xl border-2 border-ink p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base">
                Consumo eléctrico
              </h3>
              <span className="text-xs text-ink/50 font-medium uppercase tracking-wider">
                {sensor.voltage}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <ConsumptionCell label="Corriente" value={`${sensor.currentMa} mA`} />
              <ConsumptionCell label="Potencia" value={`${(sensor.powerW * 1000).toFixed(0)} mW`} />
              <ConsumptionCell
                label="Día (estimado)"
                value={`${(sensor.powerW * 24).toFixed(2)} Wh`}
              />
            </div>

            <p className="mt-3 text-xs text-ink/55 leading-relaxed">
              {sensor.currentTyp}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConsumptionCell({ label, value }) {
  return (
    <div className="bg-paper rounded-lg py-3 border border-black/5">
      <div className="text-[10px] uppercase tracking-wider text-ink/50 font-semibold">
        {label}
      </div>
      <div className="font-display font-bold text-lg mt-0.5">{value}</div>
    </div>
  );
}
