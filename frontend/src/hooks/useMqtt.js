import { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';

export function useMqtt({
  url,
  enabled,
  clientId,
  username,
  password,
  topics = [],
  reconnectMs = 3000,
  onMessage,
  onStatusChange,
}) {
  const [status, setStatus] = useState({ connected: false, error: null });
  const clientRef = useRef(null);

  useEffect(() => {
    if (!enabled || !url) {
      setStatus({ connected: false, error: null });
      onStatusChange?.({ connected: false, error: null });
      return undefined;
    }

    const options = {
      clientId,
      clean: true,
      reconnectPeriod: reconnectMs,
      connectTimeout: 10000,
    };

    if (username) options.username = username;
    if (password) options.password = password;

    const client = mqtt.connect(url, options);
    clientRef.current = client;

    client.on('connect', () => {
      const next = { connected: true, error: null };
      setStatus(next);
      onStatusChange?.(next);

      topics.forEach((topic) => {
        client.subscribe(topic, (err) => {
          if (err) {
            console.warn(`[MQTT] No se pudo suscribir a ${topic}:`, err.message);
          }
        });
      });
    });

    client.on('message', (topic, payload) => {
      const text = payload.toString();
      onMessage?.(text, 'mqtt', topic);
    });

    client.on('error', (err) => {
      const next = { connected: false, error: err.message };
      setStatus(next);
      onStatusChange?.(next);
    });

    client.on('offline', () => {
      const next = { connected: false, error: 'Broker offline' };
      setStatus(next);
      onStatusChange?.(next);
    });

    client.on('reconnect', () => {
      const next = { connected: false, error: 'Reconectando…' };
      setStatus(next);
      onStatusChange?.(next);
    });

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, [
    url,
    enabled,
    clientId,
    username,
    password,
    reconnectMs,
    onMessage,
    onStatusChange,
    topics.join('|'),
  ]);

  const publish = (topic, payload) => {
    if (!clientRef.current?.connected) return false;
    clientRef.current.publish(
      topic,
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );
    return true;
  };

  return { ...status, publish };
}
