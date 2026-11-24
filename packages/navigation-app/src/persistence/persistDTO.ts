import { z } from 'zod'
import type { LegKind, Route, Track, Waypoint } from '@navigation/core'

export const SCHEMA_VERSION = 1

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
  legKind: z.enum(['RHUMB', 'GREAT_CIRCLE']),
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

const bodyDTO = z.object({
  waypoints: z.array(waypointDTO),
  routes: z.array(routeDTO),
  tracks: z.array(trackDTO),
  activeRouteId: z.string(),
})

export interface PersistSnapshot {
  waypoints: Waypoint[]
  routes: Route[]
  tracks: Track[]
  activeRouteId: string
}

export function emptySnapshot(): PersistSnapshot {
  return {
    waypoints: [],
    routes: [],
    tracks: [],
    activeRouteId: '',
  }
}

export function serializeSnapshot(snapshot: PersistSnapshot): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    waypoints: snapshot.waypoints,
    routes: snapshot.routes,
    tracks: snapshot.tracks,
    activeRouteId: snapshot.activeRouteId,
  })
}

export type ParseResult =
  | { kind: 'valid'; data: PersistSnapshot }
  | { kind: 'corrupt'; message: string }
  | { kind: 'unsupported-version'; message: string }

function toSnapshot(data: z.infer<typeof bodyDTO>): PersistSnapshot {
  return {
    waypoints: data.waypoints,
    routes: data.routes.map((route) => ({
      ...route,
      legKind: route.legKind as LegKind,
    })),
    tracks: data.tracks,
    activeRouteId: data.activeRouteId,
  }
}

/**
 * 解析本地快照：null/空串为有效空数据；无 schemaVersion 按旧版结构校验；
 * 版本 1 按当前结构校验；其他版本拒绝；JSON 或字段结构错误记为损坏。
 */
export function parsePersist(raw: string | null): ParseResult {
  if (raw === null || raw.trim() === '') {
    return { kind: 'valid', data: emptySnapshot() }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'corrupt', message: '本地导航数据不是有效 JSON' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'corrupt', message: '本地导航数据结构不正确' }
  }

  const record = parsed as Record<string, unknown>
  const version = record.schemaVersion

  if (version !== undefined) {
    if (typeof version !== 'number') {
      return { kind: 'corrupt', message: '本地导航数据版本字段不正确' }
    }
    if (version !== SCHEMA_VERSION) {
      return {
        kind: 'unsupported-version',
        message: `本地导航数据版本 ${version} 不受当前应用支持（当前版本 ${SCHEMA_VERSION}）`,
      }
    }
  }

  const result = bodyDTO.safeParse(parsed)
  if (!result.success) {
    return { kind: 'corrupt', message: '本地导航数据字段不完整或类型不符' }
  }
  return { kind: 'valid', data: toSnapshot(result.data) }
}
