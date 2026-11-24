import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  chartDisplayShip,
  chartToolChrome,
  chartToolSelected,
  chartTools,
  chartUseTestShip,
  chartView,
  FixStatus,
  NoticeKey,
} from '@navigation/core'
import { LocationPermissionStatus } from '@navigation/app'
import { ChartView, type ChartPick } from '@navigation/chart-web'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store'
import { buildChartSnapshot } from './chartSnapshot'
import { chartToolIcons } from './toolIcons'

interface ChartPageProps {
  /** 是否显示海图工具条；面板切换时地图实例与定位会话保持不销毁。 */
  showToolbar: boolean
  locationMessage: string
  locating: boolean
  onRequestLocation: () => void
}

export function ChartPage({ showToolbar, locationMessage, locating, onRequestLocation }: ChartPageProps) {
  const { t } = useTranslation()
  const [map, setMap] = useState<MapLibreMap | undefined>(undefined)
  const [follow, setFollow] = useState(false)
  const [rings, setRings] = useState(true)
  const [vectors, setVectors] = useState(true)
  const state = useNavigationStore()
  const permission = state.permission
  const setNotice = state.setNotice
  const waypointLabel = useRef(t)
  waypointLabel.current = t
  const viewed = useMemo(() => {
    return { ...state, ownShip: chartDisplayShip(state.ownShip) }
  }, [state])
  const ownShip = viewed.ownShip

  const snapshot = useMemo(() => buildChartSnapshot(viewed, follow, { rings, vectors }), [viewed, follow, rings, vectors])
  useEffect(() => {
    if (!map) return
    const stopFollow = () => setFollow(false)
    map.on('dragstart', stopFollow)
    return () => { map.off('dragstart', stopFollow) }
  }, [map])

  useEffect(() => {
    if (!map || !chartUseTestShip) return
    const timer = window.setTimeout(() => {
      map.setStyle(chartView.styleUrl, { diff: false })
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [map])

  function handlePick(pick: ChartPick) {
    state.addWaypoint(
      { latitude: pick.latitude, longitude: pick.longitude },
      waypointLabel.current('route.waypointName', { index: state.waypoints.length + 1 }),
    )
  }

  function locate() {
    if (ownShip.status !== FixStatus.FIXED) {
      setNotice(NoticeKey.NO_FIX)
      return
    }
    if (!map) return
    map.easeTo({
      center: [ownShip.position.longitude, ownShip.position.latitude],
      zoom: chartView.zoom,
      duration: 400,
    })
    setNotice(NoticeKey.LOCATED)
  }

  function runTool(id: typeof chartTools[number]['id']) {
    if (id === 'locate') {
      locate()
      return
    }
    if (id === 'follow') {
      setFollow((value) => !value)
      return
    }
    if (id === 'rings') {
      setRings((value) => !value)
      return
    }
    if (id === 'vectors') {
      setVectors((value) => !value)
      return
    }
    if (!map) return
    if (id === 'north') {
      map.easeTo({ bearing: chartView.bearing, pitch: 0 })
      return
    }
    if (id === 'zoomIn') {
      map.zoomIn()
      return
    }
    map.zoomOut()
  }

  const fixed = ownShip.status === FixStatus.FIXED
  const simulation =
    state.navigation.mode === 'simulation' && state.navigation.status !== 'idle'
  const title = simulation
    ? t('nav.modeSimulation')
    : permission === LocationPermissionStatus.DENIED
      ? t('chart.denied')
      : fixed
        ? t('chart.fixedGps')
        : t('chart.waitingFix')

  return (
    <ChartView snapshot={snapshot} onPick={handlePick} onMapReady={setMap}>
      <div className="pointer-events-none absolute top-12 left-4 z-10 max-w-[46%] rounded-lg bg-white/90 px-3 py-2 min-[1100px]:top-3 min-[1100px]:left-3">
        <p className="text-xs text-slate-600">{title}</p>
        {fixed && ownShip.status === FixStatus.FIXED && (
          <>
            <p className="text-base font-semibold text-slate-900">
              {ownShip.position.latitude.toFixed(5)}°, {ownShip.position.longitude.toFixed(5)}°
            </p>
            <p className="text-base font-semibold text-slate-900">
              {ownShip.speedKnots.toFixed(1)} kn · COG {ownShip.courseDegrees.toFixed(0)}°
            </p>
          </>
        )}
        <p className="text-xs text-slate-600">{t('chart.rangeHint')}</p>
        {rings && !fixed && <p className="text-xs text-slate-600">{t('chart.ringsWaiting')}</p>}
        {simulation && state.realFix !== null && (
          <p className="text-xs text-slate-600">{t('nav.realFixCached')}</p>
        )}
        {!fixed && (
          <div className="pointer-events-auto mt-2 min-[1100px]:hidden">
            <Button
              disabled={locating}
              onClick={onRequestLocation}
            >
              {locating ? '定位中…' : '申请 / 刷新定位'}
            </Button>
            <p className="mt-1 text-xs" role="status">{locationMessage}</p>
          </div>
        )}
      </div>
      {showToolbar && (
        <div className="absolute top-40 right-3 z-10 flex flex-col gap-1.5 min-[1100px]:top-3">
          {chartTools.map((tool) => {
            const selected = chartToolSelected(tool.id, { follow, rings, vectors })
            const label = tool.id === 'follow' && follow ? t('chart.following') : t(tool.label)
            return (
              <button
                key={tool.id}
                type="button"
                aria-label={label}
                aria-pressed={tool.toggle ? selected : undefined}
                onClick={() => runTool(tool.id)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border"
                style={{
                  background: selected ? chartToolChrome.activeBackground : chartToolChrome.background,
                  borderColor: selected ? chartToolChrome.activeBorder : chartToolChrome.border,
                }}
              >
                <img src={chartToolIcons[tool.id]} alt="" width={22} height={22} />
              </button>
            )
          })}
        </div>
      )}
    </ChartView>
  )
}
