import { useCallback, useEffect, useRef, useState } from 'react';
import { apiConfig } from '../config/api';

function authHeaders() {
  return apiConfig.assistant.apiKey
    ? { Authorization: `Bearer ${apiConfig.assistant.apiKey}` }
    : {};
}

export function useActuators() {
  const [actuators, setActuators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/actuators`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActuators(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAll]);

  const execute = useCallback(async (id, action, reason = '') => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/actuators/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action, reason, actor: 'user' }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        return { ok: false, reason: data.reason || `HTTP ${res.status}` };
      }
      await fetchAll();
      return { ok: true, status: data.status };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }, [fetchAll]);

  const setMode = useCallback(async (id, mode) => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/actuators/${id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) return { ok: false, reason: data.reason };
      await fetchAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }, [fetchAll]);

  const acquireLock = useCallback(async (id, clientId) => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/actuators/${id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ clientId }),
      });
      await fetchAll();
      return res.ok;
    } catch {
      return false;
    }
  }, [fetchAll]);

  const releaseLock = useCallback(async (id, clientId) => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/actuators/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ clientId }),
      });
      await fetchAll();
      return res.ok;
    } catch {
      return false;
    }
  }, [fetchAll]);

  return { actuators, loading, error, refresh: fetchAll, execute, setMode, acquireLock, releaseLock };
}
