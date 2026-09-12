import { storage } from './storage';
import { deliveryQueue, QOS } from './deliveryQueue';

export const api = {
  async request(endpoint, options = {}) {
    const baseUrl = await storage.getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const op = await storage.getOperator();

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-operator-name': op.name || 'Operador Móvil',
      'x-user-role': op.role === 'Administrador' ? 'admin' : 'operador',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errMessage = `Error ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody?.message) {
            errMessage = Array.isArray(errBody.message)
              ? errBody.message.join(', ')
              : errBody.message;
          }
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      return await response.json();
    } catch (err) {
      console.warn(`[API] Fallo en ${options.method || 'GET'} ${url}:`, err.message);
      throw err;
    }
  },

  // ── Monitoreo Manual con Capa QoS 2 (Exactly Once) ─────────────────
  async getThresholds() {
    return this.request('/readings/thresholds');
  },

  /**
   * Envía un muestreo manual usando la capa de fidelidad QoS 2 (Entrega Exacta + Deduplicación).
   * Si no hay conexión a internet, se encola localmente y se reenvía de forma autónoma
   * con retroceso exponencial al recuperar señal.
   */
  async recordManualReading(data, qos = QOS.EXACTLY_ONCE) {
    try {
      const result = await this.request('/readings/manual', {
        method: 'POST',
        headers: {
          'x-qos': String(qos),
          'x-message-id': `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        },
        body: JSON.stringify(data),
      });
      return { success: true, delivered: true, data: result };
    } catch (err) {
      console.log('[API] Falla de red: Encolando con fidelidad QoS...');
      const queueResult = await deliveryQueue.publish('/readings/manual', data, qos);
      return {
        success: true,
        delivered: false,
        queued: true,
        message: 'Guardado en cola local (QoS). Se reenviará automáticamente al volver internet.',
        messageId: queueResult.messageId,
      };
    }
  },

  async getManualHistory(limit = 20, skip = 0, operator = '') {
    let query = `?limit=${limit}&skip=${skip}`;
    if (operator) query += `&operator=${encodeURIComponent(operator)}`;
    return this.request(`/readings/manual${query}`);
  },

  async getLatestManual() {
    return this.request('/readings/manual/latest');
  },

  // ── Seguimiento de Peces con QoS 2 ──────────────────────────────────
  async getFishStatus() {
    return this.request('/fish/status');
  },

  async recordFishObservation(data, qos = QOS.EXACTLY_ONCE) {
    try {
      const result = await this.request('/fish/observation', {
        method: 'POST',
        headers: {
          'x-qos': String(qos),
          'x-message-id': `fish-obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        },
        body: JSON.stringify(data),
      });
      return { success: true, delivered: true, data: result };
    } catch (err) {
      const queueResult = await deliveryQueue.publish('/fish/observation', data, qos);
      return {
        success: true,
        delivered: false,
        queued: true,
        message: 'Observación encolada en modo offline. Se sincronizará automáticamente.',
        messageId: queueResult.messageId,
      };
    }
  },

  // ── Notificaciones ──────────────────────────────────────────────────
  async getNotifications(unreadOnly = false, limit = 40) {
    const query = `?limit=${limit}${unreadOnly ? '&unreadOnly=true' : ''}`;
    return this.request(`/notifications${query}`);
  },

  async getUnreadCount() {
    return this.request('/notifications/unread-count');
  },

  async markNotificationRead(id) {
    const operator = await storage.getOperator();
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ readBy: operator.name || 'mobile-app' }),
    });
  },

  async markAllNotificationsRead() {
    const operator = await storage.getOperator();
    return this.request('/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({ readBy: operator.name || 'mobile-app' }),
    });
  },

  async registerPushToken(token, deviceName = 'Smartphone') {
    const operator = await storage.getOperator();
    return this.request('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: 'expo',
        deviceName,
        userName: operator.name,
      }),
    });
  },

  // ── Módulo de Administración (Fechas de Alerta y Ajustes de Sistema) ─
  async getAdminReminders() {
    return this.request('/admin/reminders');
  },

  async createAdminReminder(data) {
    return this.request('/admin/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminReminder(id, data) {
    return this.request(`/admin/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminReminder(id) {
    return this.request(`/admin/reminders/${id}`, {
      method: 'DELETE',
    });
  },

  async triggerAdminReminderNow(id) {
    return this.request(`/admin/reminders/${id}/trigger-now`, {
      method: 'POST',
    });
  },

  async getAdminSettings() {
    return this.request('/admin/settings');
  },

  async updateAdminSettings(data) {
    return this.request('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
