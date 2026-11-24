import { destination, point, rhumbDestination } from '@turf/turf'
import { Position } from '../domain/position'
import { LegKind } from '../domain/route'
import { Waypoint } from '../domain/waypoint'
import { ARRIVAL_RADIUS_NAUTICAL_MILES, measureLeg } from '../geo/navigation'

export type NavigationEventType = 'ARRIVAL_WAYPOINT' | 'ROUTE_COMPLETE'

export interface NavigationEvent {
  type: NavigationEventType
  waypointId: string
  index: number
}

export interface SimulationProgress {
  /** 当前航段目标航点在有序航点列表中的下标。 */
  activeIndex: number
  position: Position
}

export interface SimulationStepInput {
  waypoints: Waypoint[]
  progress: SimulationProgress
  speedKnots: number
  elapsedSeconds: number
  legKind: LegKind
}

export interface SimulationStepResult {
  position: Position
  courseDegrees: number
  activeIndex: number
  finished: boolean
  events: NavigationEvent[]
}

function advanceAlong(
  origin: Position,
  traveledNauticalMiles: number,
  legKind: LegKind,
  bearingDegrees: number,
): Position {
  const originPoint = point([origin.longitude, origin.latitude])
  const next =
    legKind === LegKind.RHUMB
      ? rhumbDestination(originPoint, traveledNauticalMiles, bearingDegrees, {
          units: 'nauticalmiles',
        })
      : destination(originPoint, traveledNauticalMiles, bearingDegrees, {
          units: 'nauticalmiles',
        })
  const [nextLongitude, nextLatitude] = next.geometry.coordinates
  return { latitude: nextLatitude, longitude: nextLongitude }
}

/**
 * 纯函数模拟推进：按航速与经过秒数沿航段前进，不开启 timer、不写轨迹。
 * 一次步进可跨越多个航段，剩余里程继续消耗并按序输出到点事件；
 * RHUMB 走恒向线推算，GREAT_CIRCLE 走大圆推算；零速度不推进且不判完成。
 */
export function stepSimulation(input: SimulationStepInput): SimulationStepResult {
  const { waypoints, progress, speedKnots, elapsedSeconds, legKind } = input
  const events: NavigationEvent[] = []

  if (waypoints.length < 2) {
    return {
      position: progress.position,
      courseDegrees: 0,
      activeIndex: progress.activeIndex,
      finished: true,
      events,
    }
  }

  const lastIndex = waypoints.length - 1
  const activeIndex = Math.min(Math.max(progress.activeIndex, 1), lastIndex)
  const traveled = Math.max(0, speedKnots) * (Math.max(0, elapsedSeconds) / 3600)

  if (traveled <= 0) {
    const target = waypoints[activeIndex]!
    const courseDegrees = measureLeg(progress.position, target.position, legKind).bearingDegrees
    return {
      position: progress.position,
      courseDegrees,
      activeIndex,
      finished: false,
      events,
    }
  }

  let position = progress.position
  let currentIndex = activeIndex
  let leftover = traveled
  let finished = false

  for (;;) {
    const target = waypoints[currentIndex]!
    const remaining = measureLeg(position, target.position, legKind).distanceNauticalMiles

    if (remaining <= ARRIVAL_RADIUS_NAUTICAL_MILES) {
      // 已进入到点半径：吸附目标、记到点事件并推进下一节点，不因 leftover 不足而滞留。
      events.push({ type: 'ARRIVAL_WAYPOINT', waypointId: target.id, index: currentIndex })
      position = target.position
      leftover = Math.max(0, leftover - remaining)
      if (currentIndex === lastIndex) {
        events.push({ type: 'ROUTE_COMPLETE', waypointId: target.id, index: currentIndex })
        finished = true
        break
      }
      currentIndex += 1
      continue
    }

    if (leftover >= remaining) {
      // 本段可走完：消耗该段里程，到点后继续下一段。
      events.push({ type: 'ARRIVAL_WAYPOINT', waypointId: target.id, index: currentIndex })
      leftover -= remaining
      position = target.position
      if (currentIndex === lastIndex) {
        events.push({ type: 'ROUTE_COMPLETE', waypointId: target.id, index: currentIndex })
        finished = true
        break
      }
      currentIndex += 1
      continue
    }

    // leftover 不足走完本段：沿当前段移动 leftover 后退出循环。
    break
  }

  if (finished) {
    return { position, courseDegrees: 0, activeIndex: currentIndex, finished, events }
  }

  const target = waypoints[currentIndex]!
  const metrics = measureLeg(position, target.position, legKind)
  const courseDegrees = metrics.bearingDegrees
  if (leftover > 0) {
    const moved = Math.min(leftover, metrics.distanceNauticalMiles)
    position = advanceAlong(position, moved, legKind, courseDegrees)
  }

  return { position, courseDegrees, activeIndex: currentIndex, finished, events }
}
