import { useCallback, useEffect, useState } from 'react';
import { apiConfig } from '../config/api';

function authHeaders() {
  return apiConfig.assistant.apiKey
    ? { Authorization: `Bearer ${apiConfig.assistant.apiKey}` }
    : {};
}

export function useProposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/assistant/proposals`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[proposals]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const resolve = useCallback(async (proposalId, decision) => {
    try {
      const res = await fetch(`${apiConfig.api.baseUrl}/assistant/proposals/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ proposalId, decision, decidedBy: 'dashboard' }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) return { ok: false, reason: data.reason };
      await fetchAll();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }, [fetchAll]);

  return { proposals, loading, refresh: fetchAll, resolve };
}
