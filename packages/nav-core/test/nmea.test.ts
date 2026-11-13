import { describe, expect, it } from 'vitest'
import { NmeaKind, parseNmea } from '../src/nmea/parse'

// Computed checksum 6A for body "GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"
const validRmc = '$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A'

describe('parseNmea', () => {
  it('parses a valid RMC sentence into a FIX with position and speed', () => {
    const result = parseNmea(validRmc)
    expect(result.kind).toBe(NmeaKind.FIX)
    if (result.kind === NmeaKind.FIX) {
      expect(result.position.latitude).toBeCloseTo(48.1173, 3)
      expect(result.position.longitude).toBeCloseTo(11.5167, 3)
      expect(result.speedKnots).toBeGreaterThan(0)
      expect(result.courseDegrees).toBeGreaterThan(0)
    }
  })

  it('returns IGNORED for a sentence with a bad checksum', () => {
    const bad = validRmc.slice(0, -3) + 'XX'
    const result = parseNmea(bad)
    expect(result.kind).toBe(NmeaKind.IGNORED)
  })

  it('returns IGNORED for a sentence missing the checksum delimiter', () => {
    const result = parseNmea('$GPRMC,123519,A,4807.038,N')
    expect(result.kind).toBe(NmeaKind.IGNORED)
  })

  it('returns IGNORED for an unsupported sentence type', () => {
    // GLL with a correct checksum over the given body
    const result = parseNmea('$GPGLL,4807.038,N,01131.000,E,123519,A*4F')
    expect(result.kind).toBe(NmeaKind.IGNORED)
  })
})
