import { useEffect, useRef, useState, useMemo } from 'react';
import gsap from 'gsap';
import { apiConfig } from '../config/api';
import { Icon } from '../components/Icon';

const PRESETS = [
  {
    id: 'optimo',
    name: 'Condición Óptima',
    badge: 'Equilibrio Total',
    desc: 'Valores ideales para tilapia y lechuga/albahaca.',
    params: {
      ph: 6.9,
      oxigenoDisuelto: 6.8,
      temperaturaAgua: 23.8,
      nivelAgua: 88,
      electroconductividad: 1.45,
      turbidez: 8.5,
      plantStatus: 'healthy',
      fishStatus: 'active',
    },
  },
  {
    id: 'acidosis',
    name: 'Acidosis Grave (pH Ácido)',
    badge: 'pH 5.1 (Crítico)',
    desc: 'Caída de pH sin buffer carbonatado. Bloquea fósforo e inhibe biofiltro.',
    params: {
      ph: 5.1,
      oxigenoDisuelto: 5.9,
      temperaturaAgua: 22.5,
      nivelAgua: 82,
      electroconductividad: 1.6,
      turbidez: 14.0,
      plantStatus: 'stressed',
      fishStatus: 'stressed',
    },
  },
  {
    id: 'alcalosis',
    name: 'Alcalosis Extrema (pH Alcalino)',
    badge: 'pH 8.6 (Alcalino)',
    desc: 'Precipitación de hierro, clorosis marcada y pico de amoníaco no ionizado (NH3).',
    params: {
      ph: 8.6,
      oxigenoDisuelto: 6.2,
      temperaturaAgua: 26.2,
      nivelAgua: 85,
      electroconductividad: 1.35,
      turbidez: 11.0,
      plantStatus: 'nutrient_deficient',
      fishStatus: 'stressed',
    },
  },
  {
    id: 'hipoxia',
    name: 'Hipoxia Severa',
    badge: 'OD < 3.0 mg/L',
    desc: 'OD crítico; peces boqueando en la superficie por asfixia.',
    params: {
      ph: 6.8,
      oxigenoDisuelto: 2.6,
      temperaturaAgua: 27.2,
      nivelAgua: 78,
      electroconductividad: 1.4,
      turbidez: 24.0,
      plantStatus: 'stressed',
      fishStatus: 'surface_crowding',
    },
  },
  {
    id: 'marcha_seco',
    name: 'Nivel Crítico de Agua',
    badge: '5.4 cm (17%)',
    desc: 'Reservorio < 25%; peligro inminente de quemar la bomba sumergible.',
    params: {
      ph: 7.0,
      oxigenoDisuelto: 6.2,
      temperaturaAgua: 23.0,
      nivelAgua: 17,
      electroconductividad: 1.2,
      turbidez: 12.0,
      plantStatus: 'healthy',
      fishStatus: 'active',
    },
  },
  {
    id: 'estres_termico',
    name: 'Estrés Térmico (Calor)',
    badge: 'Temp > 32°C',
    desc: 'Agua cálida desgasifica O2 y dispara la tasa de respiración de peces.',
    params: {
      ph: 7.1,
      oxigenoDisuelto: 4.4,
      temperaturaAgua: 32.2,
      nivelAgua: 70,
      electroconductividad: 1.9,
      turbidez: 19.0,
      plantStatus: 'stressed',
      fishStatus: 'stressed',
    },
  },
  {
    id: 'baja_ec',
    name: 'Agotamiento de Sales (Baja EC)',
    badge: 'EC 0.45 mS/cm',
    desc: 'Solución nutritiva sobre-diluida; inanición de N-P-K en raíces.',
    params: {
      ph: 6.7,
      oxigenoDisuelto: 6.5,
      temperaturaAgua: 23.0,
      nivelAgua: 90,
      electroconductividad: 0.45,
      turbidez: 5.0,
      plantStatus: 'nutrient_deficient',
      fishStatus: 'calm',
    },
  },
  {
    id: 'turbidez_alta',
    name: 'Sobrecarga de Sólidos',
    badge: 'Turbidez 34 NTU',
    desc: 'Exceso de detritos coloidales; saturación del filtro y daño branquial.',
    params: {
      ph: 6.85,
      oxigenoDisuelto: 5.0,
      temperaturaAgua: 24.5,
      nivelAgua: 76,
      electroconductividad: 1.65,
      turbidez: 34.0,
      plantStatus: 'stressed',
      fishStatus: 'stressed',
    },
  },
];

const renderPresetIcon = (id) => {
  switch (id) {
    case 'optimo':
      return <Icon.CheckCircle className="w-5 h-5 text-emerald-600" />;
    case 'acidosis':
    case 'alcalosis':
      return <Icon.pH className="w-5 h-5 text-rose-600" />;
    case 'hipoxia':
      return <Icon.O2 className="w-5 h-5 text-rose-600" />;
    case 'marcha_seco':
      return <Icon.AlertTriangle className="w-5 h-5 text-amber-600" />;
    case 'estres_termico':
      return <Icon.Flame className="w-5 h-5 text-amber-600" />;
    case 'baja_ec':
      return <Icon.Leaf className="w-5 h-5 text-amber-600" />;
    case 'turbidez_alta':
      return <Icon.Turbidity className="w-5 h-5 text-neutral-600" />;
    default:
      return <Icon.Activity className="w-5 h-5 text-ink" />;
  }
};

const CATEGORIES = [
  'Todos',
  'Sistema Global',
  'pH',
  'Oxígeno',
  'Temperatura',
  'Nivel de Agua',
  'EC Nutrientes',
  'Turbidez',
  'Plantas',
  'Peces',
];

const CATEGORY_COLORS = {
  'Sistema Global': 'bg-purple-100 text-purple-800 border-purple-200',
  pH: 'bg-amber-100 text-amber-800 border-amber-200',
  Oxígeno: 'bg-sky-100 text-sky-800 border-sky-200',
  Temperatura: 'bg-orange-100 text-orange-800 border-orange-200',
  'Nivel de Agua': 'bg-blue-100 text-blue-800 border-blue-200',
  'EC Nutrientes': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Turbidez: 'bg-stone-200 text-stone-800 border-stone-300',
  Plantas: 'bg-lime-100 text-lime-800 border-lime-200',
  Peces: 'bg-teal-100 text-teal-800 border-teal-200',
};

export default function Playground() {
  const containerRef = useRef(null);
  const resultsRef = useRef(null);

  // Parámetros de prueba interactivos
  const [params, setParams] = useState({
    ph: 6.9,
    oxigenoDisuelto: 6.8,
    temperaturaAgua: 23.8,
    nivelAgua: 85,
    electroconductividad: 1.45,
    turbidez: 8.0,
    plantStatus: 'healthy',
    fishStatus: 'active',
  });

  // Opciones de evaluación
  const [executeIot, setExecuteIot] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showAdvancedKey, setShowAdvancedKey] = useState(false);

  // Estados de ejecución
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('decisions'); // 'decisions' | 'questions' | 'raw'
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Animaciones iniciales GSAP
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="header"]', {
        opacity: 0,
        y: -12,
        duration: 0.5,
        ease: 'power2.out',
      });
      gsap.from('[data-anim="card"]', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.1,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Cargar historial previo si existe
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${apiConfig.api.baseUrl}/decision/typesafe/history?limit=10`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setHistory(data);
        }
      } catch {
        // Silencioso si el backend aún está arrancando
      }
    };
    fetchHistory();
  }, []);

  const handleParamChange = (key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]: typeof value === 'number' ? value : value,
    }));
  };

  const applyPreset = (preset) => {
    setParams({ ...preset.params });
    gsap.fromTo(
      '[data-anim="input-grid"]',
      { scale: 0.985, opacity: 0.7 },
      { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' }
    );
  };

  const runEvaluation = async () => {
    setEvaluating(true);
    setError(null);

    try {
      const payload = {
        params,
        options: {
          executeIot,
          apiKey: customApiKey.trim() || undefined,
        },
      };

      const res = await fetch(`${apiConfig.api.baseUrl}/decision/typesafe/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.reason || 'Error en la evaluación de TypeSafe AI');
      }

      setResult(data.result);
      setHistory((prev) => [data.result, ...prev.slice(0, 15)]);

      // Scroll y animación suave hacia los resultados
      setTimeout(() => {
        if (resultsRef.current) {
          gsap.fromTo(
            resultsRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
          );
        }
      }, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  // Filtrado de preguntas por categoría
  const filteredQuestions = useMemo(() => {
    if (!result?.questions) return [];
    const entries = Object.entries(result.questions);
    if (selectedCategory === 'Todos') return entries;
    return entries.filter(([, q]) => q.category === selectedCategory);
  }, [result, selectedCategory]);

  // Conteo de preguntas por categoría para los chips
  const categoryCounts = useMemo(() => {
    if (!result?.questions) return {};
    const counts = { Todos: Object.keys(result.questions).length };
    for (const [, q] of Object.entries(result.questions)) {
      counts[q.category] = (counts[q.category] || 0) + 1;
    }
    return counts;
  }, [result]);

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Encabezado */}
      <div data-anim="header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">
              Playground TypeSafe AI
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Validación Estricta TypeSafe AI
            </span>
          </div>
          <p className="text-sm text-ink/60 mt-1 max-w-2xl">
            Simula escenarios ambientales críticos (pH ácido/alcalino, hipoxia, vaciado, calor).
            Valida con reglas estrictas por parámetro y evaluación integradora del ecosistema acuapónico.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-black/5 hover:bg-black/10 px-3.5 py-2 rounded-xl transition-all">
            <input
              type="checkbox"
              checked={executeIot}
              onChange={(e) => setExecuteIot(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
              {executeIot ? (
                <>
                  <Icon.Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ejecutar en IoT Real</span>
                </>
              ) : (
                <>
                  <Icon.Beaker className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Solo Simulación</span>
                </>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Selector de Presets de Prueba */}
      <div data-anim="card" className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase font-bold tracking-wider text-ink/50">
            Escenarios de Prueba Rápidos
          </label>
          <span className="text-[11px] text-ink/40 font-mono">
            Haz clic en un preset para cargar sus valores
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="flex flex-col items-start p-3 text-left rounded-xl border border-black/10 hover:border-black/30 hover:shadow-sm bg-white hover:bg-black/[0.02] transition-all group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="p-1 rounded-lg bg-black/5 group-hover:bg-black/10 transition-colors">
                  {renderPresetIcon(p.id)}
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/5 text-ink/60 group-hover:text-ink">
                  {p.badge}
                </span>
              </div>
              <span className="font-semibold text-xs text-ink group-hover:text-black">
                {p.name}
              </span>
              <span className="text-[11px] text-ink/50 line-clamp-1 mt-0.5">
                {p.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Parámetros de Entrada */}
      <div data-anim="card" className="bg-neutral-50/70 border border-black/5 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-base text-ink">
            Parámetros Fisicoquímicos y Biológicos
          </h2>
          <button
            onClick={() => setShowAdvancedKey(!showAdvancedKey)}
            className="text-xs text-ink/60 hover:text-ink underline font-mono"
          >
            {showAdvancedKey ? 'Ocultar API Key' : 'Configurar TypeSafe API Key'}
          </button>
        </div>

        {showAdvancedKey && (
          <div className="p-3 bg-white border border-black/10 rounded-xl space-y-1">
            <label className="text-xs font-medium text-ink">TypeSafe API Key (Opcional):</label>
            <input
              type="password"
              placeholder="ts_live_..."
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-black/15 focus:outline-none focus:border-black"
            />
            <p className="text-[11px] text-ink/50">
              Si se omite, se usa la API key del backend o el motor determinista local calibrado con las mismas reglas de TypeSafe.
            </p>
          </div>
        )}

        <div data-anim="input-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* pH */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Potencial de Hidrógeno (pH)</span>
              <span className={
                'font-mono font-bold text-sm ' +
                (params.ph < 5.8 ? 'text-rose-600' : params.ph > 8.0 ? 'text-amber-600' : 'text-emerald-600')
              }>
                {params.ph.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="4.5"
              max="9.5"
              step="0.1"
              value={params.ph}
              onChange={(e) => handleParamChange('ph', parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span className="text-rose-600 font-semibold">Ácido (&lt;5.5)</span>
              <span className="text-emerald-600 font-bold">Óptimo (6.5 - 7.4)</span>
              <span className="text-amber-600 font-semibold">Alcalino (&gt;8.2)</span>
            </div>
          </div>

          {/* Oxígeno Disuelto */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Oxígeno Disuelto (OD)</span>
              <span className={
                'font-mono font-bold text-sm ' +
                (params.oxigenoDisuelto < 4.0 ? 'text-rose-600' : 'text-cyan-700')
              }>
                {params.oxigenoDisuelto.toFixed(1)} mg/L
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="11.0"
              step="0.1"
              value={params.oxigenoDisuelto}
              onChange={(e) => handleParamChange('oxigenoDisuelto', parseFloat(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span className="text-rose-600 font-semibold">Hipoxia (&lt;4.0)</span>
              <span className="text-cyan-600 font-bold">Óptimo (5.0 - 8.5)</span>
              <span>Saturación (&gt;8.5)</span>
            </div>
          </div>

          {/* Temperatura de Agua */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Temperatura del Agua</span>
              <span className={
                'font-mono font-bold text-sm ' +
                (params.temperaturaAgua > 30 || params.temperaturaAgua < 18 ? 'text-rose-600' : 'text-amber-700')
              }>
                {params.temperaturaAgua.toFixed(1)} °C
              </span>
            </div>
            <input
              type="range"
              min="15.0"
              max="35.0"
              step="0.5"
              value={params.temperaturaAgua}
              onChange={(e) => handleParamChange('temperaturaAgua', parseFloat(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span>Frío (&lt;18)</span>
              <span className="text-amber-600 font-bold">Confort (22 - 28)</span>
              <span className="text-rose-600 font-semibold">Calor (&gt;31)</span>
            </div>
          </div>

          {/* Nivel de Agua */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Nivel del Reservorio</span>
              <div className="text-right">
                <span className={
                  'font-mono font-bold text-sm ' +
                  (params.nivelAgua < 25 ? 'text-rose-600' : 'text-blue-700')
                }>
                  {((params.nivelAgua / 100) * 32).toFixed(1)} cm
                </span>
                <span className="text-xs text-ink/50 ml-1.5 font-mono">
                  ({params.nivelAgua.toFixed(0)}%)
                </span>
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={params.nivelAgua}
              onChange={(e) => handleParamChange('nivelAgua', parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span className="text-rose-600 font-semibold">Marcha en seco (&lt;8 cm / &lt;25%)</span>
              <span className="text-blue-600 font-bold">Seguro (24 - 32 cm / &gt;75%)</span>
              <span>Rebose (&gt;28 cm / &gt;88%)</span>
            </div>
          </div>

          {/* Electroconductividad EC */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Conductividad (EC / Nutrientes)</span>
              <span className={
                'font-mono font-bold text-sm ' +
                (params.electroconductividad < 0.8 || params.electroconductividad > 2.2 ? 'text-purple-700' : 'text-emerald-700')
              }>
                {params.electroconductividad.toFixed(2)} mS/cm
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.2"
              step="0.05"
              value={params.electroconductividad}
              onChange={(e) => handleParamChange('electroconductividad', parseFloat(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span className="text-amber-600">Diluida (&lt;0.8)</span>
              <span className="text-purple-600 font-bold">Nutritiva (0.8 - 2.2)</span>
              <span className="text-rose-600">Salina (&gt;2.2)</span>
            </div>
          </div>

          {/* Turbidez */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink">Turbidez y Claridad</span>
              <span className={
                'font-mono font-bold text-sm ' +
                (params.turbidez > 25 ? 'text-rose-600' : 'text-stone-700')
              }>
                {params.turbidez.toFixed(1)} NTU
              </span>
            </div>
            <input
              type="range"
              min="2.0"
              max="45.0"
              step="1"
              value={params.turbidez}
              onChange={(e) => handleParamChange('turbidez', parseFloat(e.target.value))}
              className="w-full accent-stone-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-ink/40 font-mono">
              <span className="text-emerald-600 font-semibold">Cristalina (&lt;10)</span>
              <span>Aceptable (10 - 25)</span>
              <span className="text-rose-600 font-semibold">Colmatación (&gt;25)</span>
            </div>
          </div>

          {/* Estado de Plantas (Visión) */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <label className="block text-xs font-medium text-ink">
              Diagnóstico Fitosanitario (Cámara Plantas)
            </label>
            <select
              value={params.plantStatus}
              onChange={(e) => handleParamChange('plantStatus', e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-black font-medium text-ink bg-white"
            >
              <option value="healthy">Saludables (Follaje Vigoroso)</option>
              <option value="nutrient_deficient">Clorosis / Deficiencia Nutricional</option>
              <option value="stressed">Estrés Foliar / Hídrico</option>
              <option value="diseased">Manchas Necróticas / Infección</option>
            </select>
            <p className="text-[10px] text-ink/50">
              Integrado con clasificador EfficientNet-B0 + ExG.
            </p>
          </div>

          {/* Estado de Peces (Visión) */}
          <div className="bg-white p-4 rounded-xl border border-black/5 space-y-2">
            <label className="block text-xs font-medium text-ink">
              Conducta de Peces (Cámara Acuario)
            </label>
            <select
              value={params.fishStatus}
              onChange={(e) => handleParamChange('fishStatus', e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-black/10 focus:outline-none focus:border-black font-medium text-ink bg-white"
            >
              <option value="active">Activos y Natación Normal</option>
              <option value="calm">Calmados / Reposo</option>
              <option value="stressed">Nado Errático / Estrés</option>
              <option value="surface_crowding">Boqueando en Superficie (Hipoxia)</option>
            </select>
            <p className="text-[10px] text-ink/50">
              Integrado con detector YOLO11s + SORT tracking.
            </p>
          </div>

          {/* Botón de Ejecución */}
          <div className="bg-white p-4 rounded-xl border border-black/5 flex flex-col justify-end">
            <button
              onClick={runEvaluation}
              disabled={evaluating}
              className="w-full py-3 px-4 rounded-xl font-display font-semibold text-sm text-white bg-ink hover:bg-black active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {evaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Evaluando parámetros con TypeSafe AI...</span>
                </>
              ) : (
                <>
                  <Icon.Sparkles className="w-4 h-4 text-white shrink-0" />
                  <span>Evaluar con TypeSafe AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mensaje de Error */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <strong>Error en la evaluación:</strong> {error}
        </div>
      )}

      {/* Resultados de la Evaluación */}
      {result && (
        <div ref={resultsRef} className="space-y-6 pt-2">
          {/* Banner de Estado Global */}
          <div
            className={
              'p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ' +
              (result.status === 'optimal'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : result.status === 'warning'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950')
            }
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0">
                  {result.status === 'optimal' ? (
                    <Icon.CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : result.status === 'warning' ? (
                    <Icon.AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Icon.AlertOctagon className="w-5 h-5 text-rose-600" />
                  )}
                </span>
                <span className="text-xs font-mono uppercase tracking-wider font-bold opacity-70">
                  Diagnóstico TypeSafe AI
                </span>
              </div>
              <h3 className="font-display font-bold text-xl sm:text-2xl">
                {result.statusLabel}
              </h3>
              <p className="text-sm opacity-80 max-w-xl">
                {result.explanations.summary}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-black/5 flex flex-col items-center justify-center min-w-[180px]">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-ink/60">
                Resiliencia Ecosistémica
              </span>
              <span className="font-display font-extrabold text-3xl text-ink">
                {result.systemStabilityScore}%
              </span>
              <span className="text-xs font-medium text-ink/60 mt-0.5">
                Nivel {result.stabilityLevel}
              </span>
              <div className="w-full bg-black/10 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={
                    'h-full rounded-full transition-all duration-700 ' +
                    (result.systemStabilityScore >= 75
                      ? 'bg-emerald-500'
                      : result.systemStabilityScore >= 45
                      ? 'bg-amber-500'
                      : 'bg-rose-500')
                  }
                  style={{ width: `${result.systemStabilityScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Navegación de Pestañas de Resultados */}
          <div className="flex border-b border-black/10 gap-2">
            <button
              onClick={() => setActiveTab('decisions')}
              className={
                'pb-2 px-3 text-sm font-semibold transition-all border-b-2 ' +
                (activeTab === 'decisions'
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink/50 hover:text-ink')
              }
            >
              Decisiones IoT &amp; Razonamiento ({result.iotDecisions.length})
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={
                'pb-2 px-3 text-sm font-semibold transition-all border-b-2 ' +
                (activeTab === 'questions'
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink/50 hover:text-ink')
              }
            >
              Reglas &amp; Diagnóstico por Parámetro
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={
                'pb-2 px-3 text-sm font-semibold transition-all border-b-2 ' +
                (activeTab === 'raw'
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink/50 hover:text-ink')
              }
            >
              Inspección JSON
            </button>
          </div>

          {/* Pestaña 1: Decisiones IoT */}
          {activeTab === 'decisions' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.iotDecisions.map((decision) => (
                  <div
                    key={decision.actuatorId}
                    className="p-5 rounded-2xl bg-white border border-black/10 shadow-sm space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm text-ink">
                        {decision.actuatorLabel}
                      </span>
                      <span
                        className={
                          'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ' +
                          (decision.proposedAction === 'on'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800')
                        }
                      >
                        {decision.proposedAction === 'on' ? 'ENCENDER' : 'APAGAR'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-ink/50 font-medium">Motivo: </span>
                        <span className="text-ink font-semibold">{decision.reason}</span>
                      </div>
                      <div>
                        <span className="text-ink/50 font-medium">Evidencia biológica: </span>
                        <span className="text-ink/80">{decision.biologicalEvidence}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[11px]">
                      <span className="text-ink/50 font-mono">
                        Urgencia: <span className="font-semibold uppercase text-ink">{decision.urgency}</span>
                      </span>
                      {decision.executed ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <Icon.Check className="w-3.5 h-3.5" />
                          <span>Ejecutado en IoT</span>
                        </span>
                      ) : (
                        <span className="text-ink/40 font-mono">Modo Simulado</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Justificación Científica y Ecosistémica Integral */}
              <div className="p-6 bg-neutral-50/80 rounded-2xl border border-black/5 space-y-3">
                <h4 className="font-display font-bold text-sm uppercase tracking-wider text-ink/70">
                  ¿Por qué TypeSafe AI tomó estas decisiones? (Fundamentos Biogeoquímicos)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-ink/80 leading-relaxed">
                  <div className="bg-white p-4 rounded-xl border border-black/5 space-y-1">
                    <span className="font-bold text-ink block">1. Fisicoquímica &amp; Resguardo de Equipos:</span>
                    <p>{result.explanations.iotDecisionRationale}</p>
                    <p className="text-ink/60 font-mono pt-1 text-[11px]">{result.explanations.waterChemistryAnalysis}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-black/5 space-y-1">
                    <span className="font-bold text-ink block">2. Fisiología de Biomasa (Peces &amp; Plantas):</span>
                    <p>{result.explanations.plantEcosystemStatus}</p>
                    <p className="pt-1">{result.explanations.fishWelfareStatus}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-black/5 space-y-1">
                    <span className="font-bold text-ink block">3. Coordinación &amp; Resiliencia Holística:</span>
                    <p>{result.explanations.holisticIntegrationAnalysis || 'El sistema coordina la protección simultánea de la microbiota del biofiltro y la biomasa cultivada.'}</p>
                    <p className="pt-1 text-ink/60">
                      Evaluado en {result.meta?.durationMs} ms mediante motor {result.meta?.engine} ({result.meta?.model}).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pestaña 2: Preguntas y Probabilidades TypeSafe */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Barra de Filtros por Categoría */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-neutral-100/70 rounded-xl border border-black/5">
                <span className="text-[11px] uppercase font-bold text-ink/50 px-2">
                  Filtrar por Parámetro:
                </span>
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ' +
                        (isActive
                          ? 'bg-ink text-white shadow-sm'
                          : 'bg-white text-ink/70 hover:bg-white/80 hover:text-ink border border-black/5')
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Grid de Preguntas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQuestions.map(([key, q]) => {
                  const badgeColor =
                    CATEGORY_COLORS[q.category] || 'bg-neutral-100 text-neutral-800 border-neutral-200';

                  return (
                    <div
                      key={key}
                      className="p-5 bg-white rounded-2xl border border-black/10 shadow-sm space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}
                              >
                                {q.category || 'Parámetro'}
                              </span>
                              <span className="text-[10px] font-mono text-ink/40">
                                {key}
                              </span>
                            </div>
                            <h4 className="font-display font-bold text-sm text-ink leading-snug">
                              {q.title}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-neutral-100 text-ink whitespace-nowrap">
                            {(q.confidence * 100).toFixed(0)}% conf
                          </span>
                        </div>

                        <div className="p-3 bg-neutral-50 rounded-xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-ink">
                            <Icon.StatusDot status="optimal" className="w-2 h-2" />
                            <span>Respuesta: {q.label || q.selected}</span>
                          </div>
                          <p className="text-ink/60 text-[11px] leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Distribución de Probabilidades para Choice */}
                      {q.probabilities &&
                        typeof q.probabilities === 'object' &&
                        !Array.isArray(q.probabilities) && (
                          <div className="space-y-1.5 pt-2 border-t border-black/5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-ink/40 block">
                              Distribución de Probabilidades TypeSafe:
                            </span>
                            {Object.entries(q.probabilities).map(([opt, prob]) => {
                              const isSelected = opt === q.selected;
                              const pct = (prob * 100).toFixed(1);
                              return (
                                <div key={opt} className="space-y-0.5">
                                  <div className="flex justify-between text-[11px]">
                                    <span
                                      className={
                                        isSelected
                                          ? 'font-bold text-ink flex items-center gap-1.5'
                                          : 'text-ink/60'
                                      }
                                    >
                                      {isSelected && <Icon.Check className="w-3 h-3 text-emerald-600 inline shrink-0" />}
                                      {opt.replace(/_/g, ' ')}
                                    </span>
                                    <span className="font-mono text-ink/70">{pct}%</span>
                                  </div>
                                  <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={
                                        'h-full rounded-full transition-all duration-500 ' +
                                        (isSelected ? 'bg-emerald-500' : 'bg-black/20')
                                      }
                                      style={{ width: `${Math.max(2, prob * 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      {/* Distribución de Probabilidades para Score (0 a 4) */}
                      {q.type === 'score' && Array.isArray(q.probabilities) && (
                        <div className="space-y-1.5 pt-2 border-t border-black/5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/40 block">
                            Distribución de Score (0 a 4):
                          </span>
                          <div className="grid grid-cols-5 gap-1.5 text-center">
                            {q.probabilities.map((prob, idx) => {
                              const isTarget = Math.round(Number(q.selected)) === idx;
                              return (
                                <div
                                  key={idx}
                                  className={
                                    'p-1.5 rounded-lg border text-[10px] ' +
                                    (isTarget
                                      ? 'bg-purple-50 border-purple-300 font-bold text-purple-900'
                                      : 'bg-neutral-50 border-black/5 text-ink/60')
                                  }
                                >
                                  <div>Nivel {idx}</div>
                                  <div className="font-mono mt-0.5">{(prob * 100).toFixed(0)}%</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pestaña 3: Raw JSON */}
          {activeTab === 'raw' && (
            <div className="bg-neutral-900 text-neutral-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto max-h-[500px]">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Historial de la Sesión */}
      {history.length > 0 && (
        <div data-anim="card" className="space-y-3 pt-4 border-t border-black/5">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-ink/60">
            Historial Reciente de Evaluaciones ({history.length})
          </h3>
          <div className="space-y-2">
            {history.slice(0, 5).map((h, i) => (
              <div
                key={h.id || i}
                onClick={() => {
                  setResult(h);
                  setParams({ ...h.params });
                }}
                className="flex items-center justify-between p-3.5 bg-white hover:bg-neutral-50 rounded-xl border border-black/5 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 text-xs">
                  <span className="shrink-0">
                    {h.status === 'optimal' ? (
                      <Icon.CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : h.status === 'warning' ? (
                      <Icon.AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Icon.AlertOctagon className="w-4 h-4 text-rose-600" />
                    )}
                  </span>
                  <div>
                    <span className="font-semibold text-ink block">{h.statusLabel}</span>
                    <span className="text-[11px] text-ink/50 font-mono">
                      pH: {h.params.ph.toFixed(1)} | OD: {h.params.oxigenoDisuelto.toFixed(1)} | Temp: {h.params.temperaturaAgua.toFixed(1)}°C | Nivel: {((h.params.nivelAgua / 100) * 32).toFixed(1)} cm ({h.params.nivelAgua.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="font-mono font-bold text-ink">
                    {h.systemStabilityScore}%
                  </span>
                  <span className="text-[10px] text-ink/40 block font-mono">
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
