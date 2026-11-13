import { isUndefined } from 'lodash-es'
import { create } from 'zustand'
import { z } from 'zod'
import { NoticeKey } from '../domain/notice'
import {
  FixStatus,
  GpsFix,
  HeadingStatus,
  initialOwnShip,
  OwnShip,
  withHeading,
  withMotion,
} from '../domain/ownShip'
import { Position } from '../domain/position'
import { LegKind, Route } from '../domain/route'
import { recordTrackPoint, Track } from '../domain/track'
import { Waypoint } from '../domain/waypoint'
import { NmeaKind, parseNmea } from '../nmea/parse'

export enum LocationPermissionStatus {
  UNKNOWN = 'UNKNOWN',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
}

export interface NavigationStorage {
  read: () => string
  write: (value: string) => void
}

const legKindValues = [LegKind.RHUMB, LegKind.GREAT_CIRCLE] as const

const positionDTO = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

const waypointDTO = z.object({
  id: z.string(),
  name: z.string(),
  position: positionDTO,
  description: z.string(),
  createdAt: z.string(),
})

const routeDTO = z.object({
  id: z.string(),
  name: z.string(),
  waypointIds: z.array(z.string()),
  legKind: z.enum(legKindValues),
})

const trackPointDTO = z.object({
  position: positionDTO,
  timestamp: z.string(),
  speedKnots: z.number(),
  courseDegrees: z.number(),
})

const trackDTO = z.object({
  id: z.string(),
  name: z.string(),
  points: z.array(trackPointDTO),
})

const navigationPersistDTO = z.object({
  waypoints: z.array(waypointDTO),
  routes: z.array(routeDTO),
  tracks: z.array(trackDTO),
  activeRouteId: z.string(),
})

type NavigationPersistDTO = z.infer<typeof navigationPersistDTO>

interface NavigationState {
  ownShip: OwnShip
  permission: LocationPermissionStatus
  waypoints: Waypoint[]
  routes: Route[]
  tracks: Track[]
  activeRouteId: string
  notice: NoticeKey
  setNotice: (notice: NoticeKey) => void
  setPermission: (permission: LocationPermissionStatus) => void
  applyGps: (fix: GpsFix) => void
  applySentence: (sentence: string) => void
  addWaypoint: (position: Position, name: string) => void
  removeWaypoint: (waypointId: string) => void
  createRoute: (name: string) => void
  activateRoute: (routeId: string) => void
  setLegKind: (routeId: string, legKind: LegKind) => void
}

function emptyPersist(): NavigationPersistDTO {
  return {
    waypoints: [],
    routes: [],
    tracks: [],
    activeRouteId: '',
  }
}

function readPersist(raw: string): NavigationPersistDTO {
  if (!raw.startsWith('{') || !raw.endsWith('}')) {
    return emptyPersist()
  }
  const parsed = navigationPersistDTO.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    return emptyPersist()
  }
  return parsed.data
}

export function createNavigationStore(storage: NavigationStorage, createId: () => string) {
  const persisted = readPersist(storage.read())
  const useNavigationStore = create<NavigationState>((set, get) => ({
    ownShip: initialOwnShip,
    permission: LocationPermissionStatus.UNKNOWN,
    waypoints: persisted.waypoints,
    routes: persisted.routes,
    tracks: persisted.tracks,
    activeRouteId: persisted.activeRouteId,
    notice: NoticeKey.NONE,
    setNotice: (notice) => {
      set({ notice })
    },
    setPermission: (permission) => {
      set({ permission })
    },
    applyGps: (fix) => {
      set((state) => ({
        ownShip: {
          status: FixStatus.FIXED,
          position: fix.position,
          speedKnots: fix.speedKnots,
          courseDegrees: fix.courseDegrees,
          heading: fix.heading,
          timestamp: fix.timestamp,
        },
        tracks: recordTrackPoint(
          state.tracks,
          {
            position: fix.position,
            timestamp: fix.timestamp,
            speedKnots: fix.speedKnots,
            courseDegrees: fix.courseDegrees,
          },
          createId,
        ),
      }))
    },
    applySentence: (sentence) => {
      const parsed = parseNmea(sentence.trim())
      if (parsed.kind === NmeaKind.IGNORED) {
        set({ notice: NoticeKey.NMEA_IGNORED })
        return
      }
      if (parsed.kind === NmeaKind.HEADING) {
        set((state) => ({
          ownShip: withHeading(state.ownShip, {
            status: HeadingStatus.KNOWN,
            degrees: parsed.headingDegrees,
          }),
          notice: NoticeKey.NMEA_APPLIED,
        }))
        return
      }
      if (parsed.kind === NmeaKind.MOTION) {
        set((state) => ({
          ownShip: withMotion(state.ownShip, parsed.speedKnots, parsed.courseDegrees),
          notice: NoticeKey.NMEA_APPLIED,
        }))
        return
      }
      if (parsed.kind === NmeaKind.POSITION) {
        const state = get()
        set({
          ownShip: {
            status: FixStatus.FIXED,
            position: parsed.position,
            speedKnots: state.ownShip.speedKnots,
            courseDegrees: state.ownShip.courseDegrees,
            heading: state.ownShip.heading,
            timestamp: parsed.timestamp,
          },
          tracks: recordTrackPoint(
            state.tracks,
            {
              position: parsed.position,
              timestamp: parsed.timestamp,
              speedKnots: state.ownShip.speedKnots,
              courseDegrees: state.ownShip.courseDegrees,
            },
            createId,
          ),
          notice: NoticeKey.NMEA_APPLIED,
        })
        return
      }
      const state = get()
      set({
        ownShip: {
          status: FixStatus.FIXED,
          position: parsed.position,
          speedKnots: parsed.speedKnots,
          courseDegrees: parsed.courseDegrees,
          heading: state.ownShip.heading,
          timestamp: parsed.timestamp,
        },
        tracks: recordTrackPoint(
          state.tracks,
          {
            position: parsed.position,
            timestamp: parsed.timestamp,
            speedKnots: parsed.speedKnots,
            courseDegrees: parsed.courseDegrees,
          },
          createId,
        ),
        notice: NoticeKey.NMEA_APPLIED,
      })
    },
    addWaypoint: (position, name) => {
      const waypoint = {
        id: createId(),
        name,
        position,
        description: '',
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        waypoints: state.waypoints.concat(waypoint),
        notice: NoticeKey.WAYPOINT_ADDED,
      }))
    },
    removeWaypoint: (waypointId) => {
      const state = get()
      const waypoints = state.waypoints.filter((waypoint) => waypoint.id !== waypointId)
      const routes = state.routes.flatMap((route) => {
        const waypointIds = route.waypointIds.filter((id) => id !== waypointId)
        if (waypointIds.length < 2) {
          return []
        }
        return [{ ...route, waypointIds }]
      })
      const activeExists = routes.some((route) => route.id === state.activeRouteId)
      const activeRouteId = activeExists ? state.activeRouteId : ''
      set({
        waypoints,
        routes,
        activeRouteId,
        notice: NoticeKey.WAYPOINT_REMOVED,
      })
    },
    createRoute: (name) => {
      const state = get()
      if (state.waypoints.length < 2) {
        set({ notice: NoticeKey.ROUTE_NEED_WAYPOINT })
        return
      }
      const route = {
        id: createId(),
        name,
        waypointIds: state.waypoints.map((waypoint) => waypoint.id),
        legKind: LegKind.RHUMB,
      }
      set({
        routes: state.routes.concat(route),
        activeRouteId: route.id,
        notice: NoticeKey.ROUTE_CREATED,
      })
    },
    activateRoute: (routeId) => {
      const route = get().routes.find((item) => item.id === routeId)
      if (isUndefined(route)) {
        return
      }
      set({ activeRouteId: routeId, notice: NoticeKey.ROUTE_ACTIVATED })
    },
    setLegKind: (routeId, legKind) => {
      set((state) => ({
        routes: state.routes.map((route) => {
          if (route.id !== routeId) {
            return route
          }
          return { ...route, legKind }
        }),
        notice: NoticeKey.LEG_UPDATED,
      }))
    },
  }))

  useNavigationStore.subscribe((state) => {
    storage.write(
      JSON.stringify({
        waypoints: state.waypoints,
        routes: state.routes,
        tracks: state.tracks,
        activeRouteId: state.activeRouteId,
      }),
    )
  })

  return useNavigationStore
}
