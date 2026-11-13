import { describe, expect, it } from 'vitest'
import { recordTrackPoint, TRACK_POINT_LIMIT, TRACK_MIN_NAUTICAL_MILES } from '../src/domain/track'
import type { TrackPoint } from '../src/domain/track'

let idCounter = 0
const createId = () => `id-${idCounter++}`

function pointAt(latitude: number, longitude: number, timestamp = '2026-01-01T00:00:00.000Z'): TrackPoint {
  return { position: { latitude, longitude }, timestamp, speedKnots: 0, courseDegrees: 0 }
}

describe('recordTrackPoint', () => {
  it('creates a new track when none exists', () => {
    idCounter = 0
    const tracks = recordTrackPoint([], pointAt(30, 122), createId)
    expect(tracks).toHaveLength(1)
    expect(tracks[0].points).toHaveLength(1)
  })

  it('ignores a point closer than the minimum move threshold', () => {
    idCounter = 0
    let tracks = recordTrackPoint([], pointAt(30, 122, 't1'), createId)
    // same location -> below TRACK_MIN_NAUTICAL_MILES (~0.01 nm)
    tracks = recordTrackPoint(tracks, pointAt(30, 122, 't2'), createId)
    expect(tracks[0].points).toHaveLength(1)
  })

  it('caps the active track at TRACK_POINT_LIMIT (2000) points', () => {
    idCounter = 0
    const tracks = recordTrackPoint([], pointAt(30, 122, 'start'), createId)
    // add 2005 points that each move ~0.02 nm north (>= min threshold)
    let current = tracks
    for (let i = 1; i <= 2005; i += 1) {
      current = recordTrackPoint(
        current,
        pointAt(30 + i * 0.0006, 122, `t${i}`),
        createId,
      )
    }
    expect(current[0].points.length).toBe(TRACK_POINT_LIMIT)
    // the earliest point should have been trimmed off
    expect(current[0].points[0].timestamp).not.toBe('start')
  })

  it('documents the 0.01 nm minimum move threshold', () => {
    expect(TRACK_MIN_NAUTICAL_MILES).toBeCloseTo(0.01)
    expect(TRACK_POINT_LIMIT).toBe(2000)
  })
})
