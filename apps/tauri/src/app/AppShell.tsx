import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NoticeKey } from '@navigation/core'
import type { HydrationState, LoadError } from '@navigation/app'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast, Toaster } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { requestLocation, startLocationWatch, stopLocationWatch } from '@/adapters/location'
import { hydrateNavigation, navigationStore, resetCorruptData, useNavigationStore } from '@/store'
import { startSimulationRunner, stopSimulationRunner } from '@/adapters/navigation/runner'
import { ChartPage } from '@/features/chart/ChartPage'
import { ROUTES } from './router'

function noticeToastType(notice: NoticeKey) {
  if (
    notice === NoticeKey.LOCATION_DENIED
    || notice === NoticeKey.NMEA_IGNORED
    || notice === NoticeKey.NO_FIX
    || notice === NoticeKey.MAP_FAILED
    || notice === NoticeKey.ROUTE_NEED_WAYPOINT
  ) {
    return 'error'
  }
  return 'success'
}

function NoticeToast() {
  const { t } = useTranslation()
  useEffect(() => {
    return navigationStore.subscribe((state, previous) => {
      if (state.notice === previous.notice || state.notice === NoticeKey.NONE) {
        return
      }
      toast.add({
        title: t(`notice.${state.notice}`),
        type: noticeToastType(state.notice),
      })
      state.setNotice(NoticeKey.NONE)
    })
  }, [t])
  return <Toaster />
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground',
    isActive && 'bg-muted text-foreground',
  )

interface RecoveryViewProps {
  hydration: HydrationState
  loadError: LoadError | null
  resetError: string | null
  busy: boolean
  onReload: () => void
  onReset: () => void
}

function RecoveryView({ hydration, loadError, resetError, busy, onReload, onReset }: RecoveryViewProps) {
  const disabled = busy || hydration === 'loading'

  if (hydration === 'loading' || hydration === 'idle') {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        正在加载本地数据…
      </div>
    )
  }

  const title =
    loadError?.kind === 'unsupported-version'
      ? '本地数据版本不兼容'
      : loadError?.kind === 'corrupt'
        ? '本地导航数据已损坏'
        : '读取本地数据失败'

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{loadError?.message ?? '请重试或清空本地数据后重新开始。'}</p>
        {resetError && <p className="text-sm text-destructive">{resetError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={onReload}>
            重新读取
          </Button>
          {loadError?.kind === 'corrupt' && (
            <Button type="button" variant="destructive" disabled={disabled} onClick={onReset}>
              清空损坏数据并重新开始
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const [locationMessage, setLocationMessage] = useState('点击申请定位，系统会询问授权')
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)
  const hydration = useNavigationStore((state) => state.hydration)
  const loadError = useNavigationStore((state) => state.loadError)
  const resetError = useNavigationStore((state) => state.resetError)
  const navStatus = useNavigationStore((state) => state.navigation.status)
  const navMode = useNavigationStore((state) => state.navigation.mode)
  const persistence = useNavigationStore((state) => state.persistence)

  useEffect(() => {
    // 计时驱动只挂在模拟会话；真实导航由 GPS 定位推进。
    if (navStatus === 'running' && navMode === 'simulation') {
      startSimulationRunner()
    } else {
      stopSimulationRunner()
    }
    return stopSimulationRunner
  }, [navStatus, navMode])

  useEffect(() => {
    // 数据就绪后启动持续定位；卸载或离开时释放 watch。
    if (hydration !== 'ready') return
    void startLocationWatch()
    return () => stopLocationWatch()
  }, [hydration])
  const isChartRoute = location.pathname === `/${ROUTES.chart}`

  async function refreshLocation() {
    setLocating(true)
    setLocationMessage(await requestLocation())
    setLocating(false)
  }

  const sectionLinks = (
    <nav className="flex items-center gap-1">
      <NavLink to={`/${ROUTES.chart}`} className={navLinkClass}>
        {t('tab.chart')}
      </NavLink>
      <NavLink to={`/${ROUTES.route}`} className={navLinkClass}>
        {t('tab.route')}
      </NavLink>
      <NavLink to={`/${ROUTES.instruments}`} className={navLinkClass}>
        {t('tab.instrument')}
      </NavLink>
    </nav>
  )

  async function runRecovery(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  if (hydration !== 'ready') {
    return (
      <>
        <NoticeToast />
        <RecoveryView
          hydration={hydration}
          loadError={loadError}
          resetError={resetError}
          busy={busy}
          onReload={() => {
            void runRecovery(hydrateNavigation)
          }}
          onReset={() => {
            if (window.confirm('将删除原有本地导航数据（航点、航线、轨迹），确认清空并重新开始？')) {
              void runRecovery(resetCorruptData)
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <NoticeToast />
      <div className="flex h-full min-h-0 flex-col">
        <div className="hidden min-[1100px]:flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button disabled={locating} onClick={() => { void refreshLocation() }}>
            {locating ? '定位中…' : '申请 / 刷新定位'}
          </Button>
          {sectionLinks}
        </div>
        <p className="hidden px-3 py-2 text-xs min-[1100px]:block" role="status">{locationMessage}</p>
        {persistence.state === 'failed' && (
          <div className="hidden items-center gap-2 px-3 py-1 text-xs text-destructive min-[1100px]:flex" role="alert">
            <span>{persistence.message ?? '本地保存失败，数据可能未写入'}</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                navigationStore.getState().retryPersist()
              }}
            >
              重试
            </Button>
          </div>
        )}
        <div className="relative min-h-0 flex-1">
          {/* 地图铺满剩余区域。手机端定位条和分区入口浮在地图上，不再占用地图高度。 */}
          <ChartPage
            showToolbar={isChartRoute}
            locationMessage={locationMessage}
            locating={locating}
            onRequestLocation={() => { void refreshLocation() }}
          />
          <div className="absolute bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 min-[1100px]:hidden">
            <div className="rounded-lg border bg-background/95 p-1 shadow">{sectionLinks}</div>
          </div>
          {persistence.state === 'failed' && (
            <div className="absolute right-16 bottom-3 left-3 z-30 flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-xs text-destructive min-[1100px]:hidden" role="alert">
              <span>{persistence.message ?? '本地保存失败，数据可能未写入'}</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  navigationStore.getState().retryPersist()
                }}
              >
                重试
              </Button>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </>
  )
}
