import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import { notificationsService } from './notifications';

export const QOS = {
  AT_MOST_ONCE: 0,   // QoS 0: Envío sin reintento persistente (Best Effort)
  AT_LEAST_ONCE: 1,  // QoS 1: Persistente en cola hasta recibir ACK
  EXACTLY_ONCE: 2,   // QoS 2: Con UUID y deduplicación en servidor (Idempotente)
};

const QUEUE_STORAGE_KEY = '@aquaponic_qos_queue';

class DeliveryQueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isOnline = true;
    this.listeners = new Set();
    this.monitorInterval = null;
    this.backoffDelayMs = 2000;
    this.maxBackoffMs = 30000;

    this.init();
  }

  async init() {
    await this.loadQueue();
    this.startNetworkMonitor();
  }

  /** Carga la cola persistente desde AsyncStorage */
  async loadQueue() {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      this.queue = raw ? JSON.parse(raw) : [];
      this.notifyListeners();
    } catch {
      this.queue = [];
    }
  }

  /** Guarda la cola en AsyncStorage */
  async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (err) {
      console.warn('Error guardando cola QoS:', err);
    }
  }

  /**
   * Encola un mensaje o dato para entrega garantizada (estilo MQTT QoS).
   * Genera un identificador único global `messageId` para deduplicación.
   */
  async publish(endpoint, body, qos = QOS.EXACTLY_ONCE, method = 'POST') {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Si es QoS 0 (a lo más una vez), intento directo sin almacenamiento persistente
    if (qos === QOS.AT_MOST_ONCE) {
      try {
        const response = await this.sendHttpRequest(endpoint, method, body, messageId, qos);
        return { delivered: true, queued: false, messageId, response };
      } catch {
        return { delivered: false, queued: false, messageId };
      }
    }

    // QoS 1 y QoS 2: Guardar en cola persistente antes de enviar
    const queuedItem = {
      id: messageId,
      endpoint,
      method,
      body,
      qos,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };

    this.queue.push(queuedItem);
    await this.saveQueue();

    // Intentar entrega inmediata
    this.processQueue();

    return {
      delivered: false,
      queued: true,
      messageId,
    };
  }

  /**
   * Monitor que comprueba periódicamente la conexión al backend.
   * Si detecta que la conexión regresa tras un periodo offline,
   * dispara automáticamente el reenvío de toda la cola.
   */
  startNetworkMonitor() {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(async () => {
      const reachable = await this.checkServerConnectivity();

      if (reachable && !this.isOnline) {
        console.log('[QoS Queue] ¡Conexión restablecida! Iniciando reenvío de datos en cola...');
        this.isOnline = true;
        this.backoffDelayMs = 2000;
        this.notifyListeners();

        // Notificar al usuario localmente
        if (this.queue.length > 0) {
          notificationsService.scheduleLocalAlert(
            '📶 Conexión Recuperada',
            `Sincronizando ${this.queue.length} registros pendientes en cola...`,
          );
        }

        // Reenviar cola automáticamente
        this.processQueue();
      } else if (!reachable && this.isOnline) {
        console.log('[QoS Queue] Se perdió la conexión con el servidor. Modo Offline activado.');
        this.isOnline = false;
        this.notifyListeners();
      }
    }, 10000);
  }

  /** Comprueba si el backend responde */
  async checkServerConnectivity() {
    try {
      const baseUrl = await storage.getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${baseUrl}/readings/thresholds`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Procesa la cola de mensajes en orden FIFO con control de reintentos
   * y deduplicación garantizada en backend.
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.notifyListeners();

    let deliveredCount = 0;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      item.attempts++;
      item.lastAttemptAt = new Date().toISOString();

      try {
        await this.sendHttpRequest(
          item.endpoint,
          item.method,
          item.body,
          item.id,
          item.qos,
        );

        // Envío exitoso (o ACK de duplicado recibido): remover de la cola
        this.queue.shift();
        await this.saveQueue();
        deliveredCount++;
        this.backoffDelayMs = 2000;
      } catch (err) {
        console.warn(`[QoS Queue] Falló reenvío del mensaje ${item.id}:`, err ? err.message : err);

        // Error de red: pausar drenado y aplicar retroceso exponencial
        this.isOnline = false;
        await this.saveQueue();

        console.log(`[QoS Queue] Pausando reenvíos por ${this.backoffDelayMs / 1000}s`);
        setTimeout(() => {
          this.processQueue();
        }, this.backoffDelayMs);

        // Aumentar retardo exponencialmente (hasta 30s)
        this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, this.maxBackoffMs);
        break;
      }
    }

    this.isProcessing = false;
    this.notifyListeners();

    if (deliveredCount > 0) {
      console.log(`[QoS Queue] Sincronizados exitosamente ${deliveredCount} mensajes.`);
    }
  }

  /** Realiza la petición HTTP con cabeceras de fidelidad y deduplicación */
  async sendHttpRequest(endpoint, method, body, messageId, qos) {
    const baseUrl = await storage.getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-message-id': messageId,
      'x-qos': String(qos),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...body, messageId, qos }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Servidor respondió con código ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /** Suscribirse a cambios de estado de la cola y conexión */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.warn('Error en listener de cola:', e);
      }
    });
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isProcessing,
      queueLength: this.queue.length,
      items: [...this.queue],
    };
  }

  /** Fuerza la sincronización manual inmediata */
  async syncNow() {
    this.isOnline = true;
    this.backoffDelayMs = 2000;
    return this.processQueue();
  }

  /** Limpia la cola (ej. desde ajustes) */
  async clear() {
    this.queue = [];
    await this.saveQueue();
  }
}

export const deliveryQueue = new DeliveryQueueManager();
