import { useState } from 'react';
import { useFeeder } from '../hooks/useFeeder';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatTime(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function FeederEditor() {
  const { config, save, dispense } = useFeeder();
  const [times, setTimes] = useState(config.times || []);
  const [durationMs, setDurationMs] = useState(config.durationMs || 20000);
  const [portionG, setPortionG] = useState(config.portionG || 15);
  const [newTime, setNewTime] = useState({ h: '08', m: '00' });
  const [feedback, setFeedback] = useState(null);

  if (times.length === 0 && config.times?.length > 0) {
    setTimes(config.times);
  }

  const addTime = () => {
    const formatted = formatTime(newTime.h, newTime.m);
    if (!HHMM.test(formatted)) {
      setFeedback({ ok: false, message: 'Hora inválida' });
      return;
    }
    if (times.includes(formatted)) {
      setFeedback({ ok: false, message: 'Horario duplicado' });
      return;
    }
    setTimes([...times, formatted].sort());
    setNewTime({ h: '08', m: '00' });
  };

  const removeTime = (t) => setTimes(times.filter((x) => x !== t));

  const onSave = async () => {
    if (times.length === 0) {
      setFeedback({ ok: false, message: 'Agrega al menos un horario' });
      return;
    }
    const result = await save({ times, durationMs, portionG });
    setFeedback(
      result.ok
        ? { ok: true, message: 'Horario guardado' }
        : { ok: false, message: result.reason || 'No se pudo guardar' },
    );
  };

  const onDispense = async () => {
    const result = await dispense();
    setFeedback(
      result.ok
        ? { ok: true, message: 'Dispensador activado' }
        : { ok: false, message: result.reason || 'No se pudo dispensar' },
    );
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-base">Dispensador de comida</h3>
        <button
          type="button"
          onClick={onDispense}
          className="btn-outline text-xs px-3 py-1"
        >
          Dispensar ahora
        </button>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink/50 font-semibold mb-2">
          Horarios
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {times.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink/5 border border-black/10 text-sm font-mono"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTime(t)}
                className="text-ink/50 hover:text-accent-red"
                aria-label={`Quitar ${t}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={newTime.h}
            onChange={(e) => setNewTime({ ...newTime, h: e.target.value })}
            className="border border-black/10 rounded-md px-2 py-1 text-sm bg-white"
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={String(h).padStart(2, '0')}>
                {String(h).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="text-ink/50">:</span>
          <select
            value={newTime.m}
            onChange={(e) => setNewTime({ ...newTime, m: e.target.value })}
            className="border border-black/10 rounded-md px-2 py-1 text-sm bg-white"
          >
            {Array.from({ length: 60 }).map((_, m) => (
              <option key={m} value={String(m).padStart(2, '0')}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTime}
            className="btn-outline text-xs px-3 py-1"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-ink/50 font-semibold">
            Duración (s)
          </span>
          <input
            type="number"
            min={1}
            max={120}
            value={Math.round(durationMs / 1000)}
            onChange={(e) => setDurationMs(Math.max(1000, Number(e.target.value) * 1000))}
            className="mt-1 w-full border border-black/10 rounded-md px-2 py-1 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-ink/50 font-semibold">
            Porción (g)
          </span>
          <input
            type="number"
            min={1}
            max={500}
            value={portionG}
            onChange={(e) => setPortionG(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-full border border-black/10 rounded-md px-2 py-1 text-sm bg-white"
          />
        </label>
      </div>

      <button type="button" onClick={onSave} className="btn-outline text-sm w-full">
        Guardar horario
      </button>

      {feedback && (
        <div
          className={
            'text-sm px-3 py-2 rounded-md border ' +
            (feedback.ok
              ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
              : 'bg-accent-red/10 text-accent-red border-accent-red/30')
          }
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
