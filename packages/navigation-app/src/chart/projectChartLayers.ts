import {
  buildOwnShipOverlay,
  emptyCollection,
  lineCollection,
  routeCollection,
  trackCollection,
  waypointCollection,
} from '@navigation/core'
import type { OwnShip } from '@navigation/core'
import type { ChartLayers } from './chartLayers'
import type { NavigationState } from '../store/createNavigationStore'
import { selectActiveLeg } from '../store/selectActiveLeg'

export interface ChartProjectionOptions {
  /** 距离参考圈开关；只影响本船图层，不写回导航状态。 */
  rings?: boolean
  /** 航向/航迹向量开关；只影响本船图层，不写回导航状态。 */
  vectors?: boolean
  /** 验收用显示船位；缺省使用状态里的本船。 */
  ownShip?: OwnShip
}

/**
 * 把导航状态投影成地图可消费的纯数据：航点、当前航线、当前航段、轨迹、本船。
 * 当前航段按会话 routeId + activeIndex 派生；相机跟随与图层开关留在各端。
 */
export function projectChartLayers(
  state: NavigationState,
  options: ChartProjectionOptions = {},
): ChartLayers {
  const leg = selectActiveLeg(state)
  let legLayer = emptyCollection()
  if (leg.from !== null && leg.to !== null) {
    legLayer = lineCollection([
      [leg.from.position.longitude, leg.from.position.latitude],
      [leg.to.position.longitude, leg.to.position.latitude],
    ])
  }

  return {
    track: trackCollection(state.tracks),
    waypoints: waypointCollection(state.waypoints),
    route: leg.route === null ? emptyCollection() : routeCollection(leg.route, state.waypoints),
    leg: legLayer,
    ownShip: buildOwnShipOverlay(options.ownShip ?? state.ownShip, {
      rings: options.rings,
      vectors: options.vectors,
    }),
  }
}
