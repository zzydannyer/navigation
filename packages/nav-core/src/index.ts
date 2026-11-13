export { NoticeKey } from './domain/notice'
export {
  FixStatus,
  HeadingStatus,
  initialOwnShip,
  withHeading,
  withMotion,
} from './domain/ownShip'
export type { GpsFix, Heading, HeadingKnown, HeadingUnknown, OwnShip, OwnShipFixed, OwnShipNoFix } from './domain/ownShip'
export type { Position } from './domain/position'
export { LegKind, nextLegKind } from './domain/route'
export type { Route } from './domain/route'
export { recordTrackPoint, TRACK_MIN_NAUTICAL_MILES, TRACK_POINT_LIMIT } from './domain/track'
export type { Track, TrackPoint } from './domain/track'
export type { Waypoint } from './domain/waypoint'
export {
  emptyCollection,
  lineCollection,
  pointCollection,
  routeCollection,
  trackCollection,
  waypointCollection,
} from './geo/feature'
export type { NamedPoint } from './geo/feature'
export { courseFromDegrees, headingFromDegrees, metersPerSecondToKnots } from './geo/motion'
export {
  ActiveLegStatus,
  ARRIVAL_RADIUS_NAUTICAL_MILES,
  ArrivalStatus,
  arrivalEstimate,
  crossTrackError,
  measureLeg,
  normalizeBearing,
  orderedWaypoints,
  resolveActiveLeg,
  routeDistance,
  SteerSide,
} from './geo/navigation'
export type {
  ActiveLegActive,
  ActiveLegNone,
  ActiveLegResult,
  Arrival,
  ArrivalMoving,
  ArrivalStopped,
  CrossTrack,
  LegMetrics,
} from './geo/navigation'
export { en } from './i18n/en'
export { zh } from './i18n/zh'
export { NmeaKind, parseNmea } from './nmea/parse'
export type { NmeaFix, NmeaHeading, NmeaIgnored, NmeaMotion, NmeaPosition, NmeaResult } from './nmea/parse'
export { createNavigationStore, LocationPermissionStatus } from './store/createNavigationStore'
export type { NavigationStorage } from './store/createNavigationStore'
