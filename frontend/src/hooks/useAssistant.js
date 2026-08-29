import { useCallback, useEffect, useRef, useState } from 'react';
import { apiConfig } from '../config/api';

export const CLIENT_ID_STORAGE_KEY = 'aquaponic-client-id';

export function getOrCreateClientId() {
  if (typeof window === 'undefined') return 'server';
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (stored) return stored;
    const id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return `client-${Date.now()}`;
  }
}

export function useAssistant() {
  const [status, setStatus] = useState({ connected: false, error: null });
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const wsRef = useRef(null);
  const clientIdRef = useRef(getOrCreateClientId());

  const appendMessage = useCallback((role, content, extra = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, content, ts: new Date().toISOString(), ...extra },
    ]);
  }, []);

  const connect = useCallback(() => {
    if (!apiConfig.assistant.enabled || !apiConfig.assistant.url) return;
    const ws = new WebSocket(apiConfig.assistant.url);
    wsRef.current = ws;
    ws.onopen = () => setStatus({ connected: true, error: null });
    ws.onerror = () => setStatus({ connected: false, error: 'Error de conexión' });
    ws.onclose = () => {
      setStatus({ connected: false, error: 'Desconectado' });
      setTimeout(connect, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'reply') {
          setPending(false);
          if (data.reply) {
            appendMessage('assistant', data.reply, { toolCalls: data.toolCalls });
          } else {
            // Respuesta vacía: sin esto el chat se quedaba en blanco.
            appendMessage('system', 'El asistente respondió sin contenido. Revisa los logs del backend.');
          }
        } else if (data.type === 'error') {
          setPending(false);
          appendMessage('system', `Error: ${data.reason || 'desconocido'}`);
        } else if (data.type === 'welcome') {
          appendMessage('system', 'Asistente conectado. ¿En qué puedo ayudar?');
        }
      } catch (err) {
        console.warn('[assistant] mensaje no JSON', err);
      }
    };
  }, [appendMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    appendMessage('user', trimmed);
    setPending(true);
    wsRef.current.send(JSON.stringify({ type: 'chat', clientId: clientIdRef.current, message: trimmed }));
  }, [appendMessage]);

  const reset = useCallback(() => {
    setMessages([]);
    appendMessage('system', 'Nueva conversación.');
  }, [appendMessage]);

  return { status, messages, pending, send, reset, clientId: clientIdRef.current };
}
