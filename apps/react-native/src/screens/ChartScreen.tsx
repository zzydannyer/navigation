import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chartDisplayShip,
  chartToolChrome,
  chartToolSelected,
  chartTools,
  chartView,
  FixStatus,
  zh,
} from '@navigation/core';
import { projectChartLayers } from '@navigation/app';
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { chartToolIcons } from '../chart/toolIcons';
import { useNavigationStore } from '../store';

const shipImages = { 'own-ship-arrow': require('../../../../assets/marine/own-ship.png') };

interface ChartScreenProps {
  granted: boolean;
  showToolbar: boolean;
}

/**
 * 原生海图：长按加航点，显示航点、当前航线、当前航段、历史轨迹和本船参考圈。
 * 图层来自 @navigation/app 的共享投影；相机跟随与图层开关只存在本端。
 */
export function ChartScreen({ granted, showToolbar }: ChartScreenProps) {
  const state = useNavigationStore();
  const camera = useRef<CameraRef>(null);
  const [follow, setFollow] = useState(false);
  const [rings, setRings] = useState(true);
  const [vectors, setVectors] = useState(true);
  const [zoom, setZoom] = useState(chartView.zoom);

  const ship = chartDisplayShip(state.ownShip);
  const fixed = ship.status === FixStatus.FIXED;
  const simulation =
    state.navigation.mode === 'simulation' && state.navigation.status !== 'idle';
  const realCached = state.realFix !== null && state.realFix.status === FixStatus.FIXED;

  const layers = useMemo(
    () => projectChartLayers(state, { ownShip: ship, rings, vectors }),
    [state, ship, rings, vectors],
  );

  useEffect(() => {
    if (follow && ship.status === FixStatus.FIXED) {
      camera.current?.easeTo({
        center: [ship.position.longitude, ship.position.latitude],
        duration: 300,
      });
    }
  }, [follow, ship]);

  function addWaypointAt(longitude: number, latitude: number) {
    if (state.hydration !== 'ready') return;
    const name = zh.route.waypointName.replace('{{index}}', String(state.waypoints.length + 1));
    state.addWaypoint({ latitude, longitude }, name);
  }

  function locate() {
    if (ship.status !== FixStatus.FIXED) {
      Alert.alert('尚未定位', '请允许定位，并等待设备返回有效位置。');
      return;
    }
    camera.current?.easeTo({
      center: [ship.position.longitude, ship.position.latitude],
      zoom: chartView.zoom,
      duration: 400,
    });
  }

  function runTool(id: (typeof chartTools)[number]['id']) {
    if (id === 'locate') {
      locate();
      return;
    }
    if (id === 'follow') {
      setFollow((value) => !value);
      return;
    }
    if (id === 'rings') {
      setRings((value) => !value);
      return;
    }
    if (id === 'vectors') {
      setVectors((value) => !value);
      return;
    }
    if (id === 'north') {
      camera.current?.setStop({ bearing: chartView.bearing, pitch: 0, duration: 300 });
      return;
    }
    if (id === 'zoomIn') {
      camera.current?.zoomTo(Math.min(20, zoom + 1));
      return;
    }
    camera.current?.zoomTo(Math.max(0, zoom - 1));
  }

  const title = !granted
    ? zh.chart.denied
    : simulation
      ? zh.nav.modeSimulation
      : fixed
        ? zh.chart.fixedGps
        : zh.chart.waitingFix;

  const toolLabel = (id: (typeof chartTools)[number]['id']) => {
    if (id === 'follow' && follow) return zh.chart.following;
    if (id === 'locate') return zh.chart.locate;
    if (id === 'follow') return zh.chart.follow;
    if (id === 'rings') return zh.chart.rings;
    if (id === 'vectors') return zh.chart.vectors;
    if (id === 'north') return zh.chart.northUp;
    if (id === 'zoomIn') return zh.chart.zoomIn;
    return zh.chart.zoomOut;
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        testID="chart-map"
        style={styles.map}
        mapStyle={chartView.styleUrl}
        onLongPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          addWaypointAt(longitude, latitude);
        }}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) setFollow(false);
        }}
        onRegionDidChange={(event) => setZoom(event.nativeEvent.zoom)}
      >
        <Camera
          ref={camera}
          initialViewState={{
            center: [chartView.longitude, chartView.latitude],
            zoom: chartView.zoom,
            bearing: chartView.bearing,
          }}
        />
        <Images images={shipImages} />

        <GeoJSONSource id="track" data={layers.track} />
        <Layer
          id="track-line"
          type="line"
          source="track"
          paint={{ 'line-color': '#7eb6ff', 'line-width': 3 }}
        />

        <GeoJSONSource id="route" data={layers.route} />
        <Layer
          id="route-line"
          type="line"
          source="route"
          paint={{ 'line-color': '#f5c16c', 'line-width': 4 }}
        />

        <GeoJSONSource id="leg" data={layers.leg} />
        <Layer
          id="leg-line"
          type="line"
          source="leg"
          paint={{ 'line-color': '#3dd6c6', 'line-width': 5 }}
        />

        <GeoJSONSource id="waypoints" data={layers.waypoints} />
        <Layer
          id="waypoint-circle"
          type="circle"
          source="waypoints"
          paint={{
            'circle-radius': 6,
            'circle-color': '#7eb6ff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />

        <GeoJSONSource id="own-ship" data={layers.ownShip} />
        <Layer
          id="own-ship-rings"
          type="line"
          source="own-ship"
          filter={['in', ['get', 'kind'], ['literal', ['ring', 'axis']]]}
          paint={{ 'line-color': '#2563eb', 'line-width': 1, 'line-opacity': 0.65 }}
        />
        <Layer
          id="own-ship-sector"
          type="fill"
          source="own-ship"
          filter={['==', ['get', 'kind'], 'sector']}
          paint={{ 'fill-color': '#16a34a', 'fill-opacity': 0.15 }}
        />
        <Layer
          id="own-ship-vectors"
          type="line"
          source="own-ship"
          filter={['in', ['get', 'kind'], ['literal', ['heading', 'course']]]}
          paint={{
            'line-color': ['match', ['get', 'kind'], 'heading', '#16a34a', '#ea580c'],
            'line-width': 2,
            'line-dasharray': [3, 2],
          }}
        />
        <Layer
          id="own-ship-labels"
          type="symbol"
          source="own-ship"
          filter={['==', ['get', 'kind'], 'label']}
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-offset': [0.5, 0.5],
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': '#1d4ed8', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }}
        />
        <Layer
          id="own-ship-arrow"
          type="symbol"
          source="own-ship"
          filter={['==', ['get', 'kind'], 'ship']}
          layout={{
            'icon-image': 'own-ship-arrow',
            'icon-size': 0.65,
            'icon-rotate': ['get', 'bearing'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
      </Map>

      <View style={styles.readout} pointerEvents="none">
        <Text style={styles.title}>{title}</Text>
        {fixed && ship.status === FixStatus.FIXED && (
          <>
            <Text style={styles.value}>
              {ship.position.latitude.toFixed(5)}°, {ship.position.longitude.toFixed(5)}°
            </Text>
            <Text style={styles.value}>
              {ship.speedKnots.toFixed(1)} kn · COG {ship.courseDegrees.toFixed(0)}°
            </Text>
          </>
        )}
        <Text style={styles.title}>{zh.chart.rangeHint}</Text>
        {rings && !fixed && <Text style={styles.title}>{zh.chart.ringsWaiting}</Text>}
        {simulation && realCached && <Text style={styles.title}>{zh.nav.realFixCached}</Text>}
        <Text style={styles.hint}>{zh.chart.longPressHint}</Text>
      </View>

      {showToolbar && (
        <View style={styles.controls}>
          {chartTools.map((tool) => {
            const selected = chartToolSelected(tool.id, { follow, rings, vectors });
            return (
              <Pressable
                key={tool.id}
                accessibilityRole="button"
                accessibilityLabel={toolLabel(tool.id)}
                accessibilityState={{ selected }}
                style={[styles.tool, selected && styles.toolActive]}
                onPress={() => runTool(tool.id)}
              >
                <Image source={chartToolIcons[tool.id]} style={styles.toolIcon} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  controls: { position: 'absolute', right: 12, top: 160, gap: 6 },
  tool: {
    backgroundColor: chartToolChrome.background,
    borderColor: chartToolChrome.border,
    borderRadius: 8,
    borderWidth: 1,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: {
    backgroundColor: chartToolChrome.activeBackground,
    borderColor: chartToolChrome.activeBorder,
  },
  toolIcon: { width: 22, height: 22 },
  readout: {
    position: 'absolute',
    top: 48,
    left: 16,
    maxWidth: '62%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    gap: 1,
  },
  title: { fontSize: 12, color: '#475569' },
  value: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  hint: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
