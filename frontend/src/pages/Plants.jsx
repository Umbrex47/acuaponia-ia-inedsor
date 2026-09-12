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

  const [selectedPlantId, setSelectedPlantId] = useState('P01');

  // Obtener plantas individuales desde la telemetría o generar grilla P01..P09
  const individualPlants = plants.individual?.length
    ? plants.individual
    : Array.from({ length: 9 }, (_, i) => {
        const id = `P0${i + 1}`;
        const isAnom = id === 'P02' || id === 'P06';
        return {
          plant_id: id,
          name: `Planta ${id}`,
          status: isAnom ? 'anomalia' : 'normal',
          status_label: isAnom ? 'Anomalía crítica' : 'Saludable',
          area_cm2: 243.2 + (i % 3) * 5.4,
          green_coverage_pct: isAnom ? 12 : 98,
          growth_rate_pct_per_day: isAnom ? -1.2 : 3.8,
          leaf_count: 10 + (i % 4),
          health_score: isAnom ? 0.38 : 0.94,
          factors: isAnom ? ['Clorosis foliar moderada', 'Desaceleración radicular'] : ['Desarrollo foliar vigoroso'],
          recommendations: isAnom ? [{ action: 'Revisar pH y quelato de hierro', reason: 'Clorosis' }] : [],
        };
      });

  const selectedPlant =
    individualPlants.find((p) => p.plant_id === selectedPlantId) || individualPlants[0];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'normal':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">🟢 Saludable</span>;
      case 'atencion':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">🟡 Atención</span>;
      case 'estres':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">🟠 Estrés</span>;
      case 'anomalia':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">🔴 Anomalía</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">⚪ Desconocido</span>;
    }
  };

  return (
    <div ref={ref} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div data-anim="cam2">
          <h2 className="font-display font-bold text-2xl mb-3">Cámara 2 · Cultivo (AquaGia Vision)</h2>
          <CameraFeed
            streamUrl={plants.cameraUrl}
            status={plants.cameraStatus}
            label="Plantas"
            subtitle={plants.status}
            accentClass="text-accent-green"
          />
          <div className="mt-3 text-sm text-ink/60">
            Cámara en cama de cultivo · Monitoreo individual P01–P09
          </div>

          {/* Grilla interactiva de plantas */}
          <div className="mt-5 p-4 rounded-xl border border-ink/10 bg-surface/50 backdrop-blur-sm">
            <h3 className="font-display font-semibold text-lg mb-3">
              Monitoreo Individual por Región (Modo A)
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {individualPlants.map((p) => {
                const isSelected = p.plant_id === selectedPlantId;
                const borderColors = {
                  normal: 'border-emerald-500/40 hover:border-emerald-500',
                  atencion: 'border-amber-500/40 hover:border-amber-500',
                  estres: 'border-orange-500/40 hover:border-orange-500',
                  anomalia: 'border-rose-500/50 hover:border-rose-500',
                };
                return (
                  <button
                    key={p.plant_id}
                    onClick={() => setSelectedPlantId(p.plant_id)}
                    className={`p-2.5 rounded-lg border text-left transition-all duration-150 ${
                      borderColors[p.status] || 'border-ink/20'
                    } ${
                      isSelected
                        ? 'ring-2 ring-accent-green bg-accent-green/10 shadow-sm'
                        : 'bg-ink/5 hover:bg-ink/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{p.plant_id}</span>
                      <span className="text-xs">
                        {p.status === 'normal' ? '🟢' : p.status === 'atencion' ? '🟡' : p.status === 'estres' ? '🟠' : '🔴'}
                      </span>
                    </div>
                    <div className="text-xs text-ink/70 mt-1">{p.area_cm2} cm²</div>
                    <div className="text-xs font-semibold text-accent-green">
                      {p.growth_rate_pct_per_day >= 0 ? `+${p.growth_rate_pct_per_day}%` : `${p.growth_rate_pct_per_day}%`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div data-anim="info">
          <h2 className="font-display font-bold text-2xl mb-4 text-center">
            AquaGia Vision · Ficha Individual
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
              Plantas monitoreadas:{' '}
              <span className="font-semibold text-accent-green">
                {plants.count == null ? individualPlants.length : plants.count}
              </span>
            </div>
            {plants.avgHealthScore != null && (
              <div className="kv-row">
                Score promedio cultivo:{' '}
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

          {/* Ficha en detalle de la planta seleccionada */}
          {selectedPlant && (
            <div className="p-5 rounded-xl border border-ink/15 bg-ink/5 space-y-4">
              <div className="flex items-center justify-between border-b border-ink/10 pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink/60">
                    Ficha Técnica
                  </span>
                  <h3 className="font-display font-bold text-2xl text-accent-green">
                    PLANTA {selectedPlant.plant_id}
                  </h3>
                </div>
                <div>{getStatusBadge(selectedPlant.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 rounded-lg bg-surface/70 border border-ink/5">
                  <div className="text-xs text-ink/60">Área Vegetal</div>
                  <div className="text-lg font-bold">{selectedPlant.area_cm2} cm²</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/70 border border-ink/5">
                  <div className="text-xs text-ink/60">Cobertura Verde</div>
                  <div className="text-lg font-bold text-accent-green">
                    {selectedPlant.green_coverage_pct}%
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/70 border border-ink/5">
                  <div className="text-xs text-ink/60">Crecimiento / día</div>
                  <div className="text-lg font-bold">
                    {selectedPlant.growth_rate_pct_per_day >= 0 ? `+${selectedPlant.growth_rate_pct_per_day}%` : `${selectedPlant.growth_rate_pct_per_day}%`}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/70 border border-ink/5">
                  <div className="text-xs text-ink/60">Número de Hojas</div>
                  <div className="text-lg font-bold">{selectedPlant.leaf_count} hojas</div>
                </div>
              </div>

              {selectedPlant.factors?.length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-ink/70">Factores diagnosticados:</div>
                  <ul className="list-disc list-inside text-ink/80 pl-1">
                    {selectedPlant.factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPlant.recommendations?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-semibold mb-1">Acción recomendada:</div>
                  {selectedPlant.recommendations.map((rec, i) => (
                    <div key={i}>• {rec.action} ({rec.reason})</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 text-center">
            <p className="font-display font-bold text-2xl leading-tight">
              ¡Felicidades! Han crecido un
            </p>
            <div className="font-display font-bold text-7xl text-accent-green my-1 leading-none">
              {Math.round(growth)}%
            </div>
            <p className="text-ink/70 text-lg">Últimos 30 días</p>
          </div>

          <div className="mt-6">
            <h3 className="font-display font-bold text-xl text-center mb-3">
              Acciones Generales del Cultivo
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
    </div>
  );
}

