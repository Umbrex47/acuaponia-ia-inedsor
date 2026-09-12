import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { RiskBadge } from './RiskBadge';

export function MetricCard({ label, value, unit, riskLevel = 'stable', optimalRange, subtitle }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <RiskBadge level={riskLevel} />
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {value != null && value !== '' ? value : '—'}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {optimalRange ? (
        <Text style={styles.optimal}>Rango seguro: {optimalRange}</Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  unit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: 6,
  },
  optimal: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
});
