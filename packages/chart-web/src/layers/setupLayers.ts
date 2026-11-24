import type { FeatureCollection } from 'geojson'
import { Map as MapLibreMap } from 'maplibre-gl'
import {
  SOURCE_LEG,
  SOURCE_OWN_SHIP,
  SOURCE_ROUTE,
  SOURCE_TRACK,
  SOURCE_WAYPOINTS,
} from './sources'

const emptyCollection = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

function addSourceIfMissing(map: MapLibreMap, id: string): void {
  if (map.getSource(id)) {
    return
  }
  map.addSource(id, { type: 'geojson', data: emptyCollection() })
}

function addLayerIfMissing(
  map: MapLibreMap,
  layer: NonNullable<Parameters<MapLibreMap['addLayer']>[0]>,
): void {
  if (map.getLayer(layer.id as string)) {
    return
  }
  map.addLayer(layer)
}

/**
 * 在 style 加载完成后创建业务 source 与图层。幂等：样式重载后重复调用不会报错，
 * 已存在的 source/layer 直接跳过。只负责地图侧装配，不读取应用状态。
 */
export function setupChartLayers(map: MapLibreMap): void {
  addSourceIfMissing(map, SOURCE_TRACK)
  addSourceIfMissing(map, SOURCE_ROUTE)
  addSourceIfMissing(map, SOURCE_LEG)
  addSourceIfMissing(map, SOURCE_WAYPOINTS)
  addSourceIfMissing(map, SOURCE_OWN_SHIP)

  addLayerIfMissing(map, {
    id: 'track-line',
    type: 'line',
    source: SOURCE_TRACK,
    paint: { 'line-color': '#7eb6ff', 'line-width': 3 },
  })
  addLayerIfMissing(map, {
    id: 'route-line',
    type: 'line',
    source: SOURCE_ROUTE,
    paint: { 'line-color': '#f5c16c', 'line-width': 4 },
  })
  addLayerIfMissing(map, {
    id: 'leg-line',
    type: 'line',
    source: SOURCE_LEG,
    paint: { 'line-color': '#3dd6c6', 'line-width': 5 },
  })
  addLayerIfMissing(map, {
    id: 'waypoint-circle',
    type: 'circle',
    source: SOURCE_WAYPOINTS,
    paint: {
      'circle-radius': 6,
      'circle-color': '#7eb6ff',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })
  addLayerIfMissing(map, {
    id: 'own-ship-rings',
    type: 'line',
    source: SOURCE_OWN_SHIP,
    filter: ['in', ['get', 'kind'], ['literal', ['ring', 'axis']]],
    paint: { 'line-color': '#2563eb', 'line-width': 1, 'line-opacity': 0.65 },
  })
  addLayerIfMissing(map, {
    id: 'own-ship-sector', type: 'fill', source: SOURCE_OWN_SHIP,
    filter: ['==', ['get', 'kind'], 'sector'],
    paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.15 },
  })
  addLayerIfMissing(map, {
    id: 'own-ship-vectors', type: 'line', source: SOURCE_OWN_SHIP,
    filter: ['in', ['get', 'kind'], ['literal', ['heading', 'course']]],
    paint: { 'line-color': ['match', ['get', 'kind'], 'heading', '#16a34a', '#ea580c'], 'line-width': 2, 'line-dasharray': [3, 2] },
  })
  addLayerIfMissing(map, {
    id: 'own-ship-labels', type: 'symbol', source: SOURCE_OWN_SHIP,
    filter: ['==', ['get', 'kind'], 'label'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0.5, 0.5], 'text-allow-overlap': true },
    paint: { 'text-color': '#1d4ed8', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
  })
  addLayerIfMissing(map, {
    id: 'own-ship-arrow', type: 'symbol', source: SOURCE_OWN_SHIP,
    filter: ['==', ['get', 'kind'], 'ship'],
    layout: { 'icon-image': 'own-ship-arrow', 'icon-size': 0.65, 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  })
}
