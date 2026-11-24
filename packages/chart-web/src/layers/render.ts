import type { FeatureCollection, Geometry } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap, Source } from 'maplibre-gl'
import { SOURCE_LEG, SOURCE_OWN_SHIP, SOURCE_ROUTE, SOURCE_TRACK, SOURCE_WAYPOINTS } from './sources'

/**
 * 应用状态投影到地图的纯数据快照；相机跟随是唯一 Web 端状态。
 * 图层字段与 @navigation/app 的 ChartLayers 投影保持一致，业务状态不进入地图层。
 */
export interface ChartSnapshot {
  track: FeatureCollection
  route: FeatureCollection
  leg: FeatureCollection
  waypoints: FeatureCollection
  ownShip: FeatureCollection
  follow: boolean
}

function isGeoJsonSource(source: Source): source is GeoJSONSource {
  return source.type === 'geojson'
}

function writeSource(map: MapLibreMap, id: string, data: FeatureCollection): void {
  const source = map.getSource(id)
  if (!source || !isGeoJsonSource(source)) {
    return
  }
  source.setData(data)
}

function ownShipCoordinates(collection: FeatureCollection): [number, number] | null {
  const feature = collection.features.find((item) => item.properties?.kind === 'ship')
  if (!feature || feature.geometry.type !== 'Point') {
    return null
  }
  const coordinates = feature.geometry.coordinates as [number, number]
  return [coordinates[0], coordinates[1]]
}

/** 将快照批量写入对应 source；跟随开启且本船已定位时平移相机。 */
export function renderSnapshot(map: MapLibreMap, snapshot: ChartSnapshot): void {
  writeSource(map, SOURCE_TRACK, snapshot.track)
  writeSource(map, SOURCE_ROUTE, snapshot.route)
  writeSource(map, SOURCE_WAYPOINTS, snapshot.waypoints)
  writeSource(map, SOURCE_OWN_SHIP, snapshot.ownShip)
  writeSource(map, SOURCE_LEG, snapshot.leg)

  if (snapshot.follow) {
    const coordinates = ownShipCoordinates(snapshot.ownShip)
    if (coordinates) {
      map.easeTo({ center: coordinates, duration: 300 })
    }
  }
}

export type { Geometry }
