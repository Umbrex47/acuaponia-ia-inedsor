import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { colors } from './src/theme/colors';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ManualMonitoringScreen } from './src/screens/ManualMonitoringScreen';
import { FishStatusScreen } from './src/screens/FishStatusScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ConnectionBanner } from './src/components/ConnectionBanner';
import { api } from './src/services/api';
import { notificationsService } from './src/services/notifications';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Registrar push notifications al iniciar
    notificationsService.registerForPushNotifications();

    // Consultar alertas pendientes
    checkUnreadAlerts();
    const interval = setInterval(checkUnreadAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkUnreadAlerts = async () => {
    try {
      const res = await api.getUnreadCount();
      if (res && typeof res.unread === 'number') {
        setUnreadCount(res.unread);
      }
    } catch {
      // ignore
    }
  };

  const renderScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'manual':
        return <ManualMonitoringScreen />;
      case 'fish':
        return <FishStatusScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header Superior Principal */}
      <View style={styles.topHeader}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>AQUAGIA</Text>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>MOBILE</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setCurrentTab('notifications')}
          >
            <Text style={styles.headerIcon}>🔔</Text>
            {unreadCount > 0 ? (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setCurrentTab('settings')}
          >
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Conexión y Cola QoS */}
      <ConnectionBanner />

      {/* Contenido de la Pantalla Activa */}
      <View style={styles.screenContainer}>{renderScreen()}</View>

      {/* Barra de Navegación Inferior (Tabs) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('dashboard')}
        >
          <Text
            style={[
              styles.navIcon,
              currentTab === 'dashboard' && styles.navIconActive,
            ]}
          >
            📊
          </Text>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'dashboard' && styles.navLabelActive,
            ]}
          >
            Tablero
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('manual')}
        >
          <Text
            style={[
              styles.navIcon,
              currentTab === 'manual' && styles.navIconActive,
            ]}
          >
            🧪
          </Text>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'manual' && styles.navLabelActive,
            ]}
          >
            Muestreo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('fish')}
        >
          <Text
            style={[
              styles.navIcon,
              currentTab === 'fish' && styles.navIconActive,
            ]}
          >
            🐟
          </Text>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'fish' && styles.navLabelActive,
            ]}
          >
            Peces
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('notifications')}
        >
          <View>
            <Text
              style={[
                styles.navIcon,
                currentTab === 'notifications' && styles.navIconActive,
              ]}
            >
              🔔
            </Text>
            {unreadCount > 0 ? <View style={styles.navDot} /> : null}
          </View>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'notifications' && styles.navLabelActive,
            ]}
          >
            Alertas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('settings')}
        >
          <Text
            style={[
              styles.navIcon,
              currentTab === 'settings' && styles.navIconActive,
            ]}
          >
            ⚙️
          </Text>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'settings' && styles.navLabelActive,
            ]}
          >
            Ajustes
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topHeader: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  brandBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    position: 'relative',
    padding: 6,
  },
  headerIcon: {
    fontSize: 18,
  },
  badgeCount: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.critical,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 6,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  navDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.critical,
  },
});
