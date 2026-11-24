import { destination, lineString, point, polygon } from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import { FixStatus, HeadingStatus, type OwnShip } from '../domain/ownShip'

export interface OwnShipOverlayOptions {
  rings?: boolean
  vectors?: boolean
}

/** 本地距离参考圈，不表示已检测到其他船舶或碰撞风险。两端使用同一海里几何。 */
export function buildOwnShipOverlay(ship: OwnShip, options: OwnShipOverlayOptions = {}): FeatureCollection {
  if (ship.status !== FixStatus.FIXED) return { type: 'FeatureCollection', features: [] }
  const origin = [ship.position.longitude, ship.position.latitude]
  const at = (nm: number, bearing: number) => destination(origin, nm, bearing, { units: 'nauticalmiles' }).geometry.coordinates
  const normalize = (angle: number) => ((angle % 360) + 360) % 360
  const bearing = normalize(ship.heading.status === HeadingStatus.KNOWN ? ship.heading.degrees : ship.courseDegrees)
  const features: Feature[] = [point(origin, { kind: 'ship', bearing })]
  if (options.rings !== false) {
    for (const radius of [1, 2]) {
      const coordinates = Array.from({ length: 129 }, (_, i) => at(radius, i * 360 / 128))
      coordinates[128] = coordinates[0]
      features.push(lineString(coordinates, { kind: 'ring', radius }))
      for (const angle of [0, 90, 180, 270]) {
        features.push(point(at(radius, angle), { kind: 'label', label: `${radius} NM` }))
      }
    }
    for (const angle of [0, 90, 180, 270]) {
      features.push(lineString([origin, at(3, angle)], { kind: 'axis' }))
      for (const radius of [0.5, 1, 1.5, 2, 2.5]) {
        const center = at(radius, angle)
        const end = (b: number) => destination(center, 0.025, b, { units: 'nauticalmiles' }).geometry.coordinates
        features.push(lineString([end(angle - 90), end(angle + 90)], { kind: 'axis' }))
      }
    }
    features.push(point(at(3.1, 0), { kind: 'label', label: 'N' }))
  }
  if (options.vectors !== false) {
    // 原项目半径 0.5 NM、左右各 45° 的前向参考扇形，随船标方向旋转。
    features.push(polygon([[origin, ...Array.from({ length: 33 }, (_, i) => at(0.5, bearing - 45 + i * 90 / 32)), origin]], { kind: 'sector' }))
    // 船首线固定 0.5 NM；航迹向量表示当前速度下六分钟的预计位移。
    if (ship.heading.status === HeadingStatus.KNOWN) {
      features.push(lineString([origin, at(0.5, bearing)], { kind: 'heading' }))
    }
    if (ship.speedKnots > 0) {
      features.push(lineString([origin, at(ship.speedKnots / 10, ship.courseDegrees)], { kind: 'course' }))
    }
  }
  return { type: 'FeatureCollection', features }
}
