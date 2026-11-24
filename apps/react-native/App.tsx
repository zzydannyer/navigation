/** 原生航海入口：海图、航线、仪表与定位授权；地图常驻，面板覆盖切换。 */

import { useEffect, useState } from 'react';
import {
  AppState,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentPosition } from '@maplibre/maplibre-react-native';
import { LocationPermissionStatus } from '@navigation/app';
import { zh } from '@navigation/core';

import { shouldOfferSettings } from './src/adapters/location/permissionCoordinator';
import { useLocationPermission } from './src/hooks/useLocationPermission';
import { normalizePosition } from './src/adapters/location/normalizePosition';
import { hydrateNavigation, navigationStore, resetCorruptData, useNavigationStore } from './src/store';
import { useSimulationRunner } from './src/hooks/useSimulationRunner';
import { ActionButton } from './src/components/ActionButton';
import { NoticeBanner } from './src/components/NoticeBanner';
import { ChartScreen } from './src/screens/ChartScreen';
import { RouteScreen } from './src/screens/RouteScreen';
import { InstrumentScreen } from './src/screens/InstrumentScreen';

type Tab = 'chart' | 'route' | 'instruments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chart', label: zh.tab.chart },
  { id: 'route', label: zh.tab.route },
  { id: 'instruments', label: zh.tab.instrument },
];

function AppContent() {
  const insets = useSafeAreaInsets();
  const { view, request, openSettings, retry } = useLocationPermission();
  const state = view.outcome?.state;
  const granted = state === 'granted';
  const navigation = useNavigationStore();
  const [tab, setTab] = useState<Tab>('chart');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  const position = useCurrentPosition({
    enabled: granted && foreground && navigation.hydration === 'ready',
  });

  useSimulationRunner(
    navigation.navigation.status === 'running' && navigation.navigation.mode === 'simulation',
  );

  useEffect(() => {
    void hydrateNavigation();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!granted || !position) return;
    const fix = normalizePosition(position);
    if (fix) navigationStore.getState().applyGps(fix);
  }, [granted, position, navigation.hydration]);

  useEffect(() => {
    if (granted) {
      navigationStore.getState().setPermission(LocationPermissionStatus.GRANTED);
    } else if (state === 'blocked' || state === 'denied') {
      navigationStore.getState().setPermission(LocationPermissionStatus.DENIED);
    }
  }, [granted, state]);

  if (navigation.hydration !== 'ready') {
    return (
      <RecoveryView
        failed={navigation.hydration === 'failed'}
        message={navigation.loadError?.message}
        corrupt={navigation.loadError?.kind === 'corrupt'}
        resetError={navigation.resetError}
      />
    );
  }

  const permissionMessage = (() => {
    if (view.outcome?.error) {
      return `定位授权检查失败：${view.outcome.error}`;
    }
    if (state === 'blocked') {
      return '定位已关闭，请在系统设置中允许航海访问位置';
    }
    if (state === undefined) {
      return '正在检查定位授权…';
    }
    return '未获得定位授权，地图与航点仍可使用';
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ChartScreen granted={granted} showToolbar={tab === 'chart'} />

      {tab !== 'chart' && (
        <View style={[styles.panel, { paddingTop: insets.top }]}>
          {tab === 'route' ? <RouteScreen /> : <InstrumentScreen />}
        </View>
      )}

      <NoticeBanner />

      {navigation.persistence.state === 'failed' && (
        <View style={[styles.saveError, { bottom: 104 + insets.bottom }]}>
          <Text style={styles.errorText}>保存失败：{navigation.persistence.message}</Text>
          <ActionButton compact variant="outline" label="重试保存" onPress={navigation.retryPersist} />
        </View>
      )}

      {!granted && tab === 'chart' && (
        <View style={[styles.permission, { bottom: 92 + insets.bottom }]} testID="location-banner">
          <Text style={styles.bannerText}>{permissionMessage}</Text>
          {view.settingsError && (
            <Text style={styles.errorText}>打开系统设置失败：{view.settingsError}</Text>
          )}
          <View style={styles.actions}>
            {view.outcome?.error !== null && view.outcome?.error !== undefined ? (
              <ActionButton compact label="重试" onPress={retry} />
            ) : (
              <ActionButton
                compact
                label={view.busy ? '请求中…' : '开启定位'}
                disabled={view.busy}
                onPress={request}
              />
            )}
            {shouldOfferSettings(state) && (
              <ActionButton compact variant="outline" label="打开系统设置" onPress={openSettings} />
            )}
          </View>
        </View>
      )}

      <View style={[styles.tabs, { bottom: Math.max(12, insets.bottom) }]}>
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => setTab(item.id)}
            style={[styles.tab, tab === item.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecoveryView({
  failed,
  message,
  corrupt,
  resetError,
}: {
  failed: boolean;
  message?: string;
  corrupt: boolean;
  resetError: string | null;
}) {
  return (
    <View style={styles.recovery}>
      <Text style={styles.recoveryTitle}>{failed ? '本地数据恢复失败' : '正在恢复本地数据…'}</Text>
      {message !== undefined && <Text style={styles.recoveryText}>{message}</Text>}
      {resetError !== null && <Text style={styles.errorText}>{resetError}</Text>}
      {failed && (
        <View style={styles.actions}>
          <ActionButton label="重试读取" onPress={() => void hydrateNavigation()} />
          {corrupt && (
            <ActionButton
              variant="danger"
              label="清空损坏数据"
              onPress={() =>
                Alert.alert('清空本地数据？', '航点、航线和轨迹将被删除。', [
                  { text: zh.route.cancel, style: 'cancel' },
                  {
                    text: '清空',
                    style: 'destructive',
                    onPress: () => void resetCorruptData(),
                  },
                ])
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff',
    paddingBottom: 80,
  },
  tabs: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  tabActive: { backgroundColor: '#e2e8f0' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a' },
  permission: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.92)',
    gap: 8,
  },
  bannerText: { color: '#f8fafc', fontSize: 13 },
  errorText: { color: '#fca5a5', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveError: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  recovery: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  recoveryTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  recoveryText: { color: '#cbd5e1', fontSize: 13 },
});
