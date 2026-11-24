import { Map as MapLibreMap } from 'maplibre-gl'

export interface ChartPick {
  longitude: number
  latitude: number
}

/** 注册地图点选；回调只回传经纬度，由应用层决定写入哪个业务 action。 */
export function attachPick(map: MapLibreMap, onPick: (pick: ChartPick) => void): void {
  map.on('click', (event) => {
    onPick({ longitude: event.lngLat.lng, latitude: event.lngLat.lat })
  })
}
