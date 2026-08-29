import { useCallback, useEffect, useRef, useState } from 'react';
import { apiConfig } from '../config/api';

function authHeaders() {
  return apiConfig.assistant.apiKey
    ? { Authorization: `Bearer ${apiConfig.assistant.apiKey}` }
    : {};
}

const POLL_MS = 10_000;

export function useAiReport() {
  const [status, setStatus] = useState({
    enabled: true,
    escalationMs: 60_000,
    maxParallel: 3,
    pending: [],
    stats: { total: 0, last24h: 0 },
  });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/decision/flow`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/decision/flow/logs?limit=20`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setError(err.message || 'Error desconocido');
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchLogs()]);
  }, [fetchStatus, fetchLogs]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const clearLogs = useCallback(async () => {
    try {
      await fetch(`${apiConfig.api.baseUrl}/decision/flow/logs`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setLogs([]);
    } catch (err) {
      setError(err.message || 'No se pudo limpiar');
    }
  }, []);

  const cancelPending = useCallback(async (sensor) => {
    try {
      await fetch(`${apiConfig.api.baseUrl}/decision/flow/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sensor }),
      });
      await refresh();
    } catch (err) {
      setError(err.message || 'No se pudo cancelar');
    }
  }, [refresh]);

  return {
    status,
    logs,
    error,
    loading,
    refresh,
    clearLogs,
    cancelPending,
  };
}
