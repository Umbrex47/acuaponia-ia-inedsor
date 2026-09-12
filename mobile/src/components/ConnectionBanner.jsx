import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { deliveryQueue } from '../services/deliveryQueue';

export function ConnectionBanner() {
  const [status, setStatus] = useState(deliveryQueue.getStatus());

  useEffect(() => {
    const unsubscribe = deliveryQueue.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  // Si está online y la cola está vacía, no mostrar barra para mantener la pantalla limpia
  if (status.isOnline && status.queueLength === 0 && !status.isSyncing) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        !status.isOnline && styles.bannerOffline,
        status.isSyncing && styles.bannerSyncing,
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={styles.statusDot}>
          {status.isSyncing ? '🔄' : status.isOnline ? '🟢' : '🟡'}
        </Text>
        <Text style={styles.bannerText}>
          {status.isSyncing
            ? `Reenviando datos pendientes (${status.queueLength} restantes)...`
            : !status.isOnline
            ? `Sin internet · ${status.queueLength} registro(s) en cola QoS`
            : `${status.queueLength} registro(s) pendientes de confirmar`}
        </Text>
      </View>

      {status.queueLength > 0 && !status.isSyncing ? (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => deliveryQueue.syncNow()}
        >
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      ) : null}

      {status.isSyncing ? (
        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0284C7',
  },
  bannerOffline: {
    backgroundColor: '#D97706', // Ámbar offline
  },
  bannerSyncing: {
    backgroundColor: '#059669', // Verde esmeralda sincronizando
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    fontSize: 12,
    marginRight: 8,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
});
