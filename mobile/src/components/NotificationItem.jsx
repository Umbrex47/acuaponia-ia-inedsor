import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function NotificationItem({ item, onMarkRead }) {
  const getSeverityColor = () => {
    switch (item.severity) {
      case 'critical':
        return colors.critical;
      case 'warn':
        return colors.warning;
      case 'success':
        return colors.stable;
      default:
        return colors.primary;
    }
  };

  const getEmoji = () => {
    switch (item.severity) {
      case 'critical':
        return '🔴';
      case 'warn':
        return '🟡';
      case 'success':
        return '🟢';
      default:
        return 'ℹ️';
    }
  };

  const formattedDate = item.ts
    ? new Date(item.ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onMarkRead && onMarkRead(item.id)}
      style={[styles.card, !item.read && styles.unreadCard]}
    >
      <View style={[styles.indicator, { backgroundColor: getSeverityColor() }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>{getEmoji()}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>

        <Text style={styles.message}>{item.message}</Text>

        <View style={styles.footer}>
          <Text style={styles.meta}>
            {item.source ? `Origen: ${item.source.toUpperCase()} • ` : ''}
            {formattedDate}
          </Text>
          {item.meta?.operator ? (
            <Text style={styles.operator}>👤 {item.meta.operator}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BAE6FD',
  },
  indicator: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  emoji: {
    fontSize: 14,
    marginRight: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6,
  },
  message: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  operator: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
