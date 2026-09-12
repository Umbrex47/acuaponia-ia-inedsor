import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  OPERATOR_NAME: '@aquaponic_operator_name',
  OPERATOR_ROLE: '@aquaponic_operator_role',
  API_BASE_URL: '@aquaponic_api_base_url',
  OFFLINE_QUEUE: '@aquaponic_offline_queue',
  PUSH_TOKEN: '@aquaponic_push_token',
};

export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://acuaponia-ia-inedsor.onrender.com';

export const storage = {
  // Operador
  async getOperator() {
    try {
      const name = await AsyncStorage.getItem(KEYS.OPERATOR_NAME);
      const role = await AsyncStorage.getItem(KEYS.OPERATOR_ROLE);
      return {
        name: name || '',
        role: role || 'Técnico Acuícola',
      };
    } catch {
      return { name: '', role: 'Técnico Acuícola' };
    }
  },

  async setOperator(name, role = 'Técnico Acuícola') {
    try {
      await AsyncStorage.setItem(KEYS.OPERATOR_NAME, name);
      if (role) await AsyncStorage.setItem(KEYS.OPERATOR_ROLE, role);
    } catch (e) {
      console.warn('Error guardando operador:', e);
    }
  },

  // Servidor Backend
  async getApiBaseUrl() {
    try {
      const url = await AsyncStorage.getItem(KEYS.API_BASE_URL);
      return url || DEFAULT_API_URL;
    } catch {
      return DEFAULT_API_URL;
    }
  },

  async setApiBaseUrl(url) {
    try {
      await AsyncStorage.setItem(KEYS.API_BASE_URL, url.trim().replace(/\/$/, ''));
    } catch (e) {
      console.warn('Error guardando API URL:', e);
    }
  },

  // Cola sin conexión
  async getOfflineQueue() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async pushToOfflineQueue(item) {
    try {
      const queue = await this.getOfflineQueue();
      queue.push({
        ...item,
        queuedAt: new Date().toISOString(),
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
      return queue.length;
    } catch (e) {
      console.warn('Error agregando a cola offline:', e);
      return 0;
    }
  },

  async clearOfflineQueue() {
    try {
      await AsyncStorage.removeItem(KEYS.OFFLINE_QUEUE);
    } catch (e) {
      console.warn('Error limpiando cola offline:', e);
    }
  },
};
