import { useEffect, useState } from 'react'
import { NoticeKey } from '@navigation/core'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast, Toaster } from '@/components/ui/toast'
import { ChartPane } from './ChartPane'
import { InstrumentPane } from './InstrumentPane'
import { requestLocation } from './location'
import { RoutePane } from './RoutePane'
import { useNavigationStore } from './store'

enum DesktopPane {
  CHART = 'CHART',
  ROUTE = 'ROUTE',
  INSTRUMENT = 'INSTRUMENT',
}

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
    return useNavigationStore.subscribe((state, previous) => {
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

export default function App() {
  const { t } = useTranslation()
  const [pane, setPane] = useState(DesktopPane.CHART)
  const [locationMessage, setLocationMessage] = useState('点击申请定位，系统会询问授权')
  const [locating, setLocating] = useState(false)

  return (
    <>
      <NoticeToast />
      <Tabs
        className="h-full min-h-0 gap-0"
        value={pane}
        onValueChange={(value) => {
          if (value === DesktopPane.CHART || value === DesktopPane.ROUTE || value === DesktopPane.INSTRUMENT) {
            setPane(value)
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button
            disabled={locating}
            onClick={async () => {
              setLocating(true)
              setLocationMessage(await requestLocation())
              setLocating(false)
            }}
          >
            {locating ? '定位中…' : '申请 / 刷新定位'}
          </Button>
          <TabsList>
            <TabsTrigger value={DesktopPane.CHART}>{t('tab.chart')}</TabsTrigger>
            <TabsTrigger value={DesktopPane.ROUTE}>{t('tab.route')}</TabsTrigger>
            <TabsTrigger value={DesktopPane.INSTRUMENT}>{t('tab.instrument')}</TabsTrigger>
          </TabsList>
        </div>
        <p className="px-3 py-2 text-xs" role="status">{locationMessage}</p>
        <div className="min-h-0 flex-1">
          {pane === DesktopPane.CHART ? <ChartPane /> : <div />}
          {pane === DesktopPane.ROUTE ? <RoutePane /> : <div />}
          {pane === DesktopPane.INSTRUMENT ? <InstrumentPane /> : <div />}
        </div>
      </Tabs>
    </>
  )
}
