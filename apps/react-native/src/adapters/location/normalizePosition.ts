import type { GeolocationPosition } from '@maplibre/maplibre-react-native';

/** 原生 heading 是行进方向，不当作罗经船首向；速度由 m/s 转换为节。 */
export function normalizePosition(location: GeolocationPosition) {
  const { coords, timestamp } = location;
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    position: { longitude: coords.longitude, latitude: coords.latitude },
    speedKnots: coords.speed !== null && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed * 3600 / 1852 : null,
    courseDegrees: coords.heading !== null && Number.isFinite(coords.heading) && coords.heading >= 0 && coords.heading < 360 ? coords.heading : null,
    heading: null,
    timestamp: date.toISOString(),
  };
}
