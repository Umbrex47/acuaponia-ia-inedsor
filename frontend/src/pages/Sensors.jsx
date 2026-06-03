import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Icon } from '../components/Icon';
import SensorModal from '../components/SensorModal';
import { useAquaponic } from '../context/useAquaponic';
import {
  getSensorInfo,
  getTotalConsumption,
  SENSORS_INFO,
} from '../data/sensorsInfo';

const DEVICE_ICONS = {
  termometro: Icon.Thermo,
  ph: Icon.pH,
  oxigeno: Icon.O2,
  nivel: Icon.Drop,
  electroconductividad: Icon.pH,
  turbidez: Icon.Turbidity,
  bme280: Icon.Cloud,
  cam1: Icon.Camera,
  cam2: Icon.Camera,
};

// Estado del sensor (ok/warn/critical) → estado visual del dispositivo.
function sensorToDeviceStatus(status) {
  if (status === 'critical') return 'err';
  if (status === 'warn') return 'warn';
  return 'ok';
}

function formatLastUpdate(iso) {
  if (!iso) return 'Esperando datos…';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace unos segundos';
  if (mins === 1) return 'Hace 1 minuto';
  return `Hace ${mins} minutos`;
}

export default function Sensors() {
  const ref = useRef(null);
  const { state, isLive } = useAquaponic();
  const { sensors, system, connection } = state;
  const lastAt = connection.mqtt.lastMessageAt || connection.websocket.lastMessageAt;
  const [selectedId, setSelectedId] = useState(null);

  // Todos los sensores de hardware; marcamos cuáles están reportando datos.
  const allDevices = Object.values(SENSORS_INFO)
    .filter((info) => info.sensorKey)
    .map((info) => {
      const reading = sensors[info.sensorKey];
      return {
        id: info.id,
        name: info.name,
        active: Boolean(reading),
        status: reading ? sensorToDeviceStatus(reading.status) : 'off',
      };
    });

  // El consumo total solo considera los dispositivos activos.
  const totals = getTotalConsumption(
    allDevices.filter((d) => d.active).map((d) => d.id)
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="esp32"]', {
        scale: 0.85,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.5)',
      });
      gsap.from('[data-anim="dev-title"]', {
        y: -10,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.2,
      });
      gsap.from('[data-anim="device"]', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
        delay: 0.4,
        stagger: 0.08,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const selectedSensor = selectedId ? getSensorInfo(selectedId) : null;
  const selectedDevice = selectedId
    ? allDevices.find((d) => d.id === selectedId)
    : null;
  const selectedReading =
    selectedSensor?.sensorKey && sensors[selectedSensor.sensorKey]
      ? sensors[selectedSensor.sensorKey]
      : null;

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
      <div data-anim="esp32" className="lg:col-span-2 flex flex-col items-center">
        <div className="relative w-56 h-56 rounded-full border-2 border-ink flex items-center justify-center bg-white">
          <Icon.Chip className="w-32 h-32 text-ink" />
          <div
            className={
              'absolute -top-2 -right-2 w-12 h-12 rounded-full flex items-center justify-center text-white border-4 border-white ' +
              (isLive ? 'bg-accent-green' : 'bg-neutral-400')
            }
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <polyline
                points="20 6 9 17 4 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="font-display font-bold text-xl mt-4">ESP32</div>
        <div className={'status-pill mt-3 ' + (isLive ? 'animate-pulse-soft' : 'opacity-70')}>
          {isLive ? 'Recibiendo datos' : 'Sin conexión'}
        </div>
        <div className="mt-5 text-center">
          <div className="font-display font-bold text-lg">Última recepción</div>
          <div className="text-ink/70">{formatLastUpdate(lastAt || system.lastUpdate)}</div>
        </div>

        <div className="mt-6 w-full max-w-xs rounded-xl border border-black/10 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-ink/50 font-semibold mb-2">
            Consumo total estimado
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display font-bold text-xl">
              {totals.totalMa.toFixed(0)} mA
            </span>
            <span className="text-ink/60 text-sm">
              {(totals.totalW * 1000).toFixed(0)} mW
            </span>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <h2
          data-anim="dev-title"
          className="font-display font-bold text-3xl text-center mb-2"
        >
          Dispositivos activos
        </h2>
        <p className="text-center text-sm text-ink/60 mb-8">
          Toca cualquier sensor para ver su ficha técnica completa
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-8 gap-x-4 justify-items-center">
          {allDevices.map((d) => {
            const IconComp = DEVICE_ICONS[d.id] || Icon.Sensors;
            const hasInfo = Boolean(getSensorInfo(d.id));
            return (
              <button
                data-anim="device"
                key={d.id ?? d.name}
                type="button"
                disabled={!hasInfo}
                onClick={() => hasInfo && setSelectedId(d.id)}
                className={
                  'flex flex-col items-center text-center group ' +
                  (hasInfo
                    ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue rounded-2xl p-2'
                    : 'cursor-default') +
                  (d.active ? '' : ' opacity-50')
                }
                aria-label={`Ver detalles de ${d.name}`}
              >
                <div className="device-circle group-hover:scale-105 group-hover:shadow-lg transition-transform">
                  <span className={d.active ? 'text-ink' : 'text-ink/40'}>
                    <IconComp
                      className={
                        'w-9 h-9 ' +
                        (d.active && d.id === 'oxigeno' ? 'text-accent-green' : '')
                      }
                    />
                  </span>
                  <span
                    className={
                      'badge ' +
                      (d.status === 'ok'
                        ? 'badge-ok'
                        : d.status === 'warn'
                        ? 'badge-warn'
                        : d.status === 'off'
                        ? 'badge-off'
                        : 'badge-err')
                    }
                  >
                    {d.status === 'off' ? (
                      <Icon.Dash className="w-4 h-4" />
                    ) : d.status === 'ok' ? (
                      <Icon.Check className="w-4 h-4" />
                    ) : (
                      <Icon.Alert className="w-4 h-4" />
                    )}
                  </span>
                </div>
                <div className="mt-3 font-display font-semibold text-sm sm:text-base">
                  {d.name}
                </div>
                <div
                  className={
                    'text-[11px] transition-colors ' +
                    (d.active
                      ? 'text-ink/45 group-hover:text-accent-blue'
                      : 'text-ink/40')
                  }
                >
                  {d.active ? 'Ver ficha' : 'No disponible'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedSensor && (
        <SensorModal
          sensor={selectedSensor}
          deviceStatus={selectedDevice?.status ?? 'ok'}
          sensorReading={selectedReading}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
