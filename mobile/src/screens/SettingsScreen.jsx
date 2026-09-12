import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { storage } from '../services/storage';
import { notificationsService } from '../services/notifications';
import { deliveryQueue, QOS } from '../services/deliveryQueue';
import { AdminSettingsScreen } from './AdminSettingsScreen';

export function SettingsScreen() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorRole, setOperatorRole] = useState('');
  const [queueStatus, setQueueStatus] = useState(deliveryQueue.getStatus());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSettings();
    const unsub = deliveryQueue.subscribe((s) => setQueueStatus(s));
    return () => unsub();
  }, []);

  const loadSettings = async () => {
    const url = await storage.getApiBaseUrl();
    const op = await storage.getOperator();

    setApiUrl(url);
    setOperatorName(op.name || '');
    setOperatorRole(op.role || 'Técnico Acuícola');
  };

  const handleSave = async () => {
    await storage.setApiBaseUrl(apiUrl);
    await storage.setOperator(operatorName, operatorRole);
    Alert.alert('Guardado', 'Configuración del servidor y operador actualizada.');
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await deliveryQueue.syncNow();
      Alert.alert('Sincronización', 'Reenvío de mensajes en cola ejecutado.');
    } catch (err) {
      Alert.alert('Error', 'Fallo al sincronizar: ' + (err ? err.message : err));
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    Alert.alert('Vaciar Cola', '¿Deseas vaciar los mensajes locales pendientes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          await deliveryQueue.clear();
          Alert.alert('Cola vaciada', 'Los registros pendientes fueron removidos.');
        },
      },
    ]);
  };

  const handleTestAlert = async () => {
    try {
      await notificationsService.scheduleLocalAlert(
        '🧪 Alerta de Prueba (Local)',
        'El canal de notificaciones locales y WebSocket de Aquaponic OS responde correctamente.',
      );
    } catch (err) {
      Alert.alert('Aviso', 'Alerta local: ' + (err ? err.message : err));
    }
  };

  if (showAdmin) {
    return <AdminSettingsScreen onBack={() => setShowAdmin(false)} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Panel Administrador Destacado */}
      <View style={[styles.card, styles.adminCard]}>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>MODO ADMIN</Text>
        </View>
        <Text style={styles.adminTitle}>👑 Panel de Control de Administrador</Text>
        <Text style={styles.subtitle}>
          Configura fechas de alerta periódicas (ej. cada 3 días re-chequear parámetros),
          umbrales químicos del agua y canales de notificación del backend.
        </Text>
        <TouchableOpacity
          style={styles.adminBtn}
          onPress={() => setShowAdmin(true)}
        >
          <Text style={styles.adminBtnText}>Abrir Panel de Administrador →</Text>
        </TouchableOpacity>
      </View>

      {/* Servidor Backend */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🌐 Servidor Backend Principal</Text>
        <Text style={styles.subtitle}>
          Dirección IP o dominio del backend NestJS donde corre Aquaponic OS.
        </Text>

        <Text style={styles.label}>URL Base de la API</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="http://192.168.1.100:8080"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          En desarrollo local usa la IP de tu PC en la red local (ej. 192.168.x.x:8080).
        </Text>
      </View>

      {/* Perfil del Operador */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 Perfil del Técnico / Operador</Text>
        <Text style={styles.subtitle}>
          Estos datos se usarán por defecto para auditar quién realiza cada muestreo manual.
        </Text>

        <Text style={styles.label}>Nombre Completo</Text>
        <TextInput
          style={styles.input}
          value={operatorName}
          onChangeText={setOperatorName}
          placeholder="Tu nombre o identificación"
        />

        <Text style={styles.label}>Cargo o Rol</Text>
        <TextInput
          style={styles.input}
          value={operatorRole}
          onChangeText={setOperatorRole}
          placeholder="Ej. Técnico Acuícola / Administrador"
        />
      </View>

      {/* Cola de Fidelidad de Entrega (Estilo MQTT QoS) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📶 Capa de Entrega QoS y Cola de Reenvío</Text>
        <Text style={styles.subtitle}>
          Si tomas muestras sin internet, se encolan con fidelidad QoS 2 (Entrega exacta + deduplicación)
          y se reenvían automáticamente al recuperar la señal.
        </Text>

        <View style={styles.qosStatusBox}>
          <View style={styles.qosStatusRow}>
            <Text style={styles.qosLabel}>Estado de Conexión:</Text>
            <Text
              style={[
                styles.qosValue,
                { color: queueStatus.isOnline ? colors.stable : colors.warning },
              ]}
            >
              {queueStatus.isOnline ? '🟢 En Línea' : '🟡 Desconectado (Offline)'}
            </Text>
          </View>

          <View style={styles.qosStatusRow}>
            <Text style={styles.qosLabel}>Mensajes en Cola QoS:</Text>
            <Text style={styles.qosValue}>
              {queueStatus.queueLength} registro(s) pendiente(s)
            </Text>
          </View>

          <View style={styles.qosStatusRow}>
            <Text style={styles.qosLabel}>Deduplicación en Servidor:</Text>
            <Text style={[styles.qosValue, { color: colors.primary }]}>
              Activa (Idempotente)
            </Text>
          </View>
        </View>

        <View style={styles.queueActions}>
          <TouchableOpacity
            style={[styles.syncBtn, (queueStatus.queueLength === 0 || syncing) && styles.syncBtnDisabled]}
            onPress={handleForceSync}
            disabled={queueStatus.queueLength === 0 || syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Reenviar Cola Ahora</Text>
            )}
          </TouchableOpacity>

          {queueStatus.queueLength > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearQueue}>
              <Text style={styles.clearBtnText}>Vaciar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Pruebas de Notificación */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🔔 Sistema de Notificaciones</Text>
        <Text style={styles.subtitle}>
          Comprueba que el canal WebSocket y el generador de avisos nativos respondan.
        </Text>

        <TouchableOpacity style={styles.testBtn} onPress={handleTestAlert}>
          <Text style={styles.testBtnText}>Lanzar Notificación de Prueba</Text>
        </TouchableOpacity>
      </View>

      {/* Botón Guardar */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Guardar Configuración</Text>
      </TouchableOpacity>

      <Text style={styles.footerVersion}>
        AquaGia Mobile OS v1.0.0 · I.E. SOLEDAD ROMAN - CSI INEDSOR
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  adminCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  adminBadgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
  },
  adminTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  adminBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  adminBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  qosStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  qosStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  qosLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  qosValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  queueActions: {
    flexDirection: 'row',
    gap: 10,
  },
  syncBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  clearBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  testBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerVersion: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 24,
  },
});
