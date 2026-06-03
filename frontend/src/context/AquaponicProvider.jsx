import { useCallback, useMemo, useState } from 'react';
import { apiConfig, MQTT_TOPICS } from '../config/api';
import { DEFAULT_STATE, SYSTEM_STATUS_MAP } from '../data/defaults';
import { mergeState, normalizePayload } from '../data/normalizer';
import { useMqtt } from '../hooks/useMqtt';
import { useWebSocket } from '../hooks/useWebSocket';
import { AquaponicContext } from './AquaponicContext';

export function AquaponicProvider({ children }) {
  const [state, setState] = useState(() => ({
    ...DEFAULT_STATE,
    fish: { ...DEFAULT_STATE.fish, cameraUrl: apiConfig.cameras.fish },
    plants: { ...DEFAULT_STATE.plants, cameraUrl: apiConfig.cameras.plants },
  }));

  const ingestMessage = useCallback((raw, source) => {
    const patch = normalizePayload(raw);
    if (!patch) return;

    setState((prev) => {
      const merged = mergeState(prev, patch);
      return {
        ...merged,
        connection: {
          ...prev.connection,
          [source]: {
            ...prev.connection[source],
            lastMessageAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const handleWsStatus = useCallback((next) => {
    setState((prev) => ({
      ...prev,
      connection: { ...prev.connection, websocket: { ...prev.connection.websocket, ...next } },
    }));
  }, []);

  const handleMqttStatus = useCallback((next) => {
    setState((prev) => ({
      ...prev,
      connection: { ...prev.connection, mqtt: { ...prev.connection.mqtt, ...next } },
    }));
  }, []);

  const ws = useWebSocket({
    url: apiConfig.websocket.url,
    enabled: apiConfig.websocket.enabled,
    reconnectMs: apiConfig.websocket.reconnectMs,
    onMessage: ingestMessage,
    onStatusChange: handleWsStatus,
  });

  const mqtt = useMqtt({
    url: apiConfig.mqtt.url,
    enabled: apiConfig.mqtt.enabled,
    clientId: apiConfig.mqtt.clientId,
    username: apiConfig.mqtt.username,
    password: apiConfig.mqtt.password,
    topics: MQTT_TOPICS,
    reconnectMs: apiConfig.mqtt.reconnectMs,
    onMessage: ingestMessage,
    onStatusChange: handleMqttStatus,
  });

  const isLive =
    state.connection.websocket.connected || state.connection.mqtt.connected;

  const systemMeta =
    SYSTEM_STATUS_MAP[state.system.status] ?? SYSTEM_STATUS_MAP.stable;

  const value = useMemo(
    () => ({
      state,
      isLive,
      systemMeta,
      ws,
      mqtt,
      ingestMessage,
    }),
    [state, isLive, systemMeta, ws, mqtt, ingestMessage]
  );

  return (
    <AquaponicContext.Provider value={value}>{children}</AquaponicContext.Provider>
  );
}
