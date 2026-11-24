import { emptyCollection } from '@navigation/core'

type FeatureCollection = ReturnType<typeof emptyCollection>

/**
 * 海图图层纯数据契约：航点、当前航线、当前航段、轨迹与本船。
 * 只描述地图要画什么，不含相机、跟随、图层开关等平台界面状态。
 * Tauri（MapLibre GL JS）与 React Native（MapLibre Native）消费同一份投影。
 */
export interface ChartLayers {
  track: FeatureCollection
  route: FeatureCollection
  leg: FeatureCollection
  waypoints: FeatureCollection
  ownShip: FeatureCollection
}
