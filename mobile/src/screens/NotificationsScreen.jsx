import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { NotificationItem } from '../components/NotificationItem';
import { api } from '../services/api';
import { notificationsService } from '../services/notifications';

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | critical | warn | info
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pushStatus, setPushStatus] = useState('not_configured'); // active | configuring

  useEffect(() => {
    loadNotifications();

    // Comprobar estado de permisos al iniciar
    notificationsService.checkPermissionsStatus().then((granted) => {
      if (granted) setPushStatus('active');
    });

    // Escuchar notificaciones en vivo por WebSocket
    const unsubscribe = notificationsService.subscribe((newRecord) => {
      setNotifications((prev) => [newRecord, ...prev]);
    });

    return () => unsubscribe();
  }, [filter, unreadOnly]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications(unreadOnly, 50);
      let list = res.items || [];
      if (filter !== 'all') {
        list = list.filter((n) => n.severity === filter);
      }
      setNotifications(list);
    } catch (err) {
      console.warn('Error cargando notificaciones:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (err) {
      console.warn('No se pudo marcar como leída:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      Alert.alert('Listo', 'Todas las notificaciones fueron marcadas como leídas.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleEnablePush = async () => {
    setPushStatus('configuring');
    try {
      const res = await notificationsService.registerForPushNotifications();
      if (res?.permissions || res?.success) {
        setPushStatus('active');
        Alert.alert(
          '✅ Alertas Activadas',
          'Tu dispositivo está listo para recibir alertas en tiempo real con sonido, vibración y banners en la barra de estado.',
        );
      } else {
        setPushStatus('not_configured');
        Alert.alert(
          'Permisos requeridos',
          'Por favor habilita los permisos de notificaciones en los ajustes del teléfono.',
        );
      }
    } catch (err) {
      setPushStatus('not_configured');
      Alert.alert('Aviso de Notificaciones', err?.message || 'Error al configurar');
    }
  };

  const handleTestAlert = async () => {
    try {
      await notificationsService.sendTestNotification();
      Alert.alert(
        '🔔 Alerta de Prueba Emitida',
        'Se ha enviado la notificación de prueba al sistema operativo. Revisa la parte superior de la pantalla.',
      );
    } catch (err) {
      Alert.alert('Aviso', 'Error enviando notificación de prueba: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Banner de Registro y Prueba de Alertas */}
      <View style={styles.pushBanner}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.titleRow}>
            <Text style={styles.pushTitle}>🔔 Notificaciones en Vivo</Text>
            {pushStatus === 'active' ? (
              <View style={styles.statusBadgeGreen}>
                <Text style={styles.statusBadgeText}>✓ ACTIVAS</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.pushSubtitle}>
            Alertas con sonido y vibración ante nitritos, amonio o anomalías de peces.
          </Text>
        </View>

        <View style={styles.bannerButtons}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestAlert}
          >
            <Text style={styles.testBtnText}>Probar 🔔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pushBtn, pushStatus === 'active' && styles.pushBtnActive]}
            onPress={handleEnablePush}
            disabled={pushStatus === 'active'}
          >
            <Text style={styles.pushBtnText}>
              {pushStatus === 'active' ? 'Listo' : 'Activar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Filtros */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            Todas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'critical' && styles.filterChipActive]}
          onPress={() => setFilter('critical')}
        >
          <Text style={[styles.filterChipText, filter === 'critical' && styles.filterChipTextActive]}>
            🔴 Críticas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'warn' && styles.filterChipActive]}
          onPress={() => setFilter('warn')}
        >
          <Text style={[styles.filterChipText, filter === 'warn' && styles.filterChipTextActive]}>
            🟡 Alertas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, unreadOnly && styles.filterChipActive]}
          onPress={() => setUnreadOnly(!unreadOnly)}
        >
          <Text style={[styles.filterChipText, unreadOnly && styles.filterChipTextActive]}>
            No leídas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botón rápido para marcar todas leídas */}
      <View style={styles.subHeader}>
        <Text style={styles.listCount}>
          {notifications.length} notificaciones {unreadOnly ? 'pendientes' : ''}
        </Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>Marcar todas como leídas</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Notificaciones */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id || String(Math.random())}
          renderItem={({ item }) => (
            <NotificationItem item={item} onMarkRead={handleMarkRead} />
          )}
          contentContainerStyle={styles.listContent}
          onRefresh={loadNotifications}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Bandeja Limpia</Text>
              <Text style={styles.emptyText}>
                No hay notificaciones ni alertas bajo los filtros seleccionados.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 14,
    borderRadius: 14,
  },
  pushTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  pushSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadgeGreen: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  bannerButtons: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  testBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  testBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 11,
  },
  pushBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pushBtnActive: {
    backgroundColor: colors.stable,
  },
  pushBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 50,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
