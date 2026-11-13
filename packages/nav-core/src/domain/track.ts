import { isUndefined } from 'lodash-es'
import { Position } from './position'
import { LegKind } from './route'
import { measureLeg } from '../geo/navigation'

export const TRACK_MIN_NAUTICAL_MILES = 0.01
export const TRACK_POINT_LIMIT = 2000

export interface TrackPoint {
  position: Position
  timestamp: string
  speedKnots: number
  courseDegrees: number
}

export interface Track {
  id: string
  name: string
  points: TrackPoint[]
}

export function recordTrackPoint(tracks: Track[], point: TrackPoint, createId: () => string): Track[] {
  const current = tracks[0]
  if (isUndefined(current)) {
    return [
      {
        id: createId(),
        name: point.timestamp,
        points: [point],
      },
    ]
  }
  if (current.points.length > 0) {
    const lastPoint = current.points[current.points.length - 1]
    if (!isUndefined(lastPoint)) {
      const moved = measureLeg(lastPoint.position, point.position, LegKind.RHUMB)
      if (moved.distanceNauticalMiles < TRACK_MIN_NAUTICAL_MILES) {
        return tracks
      }
    }
  }
  const points = current.points.concat(point)
  const limited =
    points.length > TRACK_POINT_LIMIT ? points.slice(points.length - TRACK_POINT_LIMIT) : points
  return [{ ...current, points: limited }].concat(tracks.slice(1))
}
