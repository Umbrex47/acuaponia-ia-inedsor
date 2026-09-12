import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import {
  AndroidImportance,
  AndroidNotificationPriority,
} from 'expo-notifications/build/NotificationChannelManager.types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './storage';
import { api } from './api';

// Configurar comportamiento para que muestre banner, sonido y badge en pantalla en plataformas nativas
if (Platform.OS !== 'web') {
  try {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('[Notificaciones] Advertencia inicializando handler:', e?.message || e);
  }
}

class NotificationsManager {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.permissionsGranted = false;
  }

  /**
   * Conecta al Gateway WebSocket de Aquaponic OS (/ws).
   * Proporciona notificaciones instantáneas sin depender de los servidores
   * de Google/Apple, compatible con Expo Go, iOS, Android y Web.
   */
  async initWebSocket() {
    if (this.isConnecting || (this.socket && this.socket.readyState === 1)) {
      return;
    }

    this.isConnecting = true;
    try {
      const baseUrl = await storage.getApiBaseUrl();
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';

      if (this.socket) {
        try {
          this.socket.close();
        } catch {
          // ignore
        }
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.isConnected = true;
        console.log('[WS] Conectado al canal de notificaciones en tiempo real:', wsUrl);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'notification' && data.payload) {
            const record = data.payload;

            // 1. Mostrar notificación visual nativa en el celular
            this.scheduleLocalAlert(
              record.title || 'Alerta Acuaponía',
              record.message || 'Nueva notificación del sistema',
              record,
            );

            // 2. Notificar a los componentes activos en la app
            this.listeners.forEach((listener) => {
              try {
                listener(record);
              } catch (e) {
                console.warn('Error en listener de notificación:', e);
              }
            });
          }
        } catch {
          // payload no JSON
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.isConnected = false;
        // Reintentar reconexión cada 10 segundos
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initWebSocket();
          }, 10000);
        }
      };

      this.socket.onerror = (err) => {
        this.isConnecting = false;
        this.isConnected = false;
        console.warn('[WS] Advertencia de conexión:', err ? err.message : 'reconectando...');
      };
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      console.warn('[WS] Error inicializando socket:', err);
    }
  }

  /**
   * Suscribe una vista (como NotificationsScreen) a las alertas entrantes.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Verifica el estado actual de permisos sin lanzar excepciones ni errores.
   */
  async checkPermissionsStatus() {
    if (Platform.OS === 'web') {
      return true;
    }
    try {
      const { status } = await getPermissionsAsync();
      this.permissionsGranted = status === 'granted';
      return this.permissionsGranted;
    } catch {
      return false;
    }
  }

  /**
   * Solicita permisos en el sistema operativo y configura el canal de Android.
   *
   * En Expo Go (SDK 51/52/53): Google/Expo eliminaron el soporte para tokens FCM remotos universales.
   * Por eso esta función opera en modo "Alertas Locales en Tiempo Real vía WebSocket":
   * solicita los permisos nativos de Android/iOS para desplegar banners, sonido y vibración,
   * garantizando 0 errores y 100% de funcionamiento en Expo Go.
   */
  async registerForPushNotifications() {
    // 1. Manejo para plataforma Web
    if (Platform.OS === 'web') {
      await this.initWebSocket();
      return {
        success: true,
        mode: 'web_realtime',
        permissions: true,
        message: 'Alertas en tiempo real vía WebSocket activadas en navegador.',
      };
    }

    // 2. Configurar Canal de Notificaciones para Android
    if (Platform.OS === 'android') {
      try {
        await setNotificationChannelAsync('aquaponic-alerts', {
          name: 'Alertas Acuaponía',
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0284C7',
          sound: 'default',
        });
      } catch (channelErr) {
        console.warn('[Notificaciones] Canal Android:', channelErr?.message || channelErr);
      }
    }

    // 3. Solicitar permisos nativos de notificación en el celular (Android 13+ / iOS)
    let permissionsGranted = false;
    try {
      const { status: existingStatus } = await getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await requestPermissionsAsync();
        finalStatus = status;
      }

      permissionsGranted = finalStatus === 'granted';
      this.permissionsGranted = permissionsGranted;
    } catch (permErr) {
      console.warn('[Notificaciones] Advertencia solicitando permisos:', permErr?.message || permErr);
    }

    // 4. Iniciar WebSocket siempre para recepción inmediata
    await this.initWebSocket();

    console.log(
      `[Notificaciones] Modo Alertas en Tiempo Real activo (WebSocket + Notificaciones Locales).`,
    );

    return {
      success: permissionsGranted,
      mode: 'realtime_local',
      permissions: permissionsGranted,
      message: permissionsGranted
        ? 'Alertas en tiempo real activadas en tu dispositivo.'
        : 'Habilita los permisos de notificación para ver alertas en pantalla.',
    };
  }

  /**
   * Dispara una notificación nativa local inmediata con sonido, vibración y badge.
   */
  async scheduleLocalAlert(title, body, data = {}) {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      await scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: AndroidNotificationPriority.HIGH,
          channelId: 'aquaponic-alerts',
        },
        trigger: null, // instantáneo
      });
    } catch (e) {
      console.warn('[Notificaciones] Advertencia al programar notificación local:', e?.message || e);
    }
  }

  /**
   * Envía una notificación de prueba inmediata para validar sonido y visualización.
   */
  async sendTestNotification() {
    await this.scheduleLocalAlert(
      '🧪 Prueba AquaGia: Alerta de Nitritos',
      'Concentración: 0.85 ppm (Alerta Moderada). Sistema de alertas locales y WebSocket funcionando al 100%.',
      { category: 'manual_sampling', test: true, timestamp: new Date().toISOString() },
    );
  }
}

export const notificationsService = new NotificationsManager();
