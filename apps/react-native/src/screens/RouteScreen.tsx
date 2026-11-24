import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  LegKind,
  nextLegKind,
  orderedWaypoints,
  routeDistance,
  zh,
  type Route,
} from '@navigation/core';
import { selectNavigationGuidance } from '@navigation/app';
import { ActionButton } from '../components/ActionButton';
import { useNavigationStore } from '../store';

interface EditingWaypoint {
  id: string;
  value: string;
}

/**
 * 航点与航线面板：顺序对齐 Tauri 桌面面板——生成航线、航点列表、航线列表，
 * 每条航线再依次给出节点排序/航法、制导读数、激活与开始/暂停/继续/结束。
 */
export function RouteScreen() {
  const state = useNavigationStore();
  const guidance = selectNavigationGuidance(state);
  const [editing, setEditing] = useState<EditingWaypoint | null>(null);

  const navigation = state.navigation;
  const sessionActive =
    navigation.status === 'running' || navigation.status === 'paused';
  const sessionSimulation = sessionActive && navigation.mode === 'simulation';
  const lockedRoute = sessionActive
    ? state.routes.find((route) => route.id === navigation.routeId)
    : undefined;
  const lockedWaypointIds = new Set(lockedRoute?.waypointIds ?? []);
  const statusLabel = {
    idle: zh.nav.statusIdle,
    running: zh.nav.statusRunning,
    paused: zh.nav.statusPaused,
    ended: zh.nav.statusEnded,
  }[navigation.status];

  function confirmRemoveWaypoint(id: string, name: string) {
    Alert.alert('删除航点？', name, [
      { text: zh.route.cancel, style: 'cancel' },
      {
        text: zh.route.delete,
        style: 'destructive',
        onPress: () => state.removeWaypoint(id),
      },
    ]);
  }

  function saveRename() {
    if (editing === null) return;
    state.renameWaypoint(editing.id, editing.value);
    setEditing(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ActionButton
          label={zh.route.create}
          disabled={sessionActive}
          onPress={() => {
            state.createRoute(
              zh.route.routeName.replace('{{index}}', String(state.routes.length + 1)),
            );
          }}
        />
        <Text style={styles.hint}>{zh.chart.longPressHint}</Text>

        <Text style={styles.section}>{zh.route.waypoints}</Text>
        {state.waypoints.length === 0 && <Text style={styles.muted}>{zh.route.emptyWaypoint}</Text>}
        {state.waypoints.map((waypoint) => {
          const locked = lockedWaypointIds.has(waypoint.id);
          return (
            <View style={styles.card} key={waypoint.id}>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{waypoint.name}</Text>
                <Text style={styles.muted}>
                  {waypoint.position.latitude.toFixed(5)}, {waypoint.position.longitude.toFixed(5)}
                </Text>
              </View>
              <View style={styles.actions}>
                <ActionButton
                  compact
                  variant="outline"
                  label={zh.route.rename}
                  disabled={locked}
                  onPress={() => setEditing({ id: waypoint.id, value: waypoint.name })}
                />
                <ActionButton
                  compact
                  variant="danger"
                  label={zh.route.delete}
                  disabled={locked}
                  onPress={() => confirmRemoveWaypoint(waypoint.id, waypoint.name)}
                />
              </View>
            </View>
          );
        })}

        <Text style={styles.section}>{zh.route.routes}</Text>
        {state.routes.length === 0 && <Text style={styles.muted}>{zh.route.emptyRoute}</Text>}
        {state.routes.map((route) => renderRoute(route))}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{zh.route.renameTitle}</Text>
            <TextInput
              autoFocus
              value={editing?.value ?? ''}
              onChangeText={(value) =>
                setEditing((previous) => (previous === null ? null : { ...previous, value }))
              }
              placeholder={zh.route.renamePlaceholder}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              onSubmitEditing={saveRename}
            />
            <View style={styles.dialogActions}>
              <ActionButton variant="outline" label={zh.route.cancel} onPress={() => setEditing(null)} />
              <ActionButton label={zh.route.save} disabled={editing?.value.trim() === ''} onPress={saveRename} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  function renderRoute(route: Route) {
    const ordered = orderedWaypoints(route, state.waypoints);
    const isSessionRoute = lockedRoute?.id === route.id;
    const crossRouteLocked = sessionActive && !isSessionRoute;
    const isActiveLeg = isSessionRoute && guidance.leg.to !== null;
    const legLabel = route.legKind === LegKind.RHUMB ? zh.route.rhumb : zh.route.greatCircle;

    return (
      <View style={styles.cardColumn} key={route.id}>
        <View style={styles.cardHeader}>
          <Text style={styles.name}>
            {route.name}
            {route.id === state.activeRouteId ? ` · ${zh.route.active}` : ''}
            {isSessionRoute ? ` · ${statusLabel}` : ''}
          </Text>
          <Text style={styles.muted}>
            {zh.route.distance.replace('{{distance}}', routeDistance(route, state.waypoints).toFixed(2))}
          </Text>
        </View>

        <View style={styles.nodes}>
          {ordered.map((waypoint, index) => (
            <View style={styles.nodeRow} key={waypoint.id}>
              <Text style={styles.nodeName}>
                {index + 1}. {waypoint.name}
              </Text>
              <View style={styles.actions}>
                <ActionButton
                  compact
                  variant="outline"
                  label={zh.nav.moveUp}
                  disabled={isSessionRoute || index === 0}
                  onPress={() => state.moveRouteNode(route.id, waypoint.id, -1)}
                />
                <ActionButton
                  compact
                  variant="outline"
                  label={zh.nav.moveDown}
                  disabled={isSessionRoute || index === ordered.length - 1}
                  onPress={() => state.moveRouteNode(route.id, waypoint.id, 1)}
                />
                <ActionButton
                  compact
                  variant="danger"
                  label={zh.nav.removeNode}
                  disabled={isSessionRoute || ordered.length < 2}
                  onPress={() => state.removeRouteNode(route.id, waypoint.id)}
                />
              </View>
            </View>
          ))}
        </View>

        {isActiveLeg && guidance.leg.to !== null && (
          <View style={styles.guidance}>
            <Text style={styles.guidanceText}>
              {zh.nav.next}：{guidance.leg.to.name}
            </Text>
            <Text style={styles.guidanceText}>
              {zh.nav.nextDistance}：{nauticalMiles(guidance.leg.nextDistanceNauticalMiles)}
            </Text>
            <Text style={styles.guidanceText}>
              {zh.nav.remaining}：{nauticalMiles(guidance.leg.remainingDistanceNauticalMiles)} ·{' '}
              {arrivalText()}
            </Text>
          </View>
        )}

        {isSessionRoute && sessionSimulation && (
          <View style={styles.speedRow}>
            <Text style={styles.guidanceText}>
              {zh.nav.simulationSpeed}：{navigation.simulationSpeedKnots.toFixed(0)} kn
            </Text>
            <View style={styles.actions}>
              <ActionButton
                compact
                variant="outline"
                label="-1"
                disabled={navigation.simulationSpeedKnots <= 0}
                onPress={() => state.setSimulationSpeed(navigation.simulationSpeedKnots - 1)}
              />
              <ActionButton
                compact
                variant="outline"
                label="+1"
                disabled={navigation.simulationSpeedKnots >= 40}
                onPress={() => state.setSimulationSpeed(navigation.simulationSpeedKnots + 1)}
              />
            </View>
          </View>
        )}

        <View style={styles.footer}>
          {!isSessionRoute && (
            <ActionButton
              label={zh.route.activate}
              disabled={crossRouteLocked}
              onPress={() => state.activateRoute(route.id)}
            />
          )}
          {!isSessionRoute && !crossRouteLocked && (
            <>
              <ActionButton
                label={zh.nav.startReal}
                disabled={!guidance.canStartRealNavigation}
                onPress={() => state.startRealNavigation(route.id)}
              />
              <ActionButton
                variant="outline"
                label={zh.nav.startSimulation}
                onPress={() => state.startSimulationNavigation(route.id)}
              />
            </>
          )}
          {navigation.status === 'running' && isSessionRoute && (
            <ActionButton label={zh.nav.pause} onPress={state.pauseNavigation} />
          )}
          {navigation.status === 'paused' && isSessionRoute && (
            <ActionButton label={zh.nav.resume} onPress={state.resumeNavigation} />
          )}
          {isSessionRoute && (
            <ActionButton variant="outline" label={zh.nav.end} onPress={state.endNavigation} />
          )}
          <ActionButton
            variant="outline"
            label={legLabel}
            disabled={isSessionRoute || crossRouteLocked}
            onPress={() => state.setLegKind(route.id, nextLegKind(route.legKind))}
          />
        </View>
      </View>
    );
  }

  function arrivalText(): string {
    const arrival = guidance.arrival;
    if (arrival === null) return zh.instrument.unknown;
    if (arrival.status === 'STOPPED') return zh.instrument.stopped;
    return zh.instrument.hours.replace('{{value}}', arrival.hours.toFixed(1));
  }
}

function nauticalMiles(value: number): string {
  return zh.instrument.nauticalMiles.replace('{{value}}', value.toFixed(2));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 120, gap: 10 },
  hint: { fontSize: 12, color: '#64748b' },
  section: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 6 },
  muted: { fontSize: 12, color: '#64748b' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  cardBody: { flex: 1, gap: 2 },
  cardColumn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  cardHeader: { gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  nodes: { gap: 6 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nodeName: { flexShrink: 1, fontSize: 13, color: '#0f172a' },
  guidance: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  guidanceText: { fontSize: 13, color: '#0f172a' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { width: '100%', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, gap: 12 },
  dialogTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
