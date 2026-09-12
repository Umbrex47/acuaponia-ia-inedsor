import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { RiskBadge } from '../components/RiskBadge';
import { api } from '../services/api';
import { storage } from '../services/storage';

export function FishStatusScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal para registro rápido de observación de peces
  const [modalVisible, setModalVisible] = useState(false);
  const [operator, setOperator] = useState('');
  const [mortality, setMortality] = useState('0');
  const [behavior, setBehavior] = useState('');
  const [feedGrams, setFeedGrams] = useState('');
  const [healthStatus, setHealthStatus] = useState('excelente');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFishData();
    loadOperator();
  }, []);

  const loadOperator = async () => {
    const saved = await storage.getOperator();
    if (saved.name) setOperator(saved.name);
  };

  const loadFishData = async () => {
    setLoading(true);
    try {
      const res = await api.getFishStatus();
      setData(res);
    } catch (err) {
      console.warn('Error cargando estado de peces:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordObservation = async () => {
    if (!operator.trim()) {
      Alert.alert('Requerido', 'Ingresa el nombre del operador que registra la observación.');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordFishObservation({
        operator: operator.trim(),
        mortalityCount: parseInt(mortality, 10) || 0,
        behaviorNotes: behavior.trim(),
        feedAmountGrams: parseFloat(feedGrams) || 0,
        generalHealth: healthStatus,
        timestamp: new Date().toISOString(),
      });

      Alert.alert('Éxito', 'Observación de peces guardada y notificada al sistema.');
      setModalVisible(false);
      setMortality('0');
      setBehavior('');
      setFeedGrams('');
      loadFishData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando telemetría de peces...</Text>
      </View>
    );
  }

  const ai = data?.aiTelemetry || {};
  const observation = data?.latestObservation || {};
  const hypothesis = ai.assessment?.hypotheses?.[0];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabecera de Especie */}
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.speciesLabel}>Especie en Cultivo</Text>
            <Text style={styles.speciesTitle}>{data?.species || 'Tilapia Roja'}</Text>
          </View>
          <RiskBadge
            level={
              ai.mood === 'Alerta' || observation.generalHealth === 'critico'
                ? 'critical'
                : 'stable'
            }
            text={ai.mood || 'Calmados'}
          />
        </View>

        {/* Visión Artificial e IA (YOLO + SORT) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📹 Detección IA en Pecera (YOLO)</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>IA VIVA</Text>
            </View>
          </View>

          {/* Vista simulada de cámara de estanque */}
          <View style={styles.cameraBox}>
            <Text style={styles.cameraText}>🐟 Tanque de Peces · Visión Computacional</Text>
            <Text style={styles.cameraSubtext}>Inferencia activa en tiempo real</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {ai.count != null ? `${ai.count} peces detectados` : 'Detección activa'}
              </Text>
            </View>
          </View>

          {/* Métricas de Conducta */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Población Vista</Text>
              <Text style={styles.metricValue}>{ai.count ?? '—'}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Actividad</Text>
              <Text style={styles.metricValue}>
                {ai.behavior?.activityState
                  ? ai.behavior.activityState.toUpperCase()
                  : 'NORMAL'}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Score Bienestar</Text>
              <Text style={[styles.metricValue, { color: colors.stable }]}>
                {ai.behavior?.activityScore ?? 85}%
              </Text>
            </View>
          </View>

          {hypothesis?.message ? (
            <View style={styles.hypothesisCard}>
              <Text style={styles.hypothesisTitle}>Diagnóstico de IA:</Text>
              <Text style={styles.hypothesisMsg}>{hypothesis.message}</Text>
            </View>
          ) : null}
        </View>

        {/* Última Inspección Manual Registrada */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Última Inspección de Campo</Text>
          <Text style={styles.subtitle}>
            {data?.lastInspectedBy
              ? `Realizada por ${data.lastInspectedBy} a las ${new Date(data.lastInspectedAt).toLocaleString()}`
              : 'Sin inspección reciente'}
          </Text>

          <View style={styles.inspectionRow}>
            <Text style={styles.inspectionLabel}>Salud General:</Text>
            <RiskBadge
              level={
                observation.generalHealth === 'critico'
                  ? 'critical'
                  : observation.generalHealth === 'regular'
                  ? 'warn'
                  : 'stable'
              }
              text={observation.generalHealth ? observation.generalHealth.toUpperCase() : 'BUENO'}
            />
          </View>

          <View style={styles.inspectionRow}>
            <Text style={styles.inspectionLabel}>Mortalidad Reportada:</Text>
            <Text
              style={[
                styles.inspectionValue,
                observation.mortalityCount > 0 && { color: colors.critical },
              ]}
            >
              {observation.mortalityCount ?? 0} ejemplares
            </Text>
          </View>

          {observation.behaviorNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Observaciones del técnico:</Text>
              <Text style={styles.notesContent}>"{observation.behaviorNotes}"</Text>
            </View>
          ) : null}
        </View>

        {/* Botón Flotante / Destacado para Registrar Inspección */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.actionButtonText}>+ Registrar Observación de Peces</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Registro de Observación */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🐟 Inspección Directa de Peces</Text>
            <Text style={styles.modalSubtitle}>
              Quedará registrado tu nombre y la hora exacta en el servidor.
            </Text>

            <Text style={styles.modalLabel}>Operador</Text>
            <TextInput
              style={styles.modalInput}
              value={operator}
              onChangeText={setOperator}
              placeholder="Tu nombre"
            />

            <Text style={styles.modalLabel}>Peces muertos observados (Mortalidad)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={mortality}
              onChangeText={setMortality}
            />

            <Text style={styles.modalLabel}>Gramos de alimento suministrado (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              value={feedGrams}
              onChangeText={setFeedGrams}
              placeholder="0.0"
            />

            <Text style={styles.modalLabel}>Notas de comportamiento o signos</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
              multiline
              value={behavior}
              onChangeText={setBehavior}
              placeholder="Ej. Apetito voraz, aletas sanas, natación uniforme..."
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleRecordObservation}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Guardar Registro</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speciesLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  speciesTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.stable,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.stable,
  },
  cameraBox: {
    height: 140,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cameraText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  cameraSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  countBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  countText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  hypothesisCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  hypothesisTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  hypothesisMsg: {
    fontSize: 13,
    color: '#1E3A8A',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  inspectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inspectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  inspectionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  notesContent: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnCancelText: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalBtnSubmit: {
    backgroundColor: colors.primary,
  },
  modalBtnSubmitText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
