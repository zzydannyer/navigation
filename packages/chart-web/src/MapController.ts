import { Map as MapLibreMap } from 'maplibre-gl'
import { setupChartLayers } from './layers/setupLayers'
import { renderSnapshot, type ChartSnapshot } from './layers/render'
import { attachPick, type ChartPick } from './interactions/pick'
import { chartView } from '../../nav-core/src/geo/chartView'
import ownShipArrowUrl from '../../../assets/marine/own-ship.png'

export type { ChartPick }

export const DEMO_STYLE = chartView.styleUrl
export const CHART_CENTER: [number, number] = [chartView.longitude, chartView.latitude]
export const CHART_ZOOM = chartView.zoom
export const CHART_BEARING = chartView.bearing

export interface MapControllerOptions {
  styleUrl: string
  center: [number, number]
  zoom: number
  bearing: number
  onPick: (pick: ChartPick) => void
  onReady?: (map: MapLibreMap) => void
}

export interface MapController {
  readonly map: MapLibreMap
  render(snapshot: ChartSnapshot): void
  locate(position: { longitude: number; latitude: number }): void
  destroy(): void
}

/** 创建/销毁 MapLibre 实例，持有最新快照；style 重载后幂等恢复图层并重绘。 */
export function createMapController(
  container: HTMLElement,
  options: MapControllerOptions,
): MapController {
  const map = new MapLibreMap({
    container,
    style: options.styleUrl,
    center: options.center,
    zoom: options.zoom,
    bearing: options.bearing,
  })

  let ready = false
  let readyNotified = false
  let latest: ChartSnapshot | null = null
  let destroyed = false
  const arrow = new Image()
  arrow.onload = () => {
    if (!destroyed && ready && !map.hasImage('own-ship-arrow')) map.addImage('own-ship-arrow', arrow)
  }
  arrow.src = ownShipArrowUrl

  // style.load 在首次加载与每次底图样式重载后都会触发；此时重建业务图层并重绘最新快照，
  // 避免切换/重载底图后航线、轨迹、航段与本船丢失。
  map.on('style.load', () => {
    if (arrow.complete && arrow.naturalWidth > 0 && !map.hasImage('own-ship-arrow')) map.addImage('own-ship-arrow', arrow)
    setupChartLayers(map)
    ready = true
    if (latest) {
      renderSnapshot(map, latest)
    }
    if (!readyNotified) {
      readyNotified = true
      options.onReady?.(map)
    }
  })

  attachPick(map, options.onPick)

  return {
    map,
    render(snapshot) {
      latest = snapshot
      if (ready) {
        renderSnapshot(map, snapshot)
      }
    },
    locate(position) {
      map.easeTo({
        center: [position.longitude, position.latitude],
        zoom: 12,
        duration: 400,
      })
    },
    destroy() {
      destroyed = true
      arrow.onload = null
      map.remove()
    },
  }
}
