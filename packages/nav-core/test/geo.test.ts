import { describe, expect, it } from 'vitest'
import {
  crossTrackError,
  measureLeg,
  normalizeBearing,
  ARRIVAL_RADIUS_NAUTICAL_MILES,
} from '../src/geo/navigation'
import { LegKind } from '../src/domain/route'

const origin = { latitude: 30.0, longitude: 122.0 }
// ~1 nautical mile north (1 minute of latitude ~= 1 nm)
const north = { latitude: 30.01667, longitude: 122.0 }

describe('normalizeBearing', () => {
  it('wraps negative degrees into [0,360)', () => {
    expect(normalizeBearing(-45)).toBe(315)
    expect(normalizeBearing(360)).toBe(0)
    expect(normalizeBearing(270)).toBe(270)
  })
})

describe('measureLeg', () => {
  it('reports near-equal rhumb and great-circle distance for a short leg', () => {
    const rhumb = measureLeg(origin, north, LegKind.RHUMB)
    const great = measureLeg(origin, north, LegKind.GREAT_CIRCLE)
    // short leg: both ~1 nm, within 5%
    expect(rhumb.distanceNauticalMiles).toBeGreaterThan(0.9)
    expect(rhumb.distanceNauticalMiles).toBeLessThan(1.1)
    expect(Math.abs(rhumb.distanceNauticalMiles - great.distanceNauticalMiles)).toBeLessThan(0.05)
    // due north bearing ~0
    expect(rhumb.bearingDegrees).toBeLessThan(1)
  })

  it('returns a finite non-negative distance for identical points', () => {
    const m = measureLeg(origin, origin, LegKind.RHUMB)
    expect(m.distanceNauticalMiles).toBeLessThan(1e-6)
  })
})

describe('crossTrackError', () => {
  it('marks a vessel exactly on the track as ON_TRACK', () => {
    const start = origin
    const end = north
    const vessel = { latitude: 30.008, longitude: 122.0 }
    const ct = crossTrackError(vessel, start, end, LegKind.RHUMB)
    expect(ct.distanceNauticalMiles).toBeLessThan(0.01)
    expect(ct.steerSide).toBe('ON_TRACK')
  })

  it('flags meaningful off-track distance beyond the on-track threshold', () => {
    const start = origin
    const end = north
    // vessel displaced ~0.01 degree east (~0.6 nm at this latitude)
    const vessel = { latitude: 30.008, longitude: 122.02 }
    const ct = crossTrackError(vessel, start, end, LegKind.RHUMB)
    expect(ct.distanceNauticalMiles).toBeGreaterThan(0.1)
  })
})

describe('arrival radius constant', () => {
  it('exposes the documented 0.05 nm arrival radius', () => {
    expect(ARRIVAL_RADIUS_NAUTICAL_MILES).toBeCloseTo(0.05)
  })
})
