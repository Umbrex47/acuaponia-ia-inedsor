import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CameraFeed from '../components/CameraFeed';
import { useAquaponic } from '../context/useAquaponic';

const ACTIVITY_LABELS = {
  active: 'Activo',
  normal: 'Normal',
  low: 'Poco movimiento',
};

export default function Fish() {
  const ref = useRef(null);
  const { state } = useAquaponic();
  const { fish } = state;
  const [period, setPeriod] = useState('Crecimiento en 30 días');

  const activityState = fish.behavior?.activityState;
  const hypotheses = fish.assessment?.hypotheses ?? [];
  const topHypothesis = hypotheses[0];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="cam1"]', {
        opacity: 0,
        x: -30,
        duration: 0.7,
        ease: 'power3.out',
      });
      gsap.from('[data-anim="info"]', {
        opacity: 0,
        x: 30,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.15,
      });
      gsap.from('[data-anim="row"]', {
        opacity: 0,
        y: 14,
        duration: 0.45,
        ease: 'power2.out',
        delay: 0.4,
        stagger: 0.08,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div data-anim="cam1">
        <h2 className="font-display font-bold text-2xl mb-3">Cámara 1 · Pecera</h2>
        <CameraFeed
          streamUrl={fish.cameraUrl}
          status={fish.cameraStatus}
          label="Peces"
          subtitle={fish.mood}
          accentClass="text-accent-blue"
        />
        <div className="mt-3 text-sm text-ink/60">
          Cámara dentro de la pecera · IR nocturno · detección YOLO
        </div>
      </div>

      <div data-anim="info">
        <h2 className="font-display font-bold text-2xl text-center mb-1">
          Tipo de pez:
        </h2>
        <h3 className="font-display font-bold text-3xl text-center text-accent-blue mb-5">
          {fish.species}
        </h3>

        <div data-anim="row" className="kv-row mb-2">
          Peces detectados:{' '}
          <span className="font-semibold text-accent-blue">
            {fish.count == null ? '—' : fish.count}
          </span>
        </div>
        <div data-anim="row" className="kv-row mb-2">
          Estado de actividad:{' '}
          <span className="font-semibold">
            {ACTIVITY_LABELS[activityState] ?? fish.mood ?? '—'}
          </span>
        </div>
        {topHypothesis && (
          <div
            data-anim="row"
            className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-sm"
          >
            {topHypothesis.message}
          </div>
        )}

        <div data-anim="row" className="mb-3">
          <select
            className="select-field"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Crecimiento en 30 días</option>
            <option>Crecimiento en 60 días</option>
            <option>Crecimiento en 90 días</option>
          </select>
        </div>

        <div data-anim="row" className="kv-row mb-2">
          30 días: <span className="font-semibold">{fish.growth30}</span>
        </div>
        <div data-anim="row" className="kv-row mb-4">
          90 días: <span className="font-semibold">{fish.growth90}</span>
        </div>

        <div data-anim="row" className="kv-row mb-2">
          Estado de ánimo:{' '}
          <span className="text-accent-blue font-semibold">{fish.mood}</span>
        </div>
        <div data-anim="row" className="kv-row">
          Próxima comida: <span className="font-semibold">{fish.nextFeeding}</span>
        </div>

        <div className="mt-6">
          <h4 className="font-display font-bold text-xl text-center mb-3">
            Recomendaciones
          </h4>
          <div className="flex flex-col items-center gap-3">
            <button data-anim="row" className="btn-solid-blue w-56">
              Limpieza de pecera
            </button>
            <button data-anim="row" className="btn-solid-red w-56">
              Cambio parcial de agua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
