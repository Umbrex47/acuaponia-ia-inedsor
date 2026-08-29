import { useEffect, useRef, useState } from 'react';

export function useWebSocket({ url, enabled, reconnectMs = 3000, onMessage, onStatusChange }) {
  const [status, setStatus] = useState({ connected: false, error: null });
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const mountedRef = useRef(true);
  // Listeners adicionales (p.ej. NotificationCenter) que reciben TODO el tráfico
  // sin tener que duplicar la conexión WS.
  const extraListenersRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Suscribe un callback que recibe cada mensaje crudo del WS. Devuelve cleanup. */
  function addExtraListener(cb) {
    extraListenersRef.current.add(cb);
    return () => extraListenersRef.current.delete(cb);
  }

  useEffect(() => {
    if (!enabled || !url) {
      setStatus({ connected: false, error: null });
      onStatusChange?.({ connected: false, error: null });
      return undefined;
    }

    const connect = () => {
      if (!mountedRef.current) return;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          const next = { connected: true, error: null };
          setStatus(next);
          onStatusChange?.(next);
        };

        ws.onmessage = (event) => {
          onMessage?.(event.data, 'websocket');
          // Reenviar a listeners secundarios (NotificationCenter, etc.).
          extraListenersRef.current.forEach((cb) => {
            try {
              cb(event.data);
            } catch (err) {
              console.warn('[ws] extra listener error', err);
            }
          });
        };

        ws.onerror = () => {
          if (!mountedRef.current) return;
          const next = { connected: false, error: 'Error de conexión WebSocket' };
          setStatus(next);
          onStatusChange?.(next);
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          const next = { connected: false, error: 'Desconectado' };
          setStatus(next);
          onStatusChange?.(next);
          retryRef.current = window.setTimeout(connect, reconnectMs);
        };
      } catch (err) {
        const next = {
          connected: false,
          error: err.message || 'No se pudo abrir WebSocket',
        };
        setStatus(next);
        onStatusChange?.(next);
        retryRef.current = window.setTimeout(connect, reconnectMs);
      }
    };

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, enabled, reconnectMs, onMessage, onStatusChange]);

  const send = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    }
    return false;
  };

  return { ...status, send, addExtraListener };
}
