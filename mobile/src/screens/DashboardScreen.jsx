import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { MetricCard } from '../components/MetricCard';
import { RiskBadge } from '../components/RiskBadge';
import { api } from '../services/api';

export function DashboardScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latestManual, setLatestManual] = useState(null);
  const [fishStatus, setFishStatus] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [manualRes, fishRes, unreadRes] = await Promise.allSettled([
        api.getLatestManual(),
        api.getFishStatus(),
        api.getUnreadCount(),
      ]);

      if (manualRes.status === 'fulfilled') setLatestManual(manualRes.value);
      if (fishRes.status === 'fulfilled') setFishStatus(fishRes.value);
      if (unreadRes.status === 'fulfilled') setUnreadCount(unreadRes.value?.unread || 0);
    } catch (err) {
      console.warn('Error cargando datos del dashboard:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !latestManual && !fishStatus) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Conectando con Aquaponic OS...</Text>
      </View>
    );
  }

  const values = latestManual?.values || {};
  const evals = latestManual?.evaluations || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Resumen Superior */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Sistema Acuapónico INEDSOR</Text>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>ONLINE</Text>
          </View>
        </View>

        <Text style={styles.summarySub}>
          {latestManual?.timestamp
            ? `Último muestreo: ${new Date(latestManual.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} por ${latestManual.operator || 'Operador'}`
            : 'Sin mediciones recientes registradas'}
        </Text>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => onNavigate && onNavigate('notifications')}
          >
            <Text style={styles.alertBannerText}>
              ⚠️ Tienes {unreadCount} {unreadCount === 1 ? 'alerta pendiente' : 'alertas pendientes'} en el sistema
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tarjeta de Estado de los Peces */}
      <TouchableOpacity
        style={styles.fishQuickCard}
        activeOpacity={0.85}
        onPress={() => onNavigate && onNavigate('fish')}
      >
        <View style={styles.fishCardHeader}>
          <Text style={styles.fishCardTitle}>🐟 Estado de los Peces</Text>
          <RiskBadge
            level={
              fishStatus?.aiTelemetry?.mood === 'Alerta' ? 'critical' : 'stable'
            }
            text={fishStatus?.aiTelemetry?.mood || 'Calmados'}
          />
        </View>

        <View style={styles.fishCardRow}>
          <Text style={styles.fishCardMetric}>
            Peces detectados:{' '}
            <Text style={{ fontWeight: '800', color: colors.primary }}>
              {fishStatus?.aiTelemetry?.count ?? 'Monitoreando'}
            </Text>
          </Text>
          <Text style={styles.fishCardMetric}>
            Mortalidad:{' '}
            <Text
              style={{
                fontWeight: '800',
                color:
                  (fishStatus?.latestObservation?.mortalityCount || 0) > 0
                    ? colors.critical
                    : colors.stable,
              }}
            >
              {fishStatus?.latestObservation?.mortalityCount ?? 0} ejemplares
            </Text>
          </Text>
        </View>
        <Text style={styles.fishCardHint}>Toca para ver cámara IA y bitácora →</Text>
      </TouchableOpacity>

      {/* Variables Clave de Agua (Química y Sensores) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Variables de Calidad del Agua</Text>
        <TouchableOpacity onPress={() => onNavigate && onNavigate('manual')}>
          <Text style={styles.actionLink}>+ Registrar Muestreo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {/* pH */}
        <MetricCard
          label="pH (Acidez/Alcalinidad)"
          value={values.ph != null ? values.ph : 7.2}
          unit=""
          riskLevel={evals.ph?.riskLevel || 'stable'}
          optimalRange="6.5 – 8.0"
          subtitle={latestManual?.operator ? `Reg: ${latestManual.operator}` : null}
        />

        {/* Nitritos */}
        <MetricCard
          label="Nitritos (NO₂⁻)"
          value={values.nitritos != null ? values.nitritos : 0.05}
          unit="ppm"
          riskLevel={evals.nitritos?.riskLevel || 'stable'}
          optimalRange="0 – 0.5 ppm"
          subtitle="Tóxico para peces si > 0.5"
        />

        {/* Amonio */}
        <MetricCard
          label="Amonio / Amoníaco (NH₄⁺)"
          value={values.amonio != null ? values.amonio : 0.1}
          unit="ppm"
          riskLevel={evals.amonio?.riskLevel || 'stable'}
          optimalRange="0 – 0.5 ppm"
          subtitle="Peligro letal si > 0.5"
        />

        {/* Nitratos */}
        <MetricCard
          label="Nitratos (NO₃⁻)"
          value={values.nitratos != null ? values.nitratos : 25}
          unit="ppm"
          riskLevel={evals.nitratos?.riskLevel || 'stable'}
          optimalRange="5 – 40 ppm"
          subtitle="Nutriente esencial de plantas"
        />

        {/* Oxígeno */}
        <MetricCard
          label="Oxígeno Disuelto"
          value={values.oxigeno != null ? values.oxigeno : 6.8}
          unit="mg/L"
          riskLevel={evals.oxigeno?.riskLevel || 'stable'}
          optimalRange="5.0 – 12.0 mg/L"
        />

        {/* Temperatura */}
        <MetricCard
          label="Temperatura del Agua"
          value={values.temperatura != null ? values.temperatura : 27.2}
          unit="°C"
          riskLevel={evals.temperatura?.riskLevel || 'stable'}
          optimalRange="20 – 30 °C"
        />
      </View>
    </ScrollView>
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
  summaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 4,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  summarySub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  alertBanner: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alertBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  fishQuickCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fishCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fishCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  fishCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fishCardMetric: {
    fontSize: 13,
    color: colors.text,
  },
  fishCardHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  grid: {
    gap: 4,
  },
});
