import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { RiskBadge } from './RiskBadge';

export function ParameterInput({
  label,
  formula,
  value,
  onChangeText,
  unit,
  minOptimal,
  maxOptimal,
  placeholder = '0.0',
}) {
  const numVal = parseFloat(value);
  let liveRisk = null;

  if (!isNaN(numVal) && value.trim() !== '') {
    if (minOptimal != null && numVal < minOptimal) {
      liveRisk = 'low';
    } else if (maxOptimal != null && numVal > maxOptimal) {
      liveRisk = 'high';
    } else {
      liveRisk = 'stable';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.label}>{label}</Text>
          {formula ? <Text style={styles.formula}> ({formula})</Text> : null}
        </View>
        {liveRisk ? <RiskBadge level={liveRisk} /> : null}
      </View>

      <Text style={styles.rangeText}>
        Rango seguro:{' '}
        <Text style={styles.rangeVal}>
          {minOptimal ?? 0} – {maxOptimal} {unit}
        </Text>
      </Text>

      <View
        style={[
          styles.inputWrapper,
          liveRisk === 'high' && styles.borderCritical,
          liveRisk === 'stable' && styles.borderStable,
          liveRisk === 'low' && styles.borderLow,
        ]}
      >
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>{unit || '-'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  formula: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  rangeText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  rangeVal: {
    fontWeight: '600',
    color: colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  borderCritical: {
    borderColor: colors.critical,
    backgroundColor: '#FFF1F2',
  },
  borderStable: {
    borderColor: colors.stable,
    backgroundColor: '#F0FDF4',
  },
  borderLow: {
    borderColor: colors.info,
    backgroundColor: '#F0F9FF',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  unitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#E2E8F0',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
