const ACTUATOR_META = {
  bomba_agua: { label: 'Bomba de agua', icon: 'Pump', accent: 'text-accent-blue' },
  aireador: { label: 'Aireador', icon: 'Wind', accent: 'text-accent-green' },
  dispensador_comida: { label: 'Dispensador', icon: 'Bowl', accent: 'text-accent-amber' },
};

const MODE_META = {
  ia: { label: 'IA', color: 'bg-accent-blue/15 text-accent-blue border-accent-blue/30' },
  manual: { label: 'Manual', color: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30' },
  auto: { label: 'Auto', color: 'bg-accent-green/15 text-accent-green border-accent-green/30' },
};

const ACTUATOR_ICONS = {
  Pump: () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  Wind: () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h12a3 3 0 1 0-3-3" />
      <path d="M3 18h17a3 3 0 1 1-3 3" />
      <path d="M3 6h9" />
    </svg>
  ),
  Bowl: () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" />
      <path d="M5 12c0 4 3 7 7 7s7-3 7-7" />
    </svg>
  ),
};

export default function ActuatorCard({ actuator, onExecute, onModeChange, onLock, onUnlock, clientId }) {
  const meta = ACTUATOR_META[actuator.id] || { label: actuator.label, icon: 'Wind', accent: 'text-ink' };
  const IconComp = ACTUATOR_ICONS[meta.icon] || ACTUATOR_ICONS.Wind;
  const modeMeta = MODE_META[actuator.mode] || MODE_META.manual;
  const isMine = actuator.lock?.clientId === clientId;
  const lockedByOther = actuator.lock && !isMine;

  const toggle = () => {
    void onExecute(actuator.id, actuator.on ? 'off' : 'on', 'manual desde panel');
  };

  const dispense = () => {
    void onExecute(actuator.id, 'dispense', 'dispensar manual desde panel');
  };

  const isFeeder = actuator.kind === 'feeder' || actuator.id === 'dispensador_comida';

  return (
    <div
      data-anim="actuator-card"
      className={
        'rounded-xl border bg-white p-4 transition-shadow ' +
        (lockedByOther ? 'border-amber-300 opacity-80' : 'border-black/10 hover:shadow-md')
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div className={'flex items-center gap-3 ' + meta.accent}>
          <IconComp />
          <div>
            <div className="font-display font-semibold text-base text-ink">{meta.label}</div>
            <div className="text-[11px] uppercase tracking-wider text-ink/50 font-medium">
              {actuator.on ? 'Encendido' : 'Apagado'}
            </div>
          </div>
        </div>
        <span className={'text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ' + modeMeta.color}>
          {modeMeta.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {isFeeder ? (
          <button
            type="button"
            onClick={dispense}
            disabled={lockedByOther}
            className={
              'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md font-semibold text-sm transition-colors ' +
              (actuator.on
                ? 'bg-accent-amber text-white hover:bg-accent-amber/90'
                : 'bg-ink/10 text-ink hover:bg-ink/20') +
              (lockedByOther ? ' opacity-50 cursor-not-allowed' : '')
            }
          >
            {actuator.on ? 'Dispensando…' : 'Dispensar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={lockedByOther}
            className={
              'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md font-semibold text-sm transition-colors ' +
              (actuator.on
                ? 'bg-accent-green text-white hover:bg-accent-green/90'
                : 'bg-ink/10 text-ink hover:bg-ink/20') +
              (lockedByOther ? ' opacity-50 cursor-not-allowed' : '')
            }
          >
            {actuator.on ? 'Apagar' : 'Encender'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 mb-3">
        {(['ia', 'manual', 'auto']).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(actuator.id, m)}
            className={
              'text-[11px] py-1 rounded-md font-semibold border transition-colors ' +
              (actuator.mode === m
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink/70 border-black/10 hover:border-ink/30')
            }
          >
            {MODE_META[m].label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-ink/50 flex items-center justify-between gap-2">
        <span>
          {actuator.lastReason
            ? `Último: ${actuator.lastReason} (${actuator.lastActor || 'user'})`
            : 'Sin acciones registradas'}
        </span>
        {lockedByOther && (
          <span className="text-accent-amber font-semibold">Ocupado</span>
        )}
      </div>
    </div>
  );
}
