import { normalizePosition } from '../src/adapters/location/normalizePosition';
import type { GeolocationPosition } from '@maplibre/maplibre-react-native';

const location: GeolocationPosition = {
  coords: { longitude: 122, latitude: 30, accuracy: 10, altitude: null, altitudeAccuracy: null, speed: 1852 / 3600, heading: 90 },
  timestamp: Date.parse('2026-11-18T00:00:00Z'),
};
test('converts m/s to knots, keeping course separate from compass heading', () => {
  expect(normalizePosition(location)).toEqual({
    position: { longitude: 122, latitude: 30 }, speedKnots: expect.closeTo(1, 10), courseDegrees: 90, heading: null,
    timestamp: '2026-11-18T00:00:00.000Z',
  });
});
test('preserves missing or unavailable motion for shared real-readings fallback', () => {
  expect(normalizePosition({ ...location, coords: { ...location.coords, speed: -1, heading: -1 } }))
    .toMatchObject({ speedKnots: null, courseDegrees: null });
  expect(normalizePosition({ ...location, coords: { ...location.coords, speed: null, heading: null } }))
    .toMatchObject({ speedKnots: null, courseDegrees: null });
});
test('rejects timestamps that cannot be converted to ISO', () => {
  expect(normalizePosition({ ...location, timestamp: NaN })).toBeNull();
  expect(normalizePosition({ ...location, timestamp: 1e20 })).toBeNull();
});
