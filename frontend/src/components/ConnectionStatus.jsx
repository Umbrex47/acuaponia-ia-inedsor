import { useAquaponic } from '../context/useAquaponic';

export default function ConnectionStatus() {
  const { isLive, state } = useAquaponic();
  const { websocket, mqtt } = state.connection;

  return (
    <div className="hidden sm:flex items-center gap-2 text-xs justify-self-end">
      <span
        className={
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ' +
          (websocket.connected
            ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
            : 'border-black/10 bg-white text-ink/50')
        }
        title={websocket.error || 'WebSocket'}
      >
        <span
          className={
            'w-1.5 h-1.5 rounded-full ' +
            (websocket.connected ? 'bg-accent-green animate-pulse' : 'bg-neutral-300')
          }
        />
        WS
      </span>
      <span
        className={
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ' +
          (mqtt.connected
            ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
            : 'border-black/10 bg-white text-ink/50')
        }
        title={mqtt.error || 'MQTT'}
      >
        <span
          className={
            'w-1.5 h-1.5 rounded-full ' +
            (mqtt.connected ? 'bg-accent-green animate-pulse' : 'bg-neutral-300')
          }
        />
        MQTT
      </span>
      {isLive && (
        <span className="text-accent-green font-medium">Datos en vivo</span>
      )}
    </div>
  );
}
