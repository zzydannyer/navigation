import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

let initialized = false

/**
 * 必须在创建地图前调用：注册 MapLibre Web Worker 并加载地图样式 CSS。
 * 由宿主应用入口在渲染前执行一次。
 */
export function initMapWeb(): void {
  if (initialized) {
    return
  }
  setWorkerUrl(workerUrl)
  initialized = true
}
