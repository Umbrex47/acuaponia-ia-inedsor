import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function NotificationCenter() {
  const { notifications, unread, markAllRead, clear, dismiss, styles, categoryEmoji } = useNotifications();
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) markAllRead();
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={
          'relative inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ' +
          (unread > 0
            ? 'border-accent-amber/50 bg-accent-amber/10 text-accent-amber'
            : 'border-black/10 bg-white text-ink/70 hover:text-ink')
        }
        aria-label={`Notificaciones (${unread} sin leer)`}
        title="Notificaciones en tiempo real"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-red text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-white rounded-2xl border border-black/10 shadow-xl z-40">
            <div className="sticky top-0 bg-white border-b border-black/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink text-sm">Notificaciones</p>
                <p className="text-xs text-ink/50">{notifications.length} en cola</p>
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs text-ink/50 hover:text-ink"
                >
                  Limpiar
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-ink/50">
                Sin notificaciones. El backend avisará aquí cuando algo cambie.
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {notifications.map((n) => {
                  const s = styles[n.severity] ?? styles.info;
                  const catEmoji = categoryEmoji?.[n.category];
                  return (
                    <li
                      key={n.id}
                      className={`px-4 py-3 ${s.bg} border-l-4 ${s.border.replace('border-', 'border-l-')}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-base leading-none mt-0.5">
                          {catEmoji ?? s.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${s.text} truncate`}>{n.title}</p>
                          <p className="text-xs text-ink/70 mt-0.5 break-words">{n.message}</p>
                          <p className="text-[10px] text-ink/40 mt-1 uppercase tracking-wide">
                            {n.category} · {n.source} · {timeAgo(n.ts)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismiss(n.id)}
                          className="text-ink/40 hover:text-ink text-xs"
                          aria-label="Descartar"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}