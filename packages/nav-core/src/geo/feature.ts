import { isUndefined } from 'lodash-es'
import { Position } from '../domain/position'
import { Route } from '../domain/route'
import { Track } from '../domain/track'
import { Waypoint } from '../domain/waypoint'
import { orderedWaypoints } from './navigation'

export interface NamedPoint {
  id: string
  name: string
  position: Position
}

export function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

export function pointCollection(points: NamedPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((item) => ({
      type: 'Feature',
      id: item.id,
      properties: { name: item.name },
      geometry: {
        type: 'Point',
        coordinates: [item.position.longitude, item.position.latitude],
      },
    })),
  }
}

export function lineCollection(coordinates: GeoJSON.Position[]): GeoJSON.FeatureCollection {
  if (coordinates.length < 2) {
    return emptyCollection()
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '' },
        geometry: { type: 'LineString', coordinates },
      },
    ],
  }
}

export function waypointCollection(waypoints: Waypoint[]) {
  return pointCollection(
    waypoints.map((waypoint) => ({
      id: waypoint.id,
      name: waypoint.name,
      position: waypoint.position,
    })),
  )
}

export function routeCollection(route: Route, waypoints: Waypoint[]) {
  return lineCollection(
    orderedWaypoints(route, waypoints).map((waypoint) => [
      waypoint.position.longitude,
      waypoint.position.latitude,
    ]),
  )
}

export function trackCollection(tracks: Track[]) {
  const track = tracks[0]
  if (isUndefined(track)) {
    return emptyCollection()
  }
  return lineCollection(
    track.points.map((item) => [item.position.longitude, item.position.latitude]),
  )
}
