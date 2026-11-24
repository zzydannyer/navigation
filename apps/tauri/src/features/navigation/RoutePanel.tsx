import {
  LegKind,
  nextLegKind,
  orderedWaypoints,
  routeDistance,
} from '@navigation/core'
import { selectNavigationGuidance } from '@navigation/app'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigationStore } from '@/store'

export function RoutePanel() {
  const { t } = useTranslation()
  const state = useNavigationStore()
  const waypoints = state.waypoints
  const routes = state.routes
  const activeRouteId = state.activeRouteId
  const navigation = state.navigation
  const guidance = selectNavigationGuidance(state)
  const leg = guidance.leg
  const removeWaypoint = state.removeWaypoint
  const createRoute = state.createRoute
  const activateRoute = state.activateRoute
  const setLegKind = state.setLegKind
  const startRealNavigation = state.startRealNavigation
  const startSimulationNavigation = state.startSimulationNavigation
  const pauseNavigation = state.pauseNavigation
  const resumeNavigation = state.resumeNavigation
  const endNavigation = state.endNavigation
  const moveRouteNode = state.moveRouteNode
  const removeRouteNode = state.removeRouteNode

  const sessionActive = navigation.status === 'running' || navigation.status === 'paused'
  const lockedRouteId = sessionActive ? navigation.routeId : ''
  const realStartDisabled = !guidance.canStartRealNavigation

  const statusLabel = {
    idle: t('nav.statusIdle'),
    running: t('nav.statusRunning'),
    paused: t('nav.statusPaused'),
    ended: t('nav.statusEnded'),
  }[navigation.status]

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4 pb-24 min-[1100px]:pb-4">
      <Button
        type="button"
        disabled={sessionActive}
        onClick={() => {
          createRoute(t('route.routeName', { index: routes.length + 1 }))
        }}
      >
        {t('route.create')}
      </Button>

      <h2 className="text-sm font-medium text-muted-foreground">{t('route.waypoints')}</h2>
      {waypoints.length === 0 ? <p>{t('route.emptyWaypoint')}</p> : <div />}
      {waypoints.map((waypoint) => {
        const referencedByLocked = state.routes.some(
          (route) => route.id === lockedRouteId && route.waypointIds.includes(waypoint.id),
        )
        return (
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
              disabled={referencedByLocked}
              onClick={() => {
                removeWaypoint(waypoint.id)
              }}
            >
              {t('route.delete')}
            </Button>
          </Card>
        )
      })}

      <h2 className="text-sm font-medium text-muted-foreground">{t('route.routes')}</h2>
      {routes.length === 0 ? <p>{t('route.emptyRoute')}</p> : <div />}
      {routes.map((route) => {
        const ordered = orderedWaypoints(route, waypoints)
        const isSessionRoute = lockedRouteId === route.id
        const nodesLocked = isSessionRoute
        const crossRouteLocked = sessionActive && !isSessionRoute
        const isActiveLeg = isSessionRoute && leg.to !== null
        let nextText = '--'
        let remainingText = '--'
        let arrivalText = '--'
        if (isActiveLeg) {
          nextText = t('instrument.nauticalMiles', { value: leg.nextDistanceNauticalMiles.toFixed(2) })
          remainingText = t('instrument.nauticalMiles', { value: leg.remainingDistanceNauticalMiles.toFixed(2) })
          arrivalText = guidance.arrival === null
            ? '--'
            : guidance.arrival.status === 'STOPPED'
              ? t('instrument.stopped')
              : t('instrument.hours', { value: guidance.arrival.hours.toFixed(1) })
        }
        return (
          <Card key={route.id}>
            <CardHeader>
              <CardTitle>
                {route.name}
                {route.id === activeRouteId ? ` · ${t('route.active')}` : ''}
                {isSessionRoute ? ` · ${statusLabel}` : ''}
              </CardTitle>
              <CardDescription>
                {t('route.distance', { distance: routeDistance(route, waypoints).toFixed(2) })}
              </CardDescription>
            </CardHeader>

            <ol className="flex flex-col gap-1 px-4">
              {ordered.map((waypoint, index) => (
                <li className="flex items-center justify-between gap-2 text-sm" key={waypoint.id}>
                  <span>
                    {index + 1}. {waypoint.name}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={nodesLocked || index === 0}
                      onClick={() => moveRouteNode(route.id, waypoint.id, -1)}
                    >
                      {t('nav.moveUp')}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={nodesLocked || index === ordered.length - 1}
                      onClick={() => moveRouteNode(route.id, waypoint.id, 1)}
                    >
                      {t('nav.moveDown')}
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={nodesLocked || ordered.length < 2}
                      onClick={() => removeRouteNode(route.id, waypoint.id)}
                    >
                      {t('nav.removeNode')}
                    </Button>
                  </span>
                </li>
              ))}
            </ol>

            {isActiveLeg && (
              <div className="flex flex-col gap-1 px-4 py-2 text-sm">
                <span>
                  {t('nav.next')}：{leg.to!.name}
                </span>
                <span>{t('nav.nextDistance')}：{nextText}</span>
                <span>
                  {t('nav.remaining')}：{remainingText} · {arrivalText}
                </span>
              </div>
            )}

            <CardFooter className="gap-2">
              {!isSessionRoute && (
                <Button type="button" disabled={crossRouteLocked} onClick={() => activateRoute(route.id)}>
                  {t('route.activate')}
                </Button>
              )}
              {!isSessionRoute && !crossRouteLocked && (
                <>
                  <Button
                    type="button"
                    disabled={realStartDisabled}
                    onClick={() => startRealNavigation(route.id)}
                  >
                    {t('nav.startReal')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startSimulationNavigation(route.id)}
                  >
                    {t('nav.startSimulation')}
                  </Button>
                </>
              )}
              {navigation.status === 'running' && isSessionRoute && (
                <Button type="button" onClick={pauseNavigation}>
                  {t('nav.pause')}
                </Button>
              )}
              {navigation.status === 'paused' && isSessionRoute && (
                <Button type="button" onClick={resumeNavigation}>
                  {t('nav.resume')}
                </Button>
              )}
              {isSessionRoute && (
                <Button type="button" variant="outline" onClick={endNavigation}>
                  {t('nav.end')}
                </Button>
              )}
              {!isSessionRoute && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={crossRouteLocked}
                  onClick={() => setLegKind(route.id, nextLegKind(route.legKind))}
                >
                  {legKindLabel(route.legKind, t)}
                </Button>
              )}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

function legKindLabel(legKind: LegKind, t: ReturnType<typeof useTranslation>['t']) {
  if (legKind === LegKind.RHUMB) {
    return t('route.rhumb')
  }
  return t('route.greatCircle')
}
