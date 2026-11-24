import { projectChartLayers } from '@navigation/app'
import type { NavigationState } from '@navigation/app'
import type { OwnShipOverlayOptions } from '@navigation/core'
import type { ChartSnapshot } from '@navigation/chart-web'

/**
 * 相机跟随留在 Tauri：共享投影只产出图层数据，快照再补 follow 供 chart-web 平移相机。
 * 本船投影始终按当前画面船位（含验收测试船位）计算。
 */
export function buildChartSnapshot(
  state: NavigationState,
  follow: boolean,
  options: OwnShipOverlayOptions = {},
): ChartSnapshot {
  return {
    ...projectChartLayers(state, options),
    follow,
  }
}
