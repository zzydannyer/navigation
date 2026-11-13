import type { FeatureCollection, Point } from 'geojson'

// Deterministic, unclustered points within the demo's initial camera footprint.
export function stressData(count: number, tick = 0): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: Array.from({ length: count }, (_, i) => ({
    type: 'Feature', id: i,
    properties: { group: i % 4 },
    geometry: { type: 'Point', coordinates: [
      122.15 + (((i * 0.61803398875) % 1) - 0.5) * 0.009 + Math.sin(tick * 0.1 + i) * 0.00005,
      29.943 + (((i * 0.41421356237) % 1) - 0.5) * 0.005 + Math.cos(tick * 0.1 + i) * 0.00005,
    ] },
  })) }
}
