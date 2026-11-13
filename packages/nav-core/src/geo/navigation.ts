import { bearing, distance, point, rhumbBearing, rhumbDistance } from '@turf/turf'
import { isUndefined } from 'lodash-es'
import { Position } from '../domain/position'
import { LegKind, Route } from '../domain/route'
import { Waypoint } from '../domain/waypoint'

export const ARRIVAL_RADIUS_NAUTICAL_MILES = 0.05
const ON_TRACK_NAUTICAL_MILES = 0.01
const STOPPED_KNOTS = 0.1

export interface LegMetrics {
  distanceNauticalMiles: number
  bearingDegrees: number
}

export enum SteerSide {
  PORT = 'PORT',
  ON_TRACK = 'ON_TRACK',
  STARBOARD = 'STARBOARD',
}

export interface CrossTrack {
  distanceNauticalMiles: number
  steerSide: SteerSide
}

export enum ArrivalStatus {
  STOPPED = 'STOPPED',
  MOVING = 'MOVING',
}

export interface ArrivalStopped {
  status: ArrivalStatus.STOPPED
}

export interface ArrivalMoving {
  status: ArrivalStatus.MOVING
  hours: number
  arrivalAt: string
}

export type Arrival = ArrivalStopped | ArrivalMoving

export enum ActiveLegStatus {
  NONE = 'NONE',
  ACTIVE = 'ACTIVE',
}

export interface ActiveLegNone {
  status: ActiveLegStatus.NONE
}

export interface ActiveLegActive {
  status: ActiveLegStatus.ACTIVE
  fromWaypoint: Waypoint
  toWaypoint: Waypoint
  metrics: LegMetrics
  crossTrack: CrossTrack
  bearingDegrees: number
  distanceNauticalMiles: number
  arrival: Arrival
}

export type ActiveLegResult = ActiveLegNone | ActiveLegActive

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

export function normalizeBearing(degrees: number) {
  const wrapped = degrees % 360
  if (wrapped >= 0) {
    return wrapped
  }
  return wrapped + 360
}

export function measureLeg(origin: Position, target: Position, legKind: LegKind): LegMetrics {
  const originPoint = point([origin.longitude, origin.latitude])
  const targetPoint = point([target.longitude, target.latitude])
  if (legKind === LegKind.RHUMB) {
    return {
      distanceNauticalMiles: rhumbDistance(originPoint, targetPoint, { units: 'nauticalmiles' }),
      bearingDegrees: normalizeBearing(rhumbBearing(originPoint, targetPoint)),
    }
  }
  return {
    distanceNauticalMiles: distance(originPoint, targetPoint, { units: 'nauticalmiles' }),
    bearingDegrees: normalizeBearing(bearing(originPoint, targetPoint)),
  }
}

export function crossTrackError(
  vessel: Position,
  start: Position,
  end: Position,
  legKind: LegKind,
): CrossTrack {
  const toVessel = measureLeg(start, vessel, legKind)
  const alongLeg = measureLeg(start, end, legKind)
  const signed =
    toVessel.distanceNauticalMiles *
    Math.sin(toRadians(toVessel.bearingDegrees - alongLeg.bearingDegrees))
  const magnitude = Math.abs(signed)
  if (magnitude < ON_TRACK_NAUTICAL_MILES) {
    return { distanceNauticalMiles: magnitude, steerSide: SteerSide.ON_TRACK }
  }
  if (signed > 0) {
    return { distanceNauticalMiles: magnitude, steerSide: SteerSide.STARBOARD }
  }
  return { distanceNauticalMiles: magnitude, steerSide: SteerSide.PORT }
}

export function arrivalEstimate(
  distanceNauticalMiles: number,
  speedKnots: number,
  now: string,
): Arrival {
  if (speedKnots < STOPPED_KNOTS) {
    return { status: ArrivalStatus.STOPPED }
  }
  const hours = distanceNauticalMiles / speedKnots
  return {
    status: ArrivalStatus.MOVING,
    hours,
    arrivalAt: new Date(Date.parse(now) + hours * 3600000).toISOString(),
  }
}

function activeLegFrom(
  vessel: Position,
  start: Waypoint,
  end: Waypoint,
  legKind: LegKind,
  speedKnots: number,
  now: string,
): ActiveLegActive {
  const toward = measureLeg(vessel, end.position, legKind)
  return {
    status: ActiveLegStatus.ACTIVE,
    fromWaypoint: start,
    toWaypoint: end,
    metrics: measureLeg(start.position, end.position, legKind),
    crossTrack: crossTrackError(vessel, start.position, end.position, legKind),
    bearingDegrees: toward.bearingDegrees,
    distanceNauticalMiles: toward.distanceNauticalMiles,
    arrival: arrivalEstimate(toward.distanceNauticalMiles, speedKnots, now),
  }
}

export function resolveActiveLeg(
  vessel: Position,
  waypoints: Waypoint[],
  legKind: LegKind,
  speedKnots: number,
  now: string,
): ActiveLegResult {
  if (waypoints.length < 2) {
    return { status: ActiveLegStatus.NONE }
  }
  const lastLegIndex = waypoints.length - 2
  let legIndex = 0
  while (legIndex < lastLegIndex) {
    const start = waypoints[legIndex]
    const end = waypoints[legIndex + 1]
    if (isUndefined(start) || isUndefined(end)) {
      return { status: ActiveLegStatus.NONE }
    }
    const remaining = measureLeg(vessel, end.position, legKind)
    if (remaining.distanceNauticalMiles > ARRIVAL_RADIUS_NAUTICAL_MILES) {
      return activeLegFrom(vessel, start, end, legKind, speedKnots, now)
    }
    legIndex += 1
  }
  const start = waypoints[lastLegIndex]
  const end = waypoints[lastLegIndex + 1]
  if (isUndefined(start) || isUndefined(end)) {
    return { status: ActiveLegStatus.NONE }
  }
  return activeLegFrom(vessel, start, end, legKind, speedKnots, now)
}

export function orderedWaypoints(route: Route, waypoints: Waypoint[]) {
  const ordered: Waypoint[] = []
  for (const waypointId of route.waypointIds) {
    const waypoint = waypoints.find((item) => item.id === waypointId)
    if (isUndefined(waypoint)) {
      continue
    }
    ordered.push(waypoint)
  }
  return ordered
}

export function routeDistance(route: Route, waypoints: Waypoint[]) {
  const ordered = orderedWaypoints(route, waypoints)
  let total = 0
  let index = 1
  while (index < ordered.length) {
    const start = ordered[index - 1]
    const end = ordered[index]
    if (!isUndefined(start) && !isUndefined(end)) {
      total += measureLeg(start.position, end.position, route.legKind).distanceNauticalMiles
    }
    index += 1
  }
  return total
}
