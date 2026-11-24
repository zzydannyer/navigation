import { FixStatus, arrivalEstimate, crossTrackError, measureLeg } from '@navigation/core'
import type { Arrival, CrossTrack } from '@navigation/core'
import type {
  NavigationMode,
  NavigationSessionStatus,
  NavigationState,
} from './createNavigationStore'
import { hasFreshRealFix } from './fixFreshness'
import { selectActiveLeg, type ActiveLegSelection } from './selectActiveLeg'

/**
 * 两端共用的航行制导读数：当前航段、下一航点、方位、偏航、航速与 ETA。
 * 所有派生只读状态，不写 store；模拟与真实导航用同一套几何函数。
 */
export interface NavigationGuidance {
  leg: ActiveLegSelection
  status: NavigationSessionStatus
  mode: NavigationMode
  sessionActive: boolean
  /** ETA 使用的航速：模拟会话用模拟航速，其余用当前船位航速。 */
  speedKnots: number
  bearingDegrees: number | null
  crossTrack: CrossTrack | null
  arrival: Arrival | null
  canStartRealNavigation: boolean
  hasRealFix: boolean
}

export function selectNavigationGuidance(
  state: NavigationState,
  nowIso: string = new Date().toISOString(),
): NavigationGuidance {
  const leg = selectActiveLeg(state)
  const nav = state.navigation
  const sessionActive = nav.status === 'running' || nav.status === 'paused'
  const vessel = state.ownShip.status === FixStatus.FIXED ? state.ownShip : null
  const speedKnots =
    sessionActive && nav.mode === 'simulation' ? nav.simulationSpeedKnots : state.ownShip.speedKnots

  const bearingDegrees =
    vessel !== null && leg.to !== null && leg.legKind !== null
      ? measureLeg(vessel.position, leg.to.position, leg.legKind).bearingDegrees
      : null
  const crossTrack =
    vessel !== null && leg.from !== null && leg.to !== null && leg.legKind !== null
      ? crossTrackError(vessel.position, leg.from.position, leg.to.position, leg.legKind)
      : null
  const arrival =
    leg.to !== null
      ? arrivalEstimate(leg.remainingDistanceNauticalMiles, speedKnots, nowIso)
      : null

  return {
    leg,
    status: nav.status,
    mode: nav.mode,
    sessionActive,
    speedKnots,
    bearingDegrees,
    crossTrack,
    arrival,
    canStartRealNavigation: !sessionActive && hasFreshRealFix(state, nowIso),
    hasRealFix: state.realFix !== null && state.realFix.status === FixStatus.FIXED,
  }
}
