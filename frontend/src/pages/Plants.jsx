import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import CameraFeed from '../components/CameraFeed';
import { useAquaponic } from '../context/useAquaponic';

export default function Plants() {
  const ref = useRef(null);
  const { state } = useAquaponic();
  const { plants } = state;
  const [bed, setBed] = useState(plants.bed);
  const [growth, setGrowth] = useState(plants.growthPercent);
  const topHypothesis = plants.assessment?.hypotheses?.[0];

  useEffect(() => {
    setBed(plants.bed);
  }, [plants.bed]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="cam2"]', {
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
      gsap.from('[data-anim="rec"]', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: 'power2.out',
        delay: 0.5,
        stagger: 0.1,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    gsap.to(
      { v: growth },
      {
        v: plants.growthPercent,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: function () {
          setGrowth(this.targets()[0].v);
        },
      }
    );
  }, [plants.growthPercent]);

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div data-anim="cam2">
        <h2 className="font-display font-bold text-2xl mb-3">Cámara 2 · Cultivo</h2>
        <CameraFeed
          streamUrl={plants.cameraUrl}
          status={plants.cameraStatus}
          label="Plantas"
          subtitle={plants.status}
          accentClass="text-accent-green"
        />
        <div className="mt-3 text-sm text-ink/60">
          Cámara en cama de cultivo · detección de salud / anomalías
        </div>
      </div>

      <div data-anim="info">
        <h2 className="font-display font-bold text-2xl mb-4 text-center">
          Plantas
        </h2>

        <div className="space-y-3 mb-5">
          <select
            className="select-field"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
          >
            <option>Cama 1 · Sustrato hidropónico</option>
            <option>Cama 2 · NFT</option>
            <option>Cama 3 · DWC</option>
          </select>
          <div className="kv-row">{plants.species}</div>
          <div className="kv-row">
            Plantas detectadas:{' '}
            <span className="font-semibold text-accent-green">
              {plants.count == null ? '—' : plants.count}
            </span>
          </div>
          {plants.avgHealthScore != null && (
            <div className="kv-row">
              Score de salud:{' '}
              <span className="font-semibold">
                {Math.round(Number(plants.avgHealthScore) * 100)}%
              </span>
            </div>
          )}
          {topHypothesis && (
            <div className="rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-sm">
              {topHypothesis.message}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-2xl leading-tight">
            ¡Felicidades! Han crecido un
          </p>
          <div className="font-display font-bold text-7xl text-accent-green my-1 leading-none">
            {Math.round(growth)}%
          </div>
          <p className="text-ink/70 text-lg">Últimos 30 días</p>
        </div>

        <div className="mt-5 kv-row text-lg">
          Estado:{' '}
          <span className="text-accent-green font-semibold">{plants.status}</span>
        </div>

        <div className="mt-6">
          <h3 className="font-display font-bold text-xl text-center mb-3">
            Recomendaciones
          </h3>
          <div className="flex flex-col items-center gap-3">
            <button data-anim="rec" className="btn-solid-blue w-56">
              Trasplante a tierra
            </button>
            <button data-anim="rec" className="btn-solid-red w-56">
              Poda de hojas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
