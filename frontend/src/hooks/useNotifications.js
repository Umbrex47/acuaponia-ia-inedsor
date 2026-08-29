import { useCallback, useEffect, useRef, useState } from 'react';
import { useAquaponic } from '../context/useAquaponic';

const SEVERITY_STYLES = {
  info: { bg: 'bg-accent-blue/10', border: 'border-accent-blue/30', text: 'text-accent-blue', emoji: 'ℹ️' },
  warn: { bg: 'bg-accent-amber/10', border: 'border-accent-amber/30', text: 'text-accent-amber', emoji: '⚠️' },
  critical: { bg: 'bg-accent-red/10', border: 'border-accent-red/30', text: 'text-accent-red', emoji: '🔴' },
  success: { bg: 'bg-accent-green/10', border: 'border-accent-green/30', text: 'text-accent-green', emoji: '✅' },
};

const CATEGORY_EMOJI = {
  'early-warning-active': '🟡',
  'ia-decision': '⚙️',
  'ia-recovery': '🟢',
  'ia-report': '📑',
};

const MAX_NOTIFICATIONS = 50;

/**
 * Hook que escucha mensajes `{ type: 'notification' }` en el WebSocket del
 * backend y los expone como lista, contador de no-leídos y helpers.
 *
 * Reutiliza la conexión WS ya abierta por el `AquaponicProvider` mediante
 * `ws.addExtraListener`, así no abre un socket nuevo.
 */
export function useNotifications() {
  const { ws } = useAquaponic();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const seenIds = useRef(new Set());

  const handleMessage = useCallback((raw) => {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || data.type !== 'notification' || !data.payload) return;
      const record = data.payload;
      if (seenIds.current.has(record.id)) return;
      seenIds.current.add(record.id);

      setNotifications((prev) => {
        const next = [record, ...prev];
        return next.slice(0, MAX_NOTIFICATIONS);
      });
      setUnread((prev) => prev + 1);
    } catch (err) {
      // No es JSON o no es notificación; lo ignoramos.
    }
  }, []);

  useEffect(() => {
    if (!ws?.addExtraListener) return undefined;
    const unsubscribe = ws.addExtraListener(handleMessage);
    return unsubscribe;
  }, [ws, handleMessage]);

  const markAllRead = useCallback(() => setUnread(0), []);
  const clear = useCallback(() => {
    setNotifications([]);
    setUnread(0);
    seenIds.current.clear();
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications,
    unread,
    markAllRead,
    clear,
    dismiss,
    styles: SEVERITY_STYLES,
    categoryEmoji: CATEGORY_EMOJI,
  };
}