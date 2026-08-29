import { useEffect, useState } from 'react';
import { apiConfig } from '../config/api';
import { Icon } from './Icon';

const PRESETS = [
  {
    id: 'realistic',
    label: 'Realista',
    description: 'Valores tropicales estables para Cartagena.',
    tone: 'blue',
  },
  {
    id: 'unstable',
    label: 'Inestable',
    description: 'pH y oxígeno bajan para que la IA actúe.',
    tone: 'amber',
  },
  {
    id: 'chaotic',
    label: 'Caótico',
    description: 'Múltiples parámetros fuera de rango rápidamente.',
    tone: 'red',
  },
];

export default function SimulationPresets() {
  const [active, setActive] = useState('realistic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${apiConfig.api.baseUrl}/demo/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.scenario) setActive(data.scenario);
      })
      .catch(() => {});
  }, []);

  const activate = async (scenario) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/demo/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.reason || `HTTP ${res.status}`);
      }
      setActive(data.scenario);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-ink rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="font-display font-bold text-lg tracking-tight">
            Escenarios de simulación
          </h2>
          <p className="text-sm text-ink/60">
            Cambia el comportamiento de los sensores demo en tiempo real.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-neutral-100 border border-neutral-200">
          Activo: {active}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRESETS.map((preset) => {
          const isActive = active === preset.id;
          const base =
            preset.tone === 'red'
              ? 'border-accent-red text-accent-red hover:bg-accent-red hover:text-white'
              : preset.tone === 'amber'
                ? 'border-accent-amber text-accent-amber hover:bg-accent-amber hover:text-white'
                : 'border-accent-blue text-accent-blue hover:bg-accent-blue hover:text-white';
          const activeCls =
            preset.tone === 'red'
              ? 'bg-accent-red text-white'
              : preset.tone === 'amber'
                ? 'bg-accent-amber text-white'
                : 'bg-accent-blue text-white';
          return (
            <button
              key={preset.id}
              onClick={() => activate(preset.id)}
              disabled={loading}
              className={[
                'btn-outline text-sm justify-start text-left !px-4 !py-3',
                isActive ? activeCls : base,
                loading && 'opacity-60 cursor-wait',
              ].join(' ')}
              aria-pressed={isActive}
            >
              <span className="font-semibold block">{preset.label}</span>
              <span className="text-xs font-normal opacity-90 leading-tight block mt-1">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 text-sm text-accent-red flex items-center gap-2">
          <Icon.Alert className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
