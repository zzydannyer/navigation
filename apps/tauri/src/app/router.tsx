import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RoutePanel } from '@/features/navigation/RoutePanel'
import { InstrumentPanel } from '@/features/instruments/InstrumentPanel'

export const ROUTES = {
  chart: 'chart',
  route: 'route',
  instruments: 'instruments',
} as const

const panelAsideClass =
  'absolute inset-y-0 left-0 z-10 w-full max-w-sm overflow-auto border-r bg-background/95 backdrop-blur'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={`/${ROUTES.chart}`} replace />} />
          <Route path={ROUTES.chart} element={null} />
          <Route
            path={ROUTES.route}
            element={
              <aside className={panelAsideClass}>
                <RoutePanel />
              </aside>
            }
          />
          <Route
            path={ROUTES.instruments}
            element={
              <aside className={panelAsideClass}>
                <InstrumentPanel />
              </aside>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
