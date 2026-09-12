import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export function AdminSettingsScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState('reminders'); // 'reminders' | 'system'

  // Recordatorios State
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);

  // Form Nuevo Recordatorio
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState('3');
  const [targetTime, setTargetTime] = useState('08:00');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Ajustes de Sistema State
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [cooldown, setCooldown] = useState('60');
  const [channelWs, setChannelWs] = useState(true);
  const [channelPush, setChannelPush] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [channelTelegram, setChannelTelegram] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadReminders();
    loadSettings();
  }, []);

  const loadReminders = async () => {
    setLoadingReminders(true);
    try {
      const list = await api.getAdminReminders();
      setReminders(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Error cargando recordatorios:', err.message);
    } finally {
      setLoadingReminders(false);
    }
  };

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const s = await api.getAdminSettings();
      setSettings(s);
      setCooldown(String(s.cooldownMinutes || 60));
      const channels = s.notificationChannels || ['websocket', 'push'];
      setChannelWs(channels.includes('websocket'));
      setChannelPush(channels.includes('push'));
      setChannelEmail(channels.includes('email'));
      setChannelTelegram(channels.includes('telegram'));
    } catch (err) {
      console.warn('Error cargando ajustes:', err.message);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!title.trim()) {
      Alert.alert('Requerido', 'Ingresa un título para el recordatorio (ej. Revisar Nitritos y Amonio).');
      return;
    }

    const days = parseInt(intervalDays, 10);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Inválido', 'El intervalo debe ser al menos 1 día.');
      return;
    }

    setCreating(true);
    try {
      await api.createAdminReminder({
        title: title.trim(),
        description: description.trim(),
        type: 'recurring',
        intervalDays: days,
        targetTime: targetTime.trim() || '08:00',
        targetVariables: ['nitritos', 'amonio', 'ph', 'nitratos'],
        severity: 'warn',
        enabled: true,
      });

      Alert.alert('Éxito', `Recordatorio programado cada ${days} días.`);
      setTitle('');
      setDescription('');
      loadReminders();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleReminder = async (id, currentVal) => {
    try {
      await api.updateAdminReminder(id, { enabled: !currentVal });
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !currentVal } : r)),
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteReminder = async (id) => {
    Alert.alert('Eliminar', '¿Estás seguro de eliminar esta fecha de alerta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAdminReminder(id);
            setReminders((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleTriggerNow = async (id) => {
    try {
      const res = await api.triggerAdminReminderNow(id);
      Alert.alert('Alerta Disparada', res.message || 'Notificación enviada a todos los dispositivos.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const channels = [];
      if (channelWs) channels.push('websocket');
      if (channelPush) channels.push('push');
      if (channelEmail) channels.push('email');
      if (channelTelegram) channels.push('telegram');

      await api.updateAdminSettings({
        notificationChannels: channels,
        cooldownMinutes: parseInt(cooldown, 10) || 60,
      });

      Alert.alert('Guardado', 'Ajustes del sistema y canales de notificación actualizados.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Admin */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Panel Administrador</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reminders' && styles.tabActive]}
          onPress={() => setActiveTab('reminders')}
        >
          <Text style={[styles.tabText, activeTab === 'reminders' && styles.tabTextActive]}>
            ⏰ Fechas de Alerta
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'system' && styles.tabActive]}
          onPress={() => setActiveTab('system')}
        >
          <Text style={[styles.tabText, activeTab === 'system' && styles.tabTextActive]}>
            ⚙️ Ajustes del Sistema
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'reminders' ? (
          <>
            {/* Formulario para programar nueva alerta */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>+ Programar Nueva Alerta Periódica</Text>
              <Text style={styles.subtitle}>
                Configura notificaciones automáticas (ej. cada 3 días para re-chequear parámetros).
              </Text>

              <Text style={styles.label}>Título del Recordatorio *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Chequeo de Nitritos, Amonio y pH"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Frecuencia (Días)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    placeholder="3"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora de Envío</Text>
                  <TextInput
                    style={styles.input}
                    value={targetTime}
                    onChangeText={setTargetTime}
                    placeholder="08:00"
                  />
                </View>
              </View>

              <Text style={styles.label}>Instrucción / Mensaje adicional</Text>
              <TextInput
                style={[styles.input, { minHeight: 50, textAlignVertical: 'top' }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Ej. Tomar muestra de salida del biofiltro y cargar en la app"
              />

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateReminder}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.createBtnText}>Guardar Fecha de Alerta</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Lista de recordatorios existentes */}
            <Text style={styles.sectionHeader}>Alertas Programadas en el Backend</Text>

            {loadingReminders ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              reminders.map((r) => {
                const nextDateStr = r.nextTriggerAt
                  ? new Date(r.nextTriggerAt).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Pendiente';

                return (
                  <View key={r.id} style={styles.reminderCard}>
                    <View style={styles.reminderHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reminderTitle}>{r.title}</Text>
                        <Text style={styles.reminderFreq}>
                          🔄 Cada {r.intervalDays} días · Hora: {r.targetTime || '08:00'}
                        </Text>
                      </View>
                      <Switch
                        value={r.enabled}
                        onValueChange={() => handleToggleReminder(r.id, r.enabled)}
                        trackColor={{ false: '#CBD5E1', true: colors.primary }}
                      />
                    </View>

                    {r.description ? (
                      <Text style={styles.reminderDesc}>{r.description}</Text>
                    ) : null}

                    <View style={styles.reminderFooter}>
                      <Text style={styles.nextDate}>Próximo aviso: {nextDateStr}</Text>
                      <View style={styles.reminderActions}>
                        <TouchableOpacity
                          style={styles.testBtn}
                          onPress={() => handleTriggerNow(r.id)}
                        >
                          <Text style={styles.testBtnText}>⚡ Probar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteReminder(r.id)}
                        >
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* Pestaña de Ajustes del Sistema */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚙️ Canales y Ajustes de Notificación</Text>
            <Text style={styles.subtitle}>
              Modifica la infraestructura de despacho del backend principal.
            </Text>

            <View style={styles.channelRow}>
              <View>
                <Text style={styles.channelTitle}>WebSocket en Tiempo Real</Text>
                <Text style={styles.channelDesc}>Despacho local instantáneo al celular y dashboard</Text>
              </View>
              <Switch
                value={channelWs}
                onValueChange={setChannelWs}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>

            <View style={styles.channelRow}>
              <View>
                <Text style={styles.channelTitle}>Notificaciones Push Móviles</Text>
                <Text style={styles.channelDesc}>Alertas nativas al smartphone en segundo plano</Text>
              </View>
              <Switch
                value={channelPush}
                onValueChange={setChannelPush}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>

            <View style={styles.channelRow}>
              <View>
                <Text style={styles.channelTitle}>Alertas por Correo Electrónico</Text>
                <Text style={styles.channelDesc}>Envío vía servidor SMTP configurado</Text>
              </View>
              <Switch
                value={channelEmail}
                onValueChange={setChannelEmail}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>

            <View style={styles.channelRow}>
              <View>
                <Text style={styles.channelTitle}>Bot de Telegram</Text>
                <Text style={styles.channelDesc}>Notificaciones a grupo de técnicos</Text>
              </View>
              <Switch
                value={channelTelegram}
                onValueChange={setChannelTelegram}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>
              Cooldown Anti-Spam (Minutos entre alertas repetidas)
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={cooldown}
              onChangeText={setCooldown}
              placeholder="60"
            />

            <TouchableOpacity
              style={[styles.createBtn, savingSettings && { opacity: 0.7 }]}
              onPress={handleSaveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createBtnText}>Guardar Ajustes en Servidor</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
  },
  backBtn: {
    paddingVertical: 6,
  },
  backText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 14,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    marginTop: 6,
  },
  reminderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  reminderFreq: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  reminderDesc: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
  },
  reminderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  nextDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testBtn: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  channelDesc: {
    fontSize: 11,
    color: colors.textMuted,
    maxWidth: 220,
    marginTop: 2,
  },
});
