import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useAiReport } from '../hooks/useAiReport';

const SENSOR_LABELS = {
  temperatura: 'Temperatura',
  ph: 'pH',
  oxigeno: 'Oxígeno',
  nivelAgua: 'Nivel de agua',
  nitratos: 'Nitratos',
  co2: 'CO₂',
  electroconductividad: 'Electroconductividad',
  turbiedad: 'Turbidez',
  temperaturaAmbiente: 'Temp. ambiente',
  humedad: 'Humedad',
  presion: 'Presión',
};

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function statusChip(pending) {
  const items = pending.map((p) => ({
    sensor: SENSOR_LABELS[p.sensor] || p.sensor,
    level: p.level,
    remainingMs: p.remainingMs,
  }));
  const total = pending.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent-amber/15 text-accent-amber">
        {total > 0 ? `${total} en alerta` : 'Sin alertas activas'}
      </span>
      {items.map((it, i) => (
        <span
          key={i}
          className={
            'text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ' +
            (it.level === 'high'
              ? 'bg-accent-red/15 text-accent-red'
              : 'bg-accent-blue/15 text-accent-blue')
          }
        >
          {it.sensor} · {Math.round(it.remainingMs / 1000)}s
        </span>
      ))}
    </div>
  );
}

export default function AiReportPanel() {
  const { status, logs, error, loading, refresh, clearLogs, cancelPending } = useAiReport();
  const ref = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="ai-card"]', {
        opacity: 0,
        y: 8,
        duration: 0.35,
        stagger: 0.05,
        ease: 'power2.out',
      });
    }, ref);
    return () => ctx.revert();
  }, [logs.length]);

  const pending = status.pending ?? [];

  return (
    <section
      ref={ref}
      className="bg-white rounded-2xl border border-black/10 shadow-sm p-5"
    >
      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-lg">Bitácora IA</h2>
          <p className="text-xs text-ink/50">
            Alerta temprana → decisión → normalización. Ciclo completo por intervención.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="text-xs px-3 py-1.5 rounded-md border border-black/10 hover:bg-black/5"
          >
            Refrescar
          </button>
          <button
            type="button"
            onClick={clearLogs}
            className="text-xs px-3 py-1.5 rounded-md border border-black/10 text-ink/60 hover:bg-black/5"
          >
            Limpiar
          </button>
        </div>
      </header>

      {statusChip(pending)}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-md bg-accent-red/10 text-accent-red text-xs border border-accent-red/30">
          {error}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="mt-6 text-xs text-ink/50 italic text-center py-8">
          Cargando bitácora…
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-6 text-xs text-ink/50 italic text-center py-8">
          Sin intervenciones registradas. Activa un escenario en /parameters o
          fuerza una intervención desde el panel de IA.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} onCancel={cancelPending} />
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {pending.map((p) => (
            <button
              key={p.sensor}
              type="button"
              onClick={() => cancelPending(p.sensor)}
              className="text-[11px] px-2 py-1 rounded-md border border-accent-amber/30 text-accent-amber hover:bg-accent-amber/10"
            >
              Cancelar {SENSOR_LABELS[p.sensor] || p.sensor}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function LogCard({ log, onCancel }) {
  const label = SENSOR_LABELS[log.sensor] || log.label || log.sensor;
  const dir = log.level === 'high' ? 'por encima' : 'por debajo';
  const accent =
    log.level === 'high'
      ? 'border-accent-red/30 bg-accent-red/5'
      : 'border-accent-blue/30 bg-accent-blue/5';
  return (
    <li
      data-anim="ai-card"
      className={`rounded-lg border p-3 text-sm ${accent}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-semibold text-ink">
          {label} · {log.value}{log.unit ? ' ' + log.unit : ''}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink/50">
          {timeAgo(log.firstSeenAt)}
        </span>
      </div>
      <p className="text-xs text-ink/70 mt-1">
        {label} {dir} del rango óptimo ({log.optimal?.min}–{log.optimal?.max}
        {log.unit ? ' ' + log.unit : ''}). Esperando escalación de la IA.
      </p>
      <button
        type="button"
        onClick={() => onCancel?.(log.sensor)}
        className="mt-2 text-[10px] px-2 py-1 rounded-md border border-black/10 text-ink/60 hover:bg-black/5"
      >
        Cancelar escalación
      </button>
    </li>
  );
}
