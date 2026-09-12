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
  FlatList,
} from 'react-native';
import { colors } from '../theme/colors';
import { ParameterInput } from '../components/ParameterInput';
import { RiskBadge } from '../components/RiskBadge';
import { api } from '../services/api';
import { storage } from '../services/storage';

export function ManualMonitoringScreen() {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'

  // Form State
  const [operator, setOperator] = useState('');
  const [operatorRole, setOperatorRole] = useState('Técnico Acuícola');
  const [notes, setNotes] = useState('');

  // Variables Químicas y de Agua
  const [ph, setPh] = useState('');
  const [nitratos, setNitratos] = useState('');
  const [nitritos, setNitritos] = useState('');
  const [amonio, setAmonio] = useState('');
  const [oxigeno, setOxigeno] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [alcalinidad, setAlcalinidad] = useState('');

  // Observaciones de Peces en el Muestreo
  const [mortalityCount, setMortalityCount] = useState('0');
  const [fishBehavior, setFishBehavior] = useState('');
  const [fishHealth, setFishHealth] = useState('bueno');

  // Async States
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadSavedOperator();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadSavedOperator = async () => {
    const saved = await storage.getOperator();
    if (saved.name) setOperator(saved.name);
    if (saved.role) setOperatorRole(saved.role);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getManualHistory(30, 0);
      setHistory(res.items || []);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el historial: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    if (!operator.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingresa el nombre de quien realiza la medición.');
      return;
    }

    const values = {};
    if (ph.trim() !== '') values.ph = parseFloat(ph);
    if (nitratos.trim() !== '') values.nitratos = parseFloat(nitratos);
    if (nitritos.trim() !== '') values.nitritos = parseFloat(nitritos);
    if (amonio.trim() !== '') values.amonio = parseFloat(amonio);
    if (oxigeno.trim() !== '') values.oxigeno = parseFloat(oxigeno);
    if (temperatura.trim() !== '') values.temperatura = parseFloat(temperatura);
    if (alcalinidad.trim() !== '') values.alcalinidad = parseFloat(alcalinidad);

    if (Object.keys(values).length === 0) {
      Alert.alert('Sin Datos', 'Por favor ingresa al menos un valor de medición (pH, Nitratos, Nitritos, Amonio, etc.)');
      return;
    }

    setLoading(true);

    try {
      // Guardar nombre del operador en almacenamiento local para no tener que escribirlo siempre
      await storage.setOperator(operator.trim(), operatorRole);

      const payload = {
        operator: operator.trim(),
        operatorRole,
        timestamp: new Date().toISOString(),
        values,
        notes: notes.trim(),
        fishObservation: {
          mortalityCount: parseInt(mortalityCount, 10) || 0,
          behaviorNotes: fishBehavior.trim(),
          generalHealth: fishHealth,
        },
        source: 'mobile-app',
      };

      const result = await api.recordManualReading(payload);

      if (result.offline) {
        Alert.alert('Modo Sin Conexión', result.message);
      } else {
        Alert.alert(
          'Registro Exitoso',
          `Muestreo registrado por ${operator} a las ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        );
      }

      // Limpiar campos de valores numéricos
      setPh('');
      setNitratos('');
      setNitritos('');
      setAmonio('');
      setOxigeno('');
      setTemperatura('');
      setAlcalinidad('');
      setNotes('');
      setFishBehavior('');
      setMortalityCount('0');

      // Pasar a la pestaña de historial
      setActiveTab('history');
    } catch (err) {
      Alert.alert('Error al Registrar', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryItem = ({ item }) => {
    const formattedDate = item.timestamp
      ? new Date(item.timestamp).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Fecha desconocida';

    const paramEntries = Object.entries(item.values || {});

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.historyOperator}>👤 {item.operator}</Text>
            <Text style={styles.historyRole}>{item.operatorRole || 'Operador'}</Text>
          </View>
          <Text style={styles.historyDate}>{formattedDate}</Text>
        </View>

        {item.notes ? <Text style={styles.historyNotes}>"{item.notes}"</Text> : null}

        <View style={styles.historyGrid}>
          {paramEntries.map(([key, val]) => {
            const evalItem = item.evaluations?.[key];
            const risk = evalItem?.riskLevel || 'stable';
            const unit = evalItem?.unit || '';
            const label = evalItem?.label || key;

            return (
              <View key={key} style={styles.paramPill}>
                <Text style={styles.paramLabel}>{label}:</Text>
                <Text style={styles.paramVal}>
                  {val} {unit}
                </Text>
                <RiskBadge level={risk} />
              </View>
            );
          })}
        </View>

        {item.fishObservation?.mortalityCount > 0 ? (
          <View style={styles.historyAlertFish}>
            <Text style={styles.historyAlertFishText}>
              ⚠️ Mortalidad reportada: {item.fishObservation.mortalityCount} pez/peces.
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs superiores */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'new' && styles.tabButtonActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            📝 Nuevo Muestreo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            📋 Historial y Auditoría
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'new' ? (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {/* Tarjeta de Operador y Auditoría */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>👤 Auditoría de Registro</Text>
            <Text style={styles.subtitle}>
              Quedará registrado quién realizó la medición y la fecha/hora exacta en el backend.
            </Text>

            <Text style={styles.inputLabel}>Nombre del Operador / Técnico *</Text>
            <TextInput
              style={styles.textInput}
              value={operator}
              onChangeText={setOperator}
              placeholder="Ej. Juan Pérez / Ing. Gómez"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Rol o Cargo</Text>
            <TextInput
              style={styles.textInput}
              value={operatorRole}
              onChangeText={setOperatorRole}
              placeholder="Ej. Investigador CSI / Operador de Turno"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Formulario de Variables Manuales Críticas */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🧪 Variables de Calidad del Agua</Text>
            <Text style={styles.subtitle}>
              Modificación de parámetros manuales requeridos (nitratos, nitritos, amonio, pH).
            </Text>

            <ParameterInput
              label="Potencial de Hidrógeno"
              formula="pH"
              value={ph}
              onChangeText={setPh}
              unit=""
              minOptimal={6.5}
              maxOptimal={8.0}
              placeholder="7.2"
            />

            <ParameterInput
              label="Nitritos"
              formula="NO₂⁻"
              value={nitritos}
              onChangeText={setNitritos}
              unit="ppm"
              minOptimal={0}
              maxOptimal={0.5}
              placeholder="0.05"
            />

            <ParameterInput
              label="Amonio / Amoníaco Total"
              formula="NH₄⁺ / NH₃"
              value={amonio}
              onChangeText={setAmonio}
              unit="ppm"
              minOptimal={0}
              maxOptimal={0.5}
              placeholder="0.10"
            />

            <ParameterInput
              label="Nitratos"
              formula="NO₃⁻"
              value={nitratos}
              onChangeText={setNitratos}
              unit="ppm"
              minOptimal={5}
              maxOptimal={40}
              placeholder="25.0"
            />

            <ParameterInput
              label="Oxígeno Disuelto"
              formula="O₂"
              value={oxigeno}
              onChangeText={setOxigeno}
              unit="mg/L"
              minOptimal={5.0}
              maxOptimal={12.0}
              placeholder="6.5"
            />

            <ParameterInput
              label="Temperatura del Agua"
              formula="T°"
              value={temperatura}
              onChangeText={setTemperatura}
              unit="°C"
              minOptimal={20.0}
              maxOptimal={30.0}
              placeholder="26.5"
            />

            <ParameterInput
              label="Alcalinidad Total"
              formula="CaCO₃"
              value={alcalinidad}
              onChangeText={setAlcalinidad}
              unit="mg/L"
              minOptimal={50}
              maxOptimal={150}
              placeholder="80"
            />
          </View>

          {/* Inspección de Peces */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🐟 Inspección de los Peces</Text>
            <Text style={styles.subtitle}>
              Registro de mortalidad y signos de salud en el estanque.
            </Text>

            <Text style={styles.inputLabel}>Mortalidad observada (peces retirados)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              value={mortalityCount}
              onChangeText={setMortalityCount}
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Conducta o síntomas observados</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              multiline
              numberOfLines={2}
              value={fishBehavior}
              onChangeText={setFishBehavior}
              placeholder="Ej. Natación vigorosa, apetito excelente en biofiltro..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Notas generales */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📝 Notas y Observaciones de Laboratorio</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej. Medición realizada con kit colorimétrico de reactivos API..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Botón de Enviar */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Muestreo en Backend Principal</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.historyContainer}>
          {historyLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item._id || item.id || String(Math.random())}
              renderItem={renderHistoryItem}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No hay registros manuales en la base de datos.</Text>
                </View>
              }
              onRefresh={loadHistory}
              refreshing={historyLoading}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  scrollArea: {
    flex: 1,
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  historyContainer: {
    flex: 1,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyOperator: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyRole: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  historyNotes: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#475569',
    marginBottom: 10,
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  paramPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  paramLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  paramVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  historyAlertFish: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
  },
  historyAlertFishText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
