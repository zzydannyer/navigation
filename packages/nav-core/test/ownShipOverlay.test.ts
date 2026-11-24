import { describe, expect, it } from 'vitest'
import { distance } from '@turf/turf'
import { buildOwnShipOverlay } from '../src/geo/ownShipOverlay'
import { FixStatus, HeadingStatus, initialOwnShip, type OwnShipFixed } from '../src/domain/ownShip'

const ship: OwnShipFixed = {
  status: FixStatus.FIXED, position: { longitude: 122, latitude: 70 },
  speedKnots: 10, courseDegrees: 90, heading: { status: HeadingStatus.KNOWN, degrees: 350 }, timestamp: '2026-11-18T00:00:00Z',
}
describe('shared own ship geometry', () => {
  it('does not invent a position without a fix', () => {
    expect(buildOwnShipOverlay(initialOwnShip).features).toEqual([])
  })
  it('preserves true nautical mile radii at high latitude', () => {
    const rings = buildOwnShipOverlay(ship).features.filter(f => f.properties?.kind === 'ring')
    expect(rings).toHaveLength(2)
    for (const ring of rings) {
      if (ring.geometry.type !== 'LineString') throw new Error('expected ring line')
      expect(ring.geometry.coordinates).toHaveLength(129)
      for (const coordinate of ring.geometry.coordinates) {
        expect(distance([122, 70], coordinate, { units: 'nauticalmiles' })).toBeCloseTo(ring.properties!.radius, 8)
      }
      expect(ring.geometry.coordinates[0][0]).toBeCloseTo(ring.geometry.coordinates[128][0], 10)
    }
  })
  it('uses heading first, then course, normalized clockwise from north', () => {
    expect(buildOwnShipOverlay(ship).features[0].properties?.bearing).toBe(350)
    expect(buildOwnShipOverlay({ ...ship, heading: { status: HeadingStatus.UNKNOWN }, courseDegrees: -90 }).features[0].properties?.bearing).toBe(270)
  })
  it('distinguishes heading distance from six minute course vector', () => {
    const vectors = buildOwnShipOverlay(ship).features.filter(f => ['heading', 'course'].includes(f.properties?.kind))
    expect(vectors).toHaveLength(2)
    for (const vector of vectors) {
      if (vector.geometry.type !== 'LineString') throw new Error('expected vector line')
      expect(distance(vector.geometry.coordinates[0], vector.geometry.coordinates[1], { units: 'nauticalmiles' }))
        .toBeCloseTo(vector.properties?.kind === 'course' ? 1 : 0.5, 8)
    }
  })
  it('omits unmeasured heading and stationary course vectors', () => {
    const overlay = buildOwnShipOverlay({ ...ship, speedKnots: 0, heading: { status: HeadingStatus.UNKNOWN } })
    expect(overlay.features.some(f => ['course', 'heading'].includes(f.properties?.kind))).toBe(false)
  })
  it('can independently hide rings and vectors while retaining the arrow', () => {
    expect(buildOwnShipOverlay(ship, { rings: false, vectors: false }).features).toHaveLength(1)
    expect(buildOwnShipOverlay(ship, { rings: false }).features.some(f => f.properties?.kind === 'course')).toBe(true)
    expect(buildOwnShipOverlay(ship, { vectors: false }).features.some(f => f.properties?.kind === 'ring')).toBe(true)
  })
  it('builds a closed forward sector with half mile boundary and 90 degree sweep', () => {
    const sector = buildOwnShipOverlay({ ...ship, heading: { status: HeadingStatus.KNOWN, degrees: 0 } }).features.find(f => f.properties?.kind === 'sector')!
    if (sector.geometry.type !== 'Polygon') throw new Error('expected sector polygon')
    const coordinates = sector.geometry.coordinates[0]
    expect(coordinates[0]).toEqual([122, 70])
    expect(coordinates[coordinates.length - 1]).toEqual(coordinates[0])
    for (const coordinate of coordinates.slice(1, -1)) {
      expect(distance([122, 70], coordinate, { units: 'nauticalmiles' })).toBeCloseTo(0.5, 8)
      expect(coordinate[1]).toBeGreaterThan(70)
    }
  })
})
