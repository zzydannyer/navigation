import {
  LegKind,
  nextLegKind,
  routeDistance,
} from '@navigation/core'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigationStore } from './store'

export function RoutePane() {
  const { t } = useTranslation()
  const waypoints = useNavigationStore((state) => state.waypoints)
  const routes = useNavigationStore((state) => state.routes)
  const activeRouteId = useNavigationStore((state) => state.activeRouteId)
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint)
  const createRoute = useNavigationStore((state) => state.createRoute)
  const activateRoute = useNavigationStore((state) => state.activateRoute)
  const setLegKind = useNavigationStore((state) => state.setLegKind)

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <Button
        type="button"
        onClick={() => {
          createRoute(t('route.routeName', { index: routes.length + 1 }))
        }}
      >
        {t('route.create')}
      </Button>
      <h2 className="text-sm font-medium text-muted-foreground">{t('route.waypoints')}</h2>
      {waypoints.length === 0 ? <p>{t('route.emptyWaypoint')}</p> : <div />}
      {waypoints.map((waypoint) => (
        <Card className="flex-row items-center justify-between" key={waypoint.id}>
          <CardHeader>
            <CardTitle>{waypoint.name}</CardTitle>
            <CardDescription>
              {waypoint.position.latitude.toFixed(5)}, {waypoint.position.longitude.toFixed(5)}
            </CardDescription>
          </CardHeader>
          <Button
            className="mr-4"
            type="button"
            variant="destructive"
            onClick={() => {
              removeWaypoint(waypoint.id)
            }}
          >
            {t('route.delete')}
          </Button>
        </Card>
      ))}
      <h2 className="text-sm font-medium text-muted-foreground">{t('route.routes')}</h2>
      {routes.length === 0 ? <p>{t('route.emptyRoute')}</p> : <div />}
      {routes.map((route) => (
        <Card key={route.id}>
          <CardHeader>
            <CardTitle>
              {route.name}
              {route.id === activeRouteId ? ` · ${t('route.active')}` : ''}
            </CardTitle>
            <CardDescription>{t('route.distance', { distance: routeDistance(route, waypoints).toFixed(2) })}</CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button
              type="button"
              onClick={() => {
                activateRoute(route.id)
              }}
            >
              {t('route.activate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLegKind(route.id, nextLegKind(route.legKind))
              }}
            >
              {legKindLabel(route.legKind, t)}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function legKindLabel(legKind: LegKind, t: ReturnType<typeof useTranslation>['t']) {
  if (legKind === LegKind.RHUMB) {
    return t('route.rhumb')
  }
  return t('route.greatCircle')
}
