import { Icon } from './Icon';

export default function Window({ children, onBack, onForward, onClose, onRefresh }) {
  return (
    <div className="window-card w-full max-w-6xl mx-auto">
      <div className="window-header">
        <div className="flex items-center gap-1">
          <button className="nav-pill" onClick={onBack} aria-label="Atrás">
            <Icon.Arrow dir="left" />
          </button>
          <button className="nav-pill" onClick={onForward} aria-label="Adelante">
            <Icon.Arrow dir="right" />
          </button>
          <button className="nav-pill" onClick={onRefresh} aria-label="Refrescar">
            <Icon.Refresh />
          </button>
        </div>
        <div className="text-xs uppercase tracking-widest text-white/70 font-medium hidden sm:block">
          Sistema Acuapónico
        </div>
        <button className="nav-pill" onClick={onClose} aria-label="Cerrar">
          <Icon.Close />
        </button>
      </div>
      <div className="p-6 sm:p-10">{children}</div>
    </div>
  );
}
