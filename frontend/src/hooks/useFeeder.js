import { useCallback, useEffect, useState } from 'react';
import { apiConfig } from '../config/api';

function authHeaders() {
  return apiConfig.assistant.apiKey
    ? { Authorization: `Bearer ${apiConfig.assistant.apiKey}` }
    : {};
}

export function useFeeder() {
  const [config, setConfig] = useState({ enabled: true, times: [], durationMs: 0, portionG: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/feeder/schedule`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = useCallback(async (next) => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/feeder/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) return { ok: false, reason: data.reason || `HTTP ${res.status}` };
      setConfig(data.config);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }, []);

  const dispense = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/feeder/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      return res.ok && data.ok !== false ? { ok: true } : { ok: false, reason: data.reason };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }, []);

  return { config, loading, error, refresh: fetchConfig, save, dispense };
}
