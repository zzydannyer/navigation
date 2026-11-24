import { FixStatus, HeadingStatus, type OwnShip, type OwnShipFixed } from '../domain/ownShip'

/** 两端海图共用的底图与初始相机。中心与测试船位相同，便于同一范围对照。 */
export const chartView = {
  styleUrl: 'https://demotiles.maplibre.org/style.json',
  longitude: 122,
  latitude: 30,
  zoom: 12,
  bearing: 0,
}

/** 工具按钮常态与选中态。两端使用同一组颜色，选中只改变底和边。 */
export const chartToolChrome = {
  background: '#ffffff',
  border: '#cbd5e1',
  activeBackground: '#bfdbfe',
  activeBorder: '#2563eb',
  foreground: '#0f172a',
}

/** 右侧竖排工具栏的顺序。图标文件与 id 同名，放在 assets/marine/tools。 */
export const chartTools = [
  { id: 'locate', label: 'chart.locate', toggle: false },
  { id: 'follow', label: 'chart.follow', toggle: true },
  { id: 'rings', label: 'chart.rings', toggle: true },
  { id: 'vectors', label: 'chart.vectors', toggle: true },
  { id: 'north', label: 'chart.northUp', toggle: false },
  { id: 'zoomIn', label: 'chart.zoomIn', toggle: false },
  { id: 'zoomOut', label: 'chart.zoomOut', toggle: false },
] as const

/**
 * 验收对照开关。为 true 时画面使用固定测试船位，Tauri 会在底图就绪后重载一次样式。
 * 真实 GPS 验收保持 false，定位仍写入导航状态。
 */
export const chartUseTestShip = false

const testShip: OwnShipFixed = {
  status: FixStatus.FIXED,
  position: { latitude: chartView.latitude, longitude: chartView.longitude },
  speedKnots: 12,
  courseDegrees: 45,
  heading: { status: HeadingStatus.KNOWN, degrees: 45 },
  timestamp: '2026-11-23T03:00:00.000Z',
}

export function chartTestOwnShip(): OwnShipFixed {
  return testShip
}

/** 测试开关打开时返回固定船位，否则返回当前本船。 */
export function chartDisplayShip(ship: OwnShip): OwnShip {
  if (chartUseTestShip) return testShip
  return ship
}

/** 跟随、避碰圈、航向线有选中态；其余按钮按下后不保持选中。 */
export function chartToolSelected(
  id: string,
  flags: { follow: boolean; rings: boolean; vectors: boolean },
): boolean {
  if (id === 'follow') return flags.follow
  if (id === 'rings') return flags.rings
  if (id === 'vectors') return flags.vectors
  return false
}
