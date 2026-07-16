import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import SensorGauge from '../components/SensorGauge';
import DualCameraView from '../components/DualCameraView';
import { Icon } from '../components/Icon';
import { useAquaponic } from '../context/useAquaponic';
import {
  SENSOR_META,
  SENSOR_ORDER,
  ESSENTIAL_SENSORS,
  getSensorRisk,
} from '../data/defaults';

export default function Dashboard({ navigate }) {
  const containerRef = useRef(null);
  const { state, systemMeta, isLive } = useAquaponic();
  const { sensors, fish, plants, system } = state;
  const [showAll, setShowAll] = useState(false);

  // Sensores esenciales primero; el resto se revela con "Ver más".
  const essentialKeys = SENSOR_ORDER.filter((key) =>
    ESSENTIAL_SENSORS.includes(key)
  );
  const extraKeys = SENSOR_ORDER.filter(
    (key) => !ESSENTIAL_SENSORS.includes(key)
  );
  const visibleKeys = showAll ? [...essentialKeys, ...extraKeys] : essentialKeys;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="title"]', {
        y: -20,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      });
      gsap.from('[data-anim="status"]', {
        scale: 0.9,
        opacity: 0,
        duration: 0.6,
        ease: 'back.out(1.6)',
        delay: 0.2,
      });
      gsap.from('[data-anim="cam"]', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.5,
      });
      gsap.from('[data-anim="btn"]', {
        opacity: 0,
        y: 12,
        duration: 0.5,
        ease: 'power2.out',
        delay: 0.75,
        stagger: 0.08,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef}>
      <div className="flex flex-col items-center">
        <h1
          data-anim="title"
          className="font-display font-bold text-3xl sm:text-4xl tracking-tight border-2 border-ink px-8 py-3 rounded-md text-center"
        >
          AquaGia OS
        </h1>
        <div
          data-anim="status"
          className="mt-5 border-2 border-ink rounded-md px-6 py-2 font-display font-semibold text-lg"
        >
          Estado:{' '}
          <span className={systemMeta.color}>
            {system.statusLabel || systemMeta.label}
          </span>
          {isLive && (
            <span className="ml-3 text-xs font-normal text-accent-green align-middle">
              · en vivo
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 justify-items-center">
        {visibleKeys.map((key, i) => {
          const reading = sensors[key];
          return (
            <SensorGauge
              key={key}
              sensorKey={key}
              reading={reading}
              label={SENSOR_META[key].label}
              delay={0.3 + i * 0.08}
              status={reading ? getSensorRisk(key, reading.value) : null}
              inactive={!reading}
            />
          );
        })}
      </div>

      {extraKeys.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="btn-outline text-sm"
            aria-expanded={showAll}
          >
            {showAll ? 'Ver menos' : `Ver más (${extraKeys.length})`}
            <Icon.Chevron
              className={
                'w-4 h-4 transition-transform ' + (showAll ? 'rotate-180' : '')
              }
            />
          </button>
        </div>
      )}

      <div data-anim="cam" className="mt-10 max-w-5xl mx-auto">
        <DualCameraView fish={fish} plants={plants} />
      </div>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
        <button data-anim="btn" onClick={() => navigate('sensors')} className="btn-outline text-sm">
          <Icon.Sensors className="w-4 h-4" />
          Sensores
        </button>
        <button data-anim="btn" onClick={() => navigate('plants')} className="btn-outline text-sm">
          <Icon.Leaf className="w-4 h-4" />
          Plantas
        </button>
        <button data-anim="btn" onClick={() => navigate('fish')} className="btn-outline text-sm">
          <Icon.Fish className="w-4 h-4" />
          Peces
        </button>
        <button data-anim="btn" onClick={() => navigate('parameters')} className="btn-outline text-sm">
          Parámetros
        </button>
      </div>
    </div>
  );
}
