import { FixStatus, measureLeg, orderedWaypoints } from '@navigation/core'
import type { LegKind, Route, Waypoint } from '@navigation/core'
import type { NavigationState } from './createNavigationStore'

export interface ActiveLegSelection {
  routeId: string
  route: Route | null
  ordered: Waypoint[]
  from: Waypoint | null
  to: Waypoint | null
  legKind: LegKind | null
  activeIndex: number
  /** 本船到当前目标航点的距离（海里）。 */
  nextDistanceNauticalMiles: number
  /** 全程剩余距离：到当前目标 + 后续各航段累加（海里）。 */
  remainingDistanceNauticalMiles: number
}

const EMPTY: ActiveLegSelection = {
  routeId: '',
  route: null,
  ordered: [],
  from: null,
  to: null,
  legKind: null,
  activeIndex: 0,
  nextDistanceNauticalMiles: 0,
  remainingDistanceNauticalMiles: 0,
}

/**
 * 按会话 routeId + activeIndex 派生当前航段，不从船位重新推断上一航段。
 * 会话不在运行/暂停时回退到当前激活航线。
 */
export function selectActiveLeg(state: NavigationState): ActiveLegSelection {
  const nav = state.navigation
  const sessionActive = nav.status === 'running' || nav.status === 'paused'
  const routeId = sessionActive && nav.routeId !== '' ? nav.routeId : state.activeRouteId
  const route = state.routes.find((item) => item.id === routeId) ?? null
  if (route === null) {
    return EMPTY
  }
  const ordered = orderedWaypoints(route, state.waypoints)
  if (ordered.length < 2) {
    return { ...EMPTY, route, routeId, legKind: route.legKind, ordered }
  }
  const last = ordered.length - 1
  const activeIndex = Math.min(Math.max(nav.activeIndex, 1), last)
  const from = ordered[activeIndex - 1] ?? null
  const to = ordered[activeIndex] ?? null
  const vessel =
    state.ownShip.status === FixStatus.FIXED ? state.ownShip.position : from?.position ?? null
  const nextDistance =
    vessel !== null && to !== null
      ? measureLeg(vessel, to.position, route.legKind).distanceNauticalMiles
      : 0

  let remaining = nextDistance
  for (let index = activeIndex + 1; index < ordered.length; index += 1) {
    const start = ordered[index - 1]
    const end = ordered[index]
    if (start !== undefined && end !== undefined) {
      remaining += measureLeg(start.position, end.position, route.legKind).distanceNauticalMiles
    }
  }

  return {
    routeId,
    route,
    ordered,
    from,
    to,
    legKind: route.legKind,
    activeIndex,
    nextDistanceNauticalMiles: nextDistance,
    remainingDistanceNauticalMiles: remaining,
  }
}
