import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function RiskBadge({ level = 'stable', text }) {
  const getStyle = () => {
    switch (level) {
      case 'stable':
        return {
          bg: colors.stableBg,
          text: colors.stable,
          label: text || 'Óptimo',
        };
      case 'low':
        return {
          bg: colors.infoBg,
          text: colors.info,
          label: text || 'Bajo',
        };
      case 'high':
      case 'critical':
        return {
          bg: colors.criticalBg,
          text: colors.critical,
          label: text || 'Riesgoso',
        };
      case 'warn':
      case 'warning':
        return {
          bg: colors.warningBg,
          text: colors.warning,
          label: text || 'Alerta',
        };
      default:
        return {
          bg: '#E2E8F0',
          text: '#475569',
          label: text || 'Normal',
        };
    }
  };

  const styleConfig = getStyle();

  return (
    <View style={[styles.badge, { backgroundColor: styleConfig.bg }]}>
      <View style={[styles.dot, { backgroundColor: styleConfig.text }]} />
      <Text style={[styles.text, { color: styleConfig.text }]}>
        {styleConfig.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
