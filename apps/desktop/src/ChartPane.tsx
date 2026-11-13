import { useEffect, useRef, useState } from 'react'
import {
  ActiveLegStatus,
  emptyCollection,
  FixStatus,
  lineCollection,
  LocationPermissionStatus,
  NoticeKey,
  orderedWaypoints,
  resolveActiveLeg,
  routeCollection,
  trackCollection,
  waypointCollection,
} from '@navigation/core'
import { isNull, isUndefined } from 'lodash-es'
import { GeoJSONSource, Map as MapLibreMap, type Source } from 'maplibre-gl'
import ModelDemo from './ModelDemo'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from './store'

const MAP_STYLE = 'https://demotiles.maplibre.org/style.json'
const chartCenter: [number, number] = [122.2, 30.7]

export function ChartPane() {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const followRef = useRef(false)
  const waypointLabel = useRef(t)
  const [shipMap, setShipMap] = useState<MapLibreMap | undefined>(undefined)
  waypointLabel.current = t
  const [follow, setFollow] = useState(false)
  const permission = useNavigationStore((state) => state.permission)
  const ownShip = useNavigationStore((state) => state.ownShip)
  const setNotice = useNavigationStore((state) => state.setNotice)

  useEffect(() => {
    followRef.current = follow
  }, [follow])

  useEffect(() => {
    const element = container.current
    if (isNull(element)) {
      return
    }
    const map = new MapLibreMap({
      container: element,
      style: MAP_STYLE,
      center: chartCenter,
      zoom: 8,
    })
    mapRef.current = map
    let alive = true
    map.on('load', () => {
      if (!alive) return
      map.addSource('track', { type: 'geojson', data: emptyCollection() })
      map.addSource('route', { type: 'geojson', data: emptyCollection() })
      map.addSource('leg', { type: 'geojson', data: emptyCollection() })
      map.addSource('waypoints', { type: 'geojson', data: emptyCollection() })
      map.addSource('own-ship', { type: 'geojson', data: emptyCollection() })
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: { 'line-color': '#7eb6ff', 'line-width': 3 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#f5c16c', 'line-width': 4 },
      })
      map.addLayer({
        id: 'leg-line',
        type: 'line',
        source: 'leg',
        paint: { 'line-color': '#3dd6c6', 'line-width': 5 },
      })
      map.addLayer({
        id: 'waypoint-circle',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 6,
          'circle-color': '#7eb6ff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: 'own-ship-circle',
        type: 'circle',
        source: 'own-ship',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ff5d5d',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
      draw(map, followRef.current)
      setShipMap(map)
    })
    map.on('click', (event) => {
      const state = useNavigationStore.getState()
      state.addWaypoint(
        { latitude: event.lngLat.lat, longitude: event.lngLat.lng },
        waypointLabel.current('route.waypointName', { index: state.waypoints.length + 1 }),
      )
    })
    const unsubscribe = useNavigationStore.subscribe(() => {
      draw(map, followRef.current)
    })
    return () => {
      alive = false
      unsubscribe()
      map.remove()
      mapRef.current = null
    }
  }, [])

  function locate() {
    if (ownShip.status !== FixStatus.FIXED) {
      setNotice(NoticeKey.NO_FIX)
      return
    }
    const map = mapRef.current
    if (isNull(map)) {
      return
    }
    map.easeTo({
      center: [ownShip.position.longitude, ownShip.position.latitude],
      zoom: 12,
      duration: 400,
    })
    setNotice(NoticeKey.LOCATED)
  }

  const statusText =
    permission === LocationPermissionStatus.DENIED
      ? t('chart.denied')
      : ownShip.status === FixStatus.FIXED
        ? t('chart.fixed')
        : t('chart.noFix')

  return (
    <div className="relative h-full min-h-0">
      <div className="h-full w-full" ref={container} />
      {isUndefined(shipMap) ? undefined : <ModelDemo map={shipMap} />}
      <div className="absolute right-4 bottom-4 z-10 flex items-center gap-2">
        <Badge variant="secondary">{statusText}</Badge>
        <Button type="button" onClick={locate}>
          {t('chart.locate')}
        </Button>
        <Button
          type="button"
          variant={follow ? 'default' : 'outline'}
          onClick={() => {
            setFollow((value) => !value)
          }}
        >
          {follow ? t('chart.following') : t('chart.follow')}
        </Button>
      </div>
    </div>
  )
}

function draw(map: MapLibreMap, follow: boolean) {
  const state = useNavigationStore.getState()
  const activeRoute = state.routes.find((route) => route.id === state.activeRouteId)
  writeSource(map, 'track', trackCollection(state.tracks))
  writeSource(map, 'waypoints', waypointCollection(state.waypoints))
  writeSource(
    map,
    'route',
    isUndefined(activeRoute) ? emptyCollection() : routeCollection(activeRoute, state.waypoints),
  )
  if (state.ownShip.status !== FixStatus.FIXED) {
    writeSource(map, 'own-ship', emptyCollection())
    writeSource(map, 'leg', emptyCollection())
    return
  }
  writeSource(
    map,
    'own-ship',
    ownShipCollection(state.ownShip.position.longitude, state.ownShip.position.latitude),
  )
  if (follow) {
    map.easeTo({
      center: [state.ownShip.position.longitude, state.ownShip.position.latitude],
      duration: 300,
    })
  }
  if (isUndefined(activeRoute)) {
    writeSource(map, 'leg', emptyCollection())
    return
  }
  const leg = resolveActiveLeg(
    state.ownShip.position,
    orderedWaypoints(activeRoute, state.waypoints),
    activeRoute.legKind,
    state.ownShip.speedKnots,
    state.ownShip.timestamp,
  )
  if (leg.status !== ActiveLegStatus.ACTIVE) {
    writeSource(map, 'leg', emptyCollection())
    return
  }
  writeSource(
    map,
    'leg',
    lineCollection([
      [leg.fromWaypoint.position.longitude, leg.fromWaypoint.position.latitude],
      [leg.toWaypoint.position.longitude, leg.toWaypoint.position.latitude],
    ]),
  )
}

function ownShipCollection(longitude: number, latitude: number) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        id: 'own-ship',
        properties: { name: '' },
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude],
        },
      },
    ],
  }
}

function isGeoJsonSource(source: Source): source is GeoJSONSource {
  return source.type === 'geojson'
}

function writeSource(map: MapLibreMap, id: string, data: ReturnType<typeof emptyCollection>) {
  const source = map.getSource(id)
  if (isUndefined(source)) {
    return
  }
  if (!isGeoJsonSource(source)) {
    return
  }
  source.setData(data)
}
