import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  CHART_BEARING,
  CHART_CENTER,
  CHART_ZOOM,
  DEMO_STYLE,
  createMapController,
  type ChartPick,
  type MapController,
} from './MapController'
import type { ChartSnapshot } from './layers/render'

interface ChartViewProps {
  snapshot: ChartSnapshot
  onPick: (pick: ChartPick) => void
  onMapReady?: (map: MapLibreMap) => void
  children?: ReactNode
}

/**
 * React 地图容器：只持有控制器生命周期与快照下发，不 import 应用 store。
 * 覆盖层（工具栏、3D 演示等）通过 children 传入。
 */
export function ChartView({ snapshot, onPick, onMapReady, children }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<MapController | null>(null)
  const [ready, setReady] = useState(false)
  const callbacksRef = useRef({ onPick, onMapReady })
  callbacksRef.current = { onPick, onMapReady }

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    const controller = createMapController(element, {
      styleUrl: DEMO_STYLE,
      center: CHART_CENTER,
      zoom: CHART_ZOOM,
      bearing: CHART_BEARING,
      onPick: (pick) => callbacksRef.current.onPick(pick),
      onReady: (map) => {
        setReady(true)
        callbacksRef.current.onMapReady?.(map)
      },
    })
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.render(snapshot)
  }, [snapshot])

  return (
    <div className="relative h-full min-h-0">
      <div className="h-full w-full" ref={containerRef} />
      {ready ? children : null}
    </div>
  )
}
