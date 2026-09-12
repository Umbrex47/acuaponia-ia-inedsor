import { useProposals } from '../hooks/useProposals';

const ACTUATOR_LABELS = {
  bomba_agua: 'Bomba de agua',
  aireador: 'Aireador',
  dispensador_comida: 'Dispensador',
};

export default function ProposalPanel({ collapsed, onToggle }) {
  const { proposals, resolve } = useProposals();
  const pending = proposals.filter((p) => p.status === 'pending');

  return (
    <aside
      className={
        'flex flex-col bg-white border border-black/10 rounded-xl overflow-hidden transition-all ' +
        (collapsed ? 'w-12' : 'w-full lg:w-96')
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-paper text-left"
      >
        <span className="font-display font-semibold text-sm">
          {collapsed ? '📋' : `Propuestas IA (${pending.length})`}
        </span>
        {!collapsed && <span className="text-xs text-ink/50">{collapsed ? '▶' : '◀'}</span>}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '480px' }}>
          {pending.length === 0 && (
            <div className="text-xs text-ink/50 italic text-center py-6">
              No hay propuestas pendientes.
            </div>
          )}
          {pending.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolve={resolve} />
          ))}
        </div>
      )}
    </aside>
  );
}

function ProposalCard({ proposal, onResolve }) {
  const label = ACTUATOR_LABELS[proposal.actuatorId] || proposal.actuatorId;
  const isEmergency = proposal.source === 'emergency';
  return (
    <div
      className={
        'rounded-lg border p-3 text-sm ' +
        (isEmergency
          ? 'border-accent-red/30 bg-accent-red/5'
          : 'border-accent-blue/30 bg-accent-blue/5')
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-display font-semibold text-ink">
          {label} → {proposal.action}
        </span>
        <span
          className={
            'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ' +
            (isEmergency
              ? 'bg-accent-red/15 text-accent-red'
              : 'bg-accent-blue/15 text-accent-blue')
          }
        >
          {isEmergency ? 'emergencia' : proposal.source}
        </span>
      </div>
      <p className="text-xs text-ink/70 mb-3">{proposal.reason}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onResolve(proposal.id, 'approved')}
          className="flex-1 px-3 py-1.5 rounded-md bg-accent-green text-white text-xs font-semibold hover:bg-accent-green/90"
        >
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => onResolve(proposal.id, 'rejected')}
          className="flex-1 px-3 py-1.5 rounded-md bg-white border border-black/15 text-ink text-xs font-semibold hover:bg-ink/5"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
