import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  ARRIVAL_RADIUS_NAUTICAL_MILES,
  OFF_TRACK_NAUTICAL_MILES,
  FixStatus,
  HeadingStatus,
  LegKind,
  NmeaKind,
  NoticeKey,
  crossTrackError,
  initialOwnShip,
  measureLeg,
  orderedWaypoints,
  parseNmea,
  recordTrackPoint,
  stepSimulation,
  withHeading,
  withMotion,
} from '@navigation/core'
import type {
  Heading,
  OwnShip,
  OwnShipFixed,
  Position,
  Route,
  Track,
  Waypoint,
} from '@navigation/core'
import { LocationPermissionStatus, type StoragePort } from '@navigation/platform-contracts'
import { PersistenceQueue, type PersistStatus } from '../persistence/queue'
import {
  emptySnapshot,
  parsePersist,
  serializeSnapshot,
} from '../persistence/persistDTO'
import {
  FIX_FUTURE_TOLERANCE_MS,
  FIX_STALE_MS,
  isFreshFix,
} from './fixFreshness'

export type HydrationState = 'idle' | 'loading' | 'ready' | 'failed'

export type LoadErrorKind = 'read' | 'corrupt' | 'unsupported-version'

export interface LoadError {
  kind: LoadErrorKind
  message: string
}

export type NavigationSessionStatus = 'idle' | 'running' | 'paused' | 'ended'

export type NavigationMode = 'real' | 'simulation'

/** 定位输入；缺失的速度、航向用 null 表达，由状态层按真实读数补全。 */
export interface GpsFixInput {
  position: Position
  speedKnots: number | null
  courseDegrees: number | null
  heading: Heading | null
  timestamp: string
}

/** 独立真实读数缓存；VTG/HDT 可先于位置到达，模拟数据不得混入。 */
export interface RealReadings {
  speedKnots: number | null
  courseDegrees: number | null
  heading: Heading | null
}

export interface NavigationSession {
  status: NavigationSessionStatus
  mode: NavigationMode
  routeId: string
  activeIndex: number
  /** 模拟模式独立航速（节），不借用 GPS 航速。 */
  simulationSpeedKnots: number
}

const IDLE_SESSION: NavigationSession = {
  status: 'idle',
  mode: 'simulation',
  routeId: '',
  activeIndex: 0,
  simulationSpeedKnots: 6,
}

export interface NavigationState {
  ownShip: OwnShip
  /** 最近一次真实定位缓存；模拟步进不修改它，模拟画面也不读取它。 */
  realFix: OwnShip | null
  /** 最近一次真实速度/航迹向/船首向读数；位置语句缺失字段由它补全。 */
  realReadings: RealReadings | null
  permission: LocationPermissionStatus
  waypoints: Waypoint[]
  routes: Route[]
  tracks: Track[]
  activeRouteId: string
  notice: NoticeKey
  hydrated: boolean
  hydration: HydrationState
  loadError: LoadError | null
  resetError: string | null
  navigation: NavigationSession
  persistence: PersistStatus
  setNotice: (notice: NoticeKey) => void
  setPermission: (permission: LocationPermissionStatus) => void
  applyGps: (fix: GpsFixInput) => void
  applySentence: (sentence: string) => void
  addWaypoint: (position: Position, name: string) => void
  renameWaypoint: (waypointId: string, name: string) => void
  removeWaypoint: (waypointId: string) => void
  createRoute: (name: string) => void
  activateRoute: (routeId: string) => void
  setLegKind: (routeId: string, legKind: LegKind) => void
  moveRouteNode: (routeId: string, waypointId: string, direction: -1 | 1) => void
  removeRouteNode: (routeId: string, waypointId: string) => void
  retryPersist: () => void
  resetCorruptData: () => Promise<void>
  startRealNavigation: (routeId: string) => void
  startSimulationNavigation: (routeId: string) => void
  setSimulationSpeed: (knots: number) => void
  pauseNavigation: () => void
  resumeNavigation: () => void
  endNavigation: () => void
  simulationTick: (elapsedSeconds: number) => void
}

export interface NavigationStoreOptions {
  storage: StoragePort
  createId: () => string
  /** 时钟注入；默认取系统时间，便于测试与平台替换。 */
  now?: () => string
}

export interface NavigationStoreHandle {
  store: StoreApi<NavigationState>
  /** 显式异步加载本地快照；重复调用复用同一个加载 Promise。 */
  hydrate: () => Promise<void>
  /** 损坏/不兼容数据清空恢复：写入空快照成功后才安装空状态并进入 ready。 */
  resetCorruptData: () => Promise<void>
}

export function createNavigationStore(options: NavigationStoreOptions): NavigationStoreHandle {
  const createId = options.createId
  const now = options.now ?? (() => new Date().toISOString())

  function activeSession(nav: NavigationSession): NavigationSession | null {
    return nav.status === 'running' || nav.status === 'paused' ? nav : null
  }

  function sessionRouteLocked(state: NavigationState, routeId?: string): boolean {
    const nav = activeSession(state.navigation)
    if (nav === null) {
      return false
    }
    return routeId === undefined || nav.routeId === routeId
  }

  function evaluateRealNavigation(
    state: NavigationState,
    position: Position,
  ): { navigation: NavigationSession; notice: NoticeKey | null } {
    const nav = state.navigation
    if (nav.status !== 'running' || nav.mode !== 'real') {
      return { navigation: nav, notice: null }
    }
    const route = state.routes.find((item) => item.id === nav.routeId)
    if (route === undefined) {
      return { navigation: nav, notice: null }
    }
    const ordered = orderedWaypoints(route, state.waypoints)
    const target = ordered[nav.activeIndex]
    if (target === undefined) {
      return { navigation: nav, notice: null }
    }
    const distance = measureLeg(position, target.position, route.legKind).distanceNauticalMiles
    if (distance <= ARRIVAL_RADIUS_NAUTICAL_MILES) {
      const isLast = nav.activeIndex >= ordered.length - 1
      const next: NavigationSession = isLast
        ? {
            status: 'ended',
            mode: nav.mode,
            routeId: nav.routeId,
            activeIndex: ordered.length - 1,
            simulationSpeedKnots: nav.simulationSpeedKnots,
          }
        : {
            status: 'running',
            mode: nav.mode,
            routeId: nav.routeId,
            activeIndex: nav.activeIndex + 1,
            simulationSpeedKnots: nav.simulationSpeedKnots,
          }
      return {
        navigation: next,
        notice: isLast ? NoticeKey.ROUTE_COMPLETE : NoticeKey.ARRIVAL_WAYPOINT,
      }
    }
    const start = ordered[nav.activeIndex - 1]
    if (start !== undefined) {
      const cross = crossTrackError(position, start.position, target.position, route.legKind)
      if (cross.distanceNauticalMiles > OFF_TRACK_NAUTICAL_MILES) {
        return { navigation: nav, notice: NoticeKey.OFF_TRACK }
      }
    }
    return { navigation: nav, notice: null }
  }

  const store = createStore<NavigationState>((set, get) => {
    interface RealPositionInput {
      position: Position
      speedKnots: number | null
      courseDegrees: number | null
      heading: Heading | null
      timestamp: string
    }

    interface CommitResult {
      applied: boolean
      notice: NoticeKey | null
    }

    function mergeReadings(base: RealReadings | null, input: RealPositionInput): RealReadings {
      return {
        speedKnots: input.speedKnots ?? base?.speedKnots ?? null,
        courseDegrees: input.courseDegrees ?? base?.courseDegrees ?? null,
        heading: input.heading ?? base?.heading ?? null,
      }
    }

    /**
     * 校验真实定位：坐标有限且合法、时间可解析、不早于 5 分钟前、不超前容差、
     * 且不早于当前缓存（同时间重复数据视为重复）。
     */
    function isValidFix(input: RealPositionInput, previous: OwnShip | null): boolean {
      const { latitude, longitude } = input.position
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return false
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return false
      const time = Date.parse(input.timestamp)
      if (Number.isNaN(time)) return false
      const nowMs = Date.parse(now())
      if (Number.isNaN(nowMs)) return false
      if (nowMs - time > FIX_STALE_MS) return false
      if (time - nowMs > FIX_FUTURE_TOLERANCE_MS) return false
      if (previous !== null && previous.status === FixStatus.FIXED) {
        const previousTime = Date.parse(previous.timestamp)
        if (!Number.isNaN(previousTime) && time <= previousTime) return false
      }
      return true
    }

    /** GPS 与 NMEA 位置语句共用的真实位置入口；模拟会话期间只更新真实缓存。 */
    function commitRealPosition(input: RealPositionInput): CommitResult {
      if (get().hydration !== 'ready') return { applied: false, notice: null }
      const state = get()
      if (!isValidFix(input, state.realFix)) return { applied: false, notice: null }
      const readings = mergeReadings(state.realReadings, input)
      const realOwn: OwnShipFixed = {
        status: FixStatus.FIXED,
        position: input.position,
        speedKnots: readings.speedKnots ?? 0,
        courseDegrees: readings.courseDegrees ?? 0,
        heading: readings.heading ?? { status: HeadingStatus.UNKNOWN },
        timestamp: input.timestamp,
      }
      if (activeSession(state.navigation)?.mode === 'simulation') {
        set({ realFix: realOwn, realReadings: readings })
        return { applied: true, notice: null }
      }
      const evaluated = evaluateRealNavigation(state, input.position)
      set((prev) => ({
        ownShip: realOwn,
        realFix: realOwn,
        realReadings: readings,
        tracks: recordTrackPoint(
          prev.tracks,
          {
            position: input.position,
            timestamp: input.timestamp,
            speedKnots: realOwn.speedKnots,
            courseDegrees: realOwn.courseDegrees,
          },
          createId,
        ),
        navigation: evaluated.navigation,
        notice: evaluated.notice ?? prev.notice,
      }))
      return { applied: true, notice: evaluated.notice }
    }

    /** 运动补丁（VTG）：先回写真实读数缓存，非模拟会话再同步画面船位。 */
    function commitRealMotion(speedKnots: number, courseDegrees: number): void {
      if (get().hydration !== 'ready') return
      const state = get()
      const realReadings: RealReadings = {
        speedKnots,
        courseDegrees,
        heading: state.realReadings?.heading ?? null,
      }
      const realFix = state.realFix ? withMotion(state.realFix, speedKnots, courseDegrees) : state.realFix
      if (activeSession(state.navigation)?.mode === 'simulation') {
        set({ realFix, realReadings })
        return
      }
      set((prev) => ({
        ownShip: withMotion(prev.ownShip, speedKnots, courseDegrees),
        realFix,
        realReadings,
      }))
    }

    /** 航向补丁（HDT）：先回写真实读数缓存，非模拟会话再同步画面船位。 */
    function commitRealHeading(heading: Heading): void {
      if (get().hydration !== 'ready') return
      const state = get()
      const realReadings: RealReadings = {
        speedKnots: state.realReadings?.speedKnots ?? null,
        courseDegrees: state.realReadings?.courseDegrees ?? null,
        heading,
      }
      const realFix = state.realFix ? withHeading(state.realFix, heading) : state.realFix
      if (activeSession(state.navigation)?.mode === 'simulation') {
        set({ realFix, realReadings })
        return
      }
      set((prev) => ({ ownShip: withHeading(prev.ownShip, heading), realFix, realReadings }))
    }

    return {
    ownShip: initialOwnShip,
    realFix: null,
    realReadings: null,
    permission: LocationPermissionStatus.UNKNOWN,
    waypoints: [],
    routes: [],
    tracks: [],
    activeRouteId: '',
    notice: NoticeKey.NONE,
    hydrated: false,
    hydration: 'idle',
    loadError: null,
    resetError: null,
    navigation: IDLE_SESSION,
    persistence: { state: 'idle', message: null },

    setNotice: (notice) => {
      set({ notice })
    },
    setPermission: (permission) => {
      set({ permission })
    },
    applyGps: (fix) => {
      commitRealPosition({
        position: fix.position,
        speedKnots: fix.speedKnots,
        courseDegrees: fix.courseDegrees,
        heading: fix.heading,
        timestamp: fix.timestamp,
      })
    },
    applySentence: (sentence) => {
      if (get().hydration !== 'ready') return
      const parsed = parseNmea(sentence.trim())
      if (parsed.kind === NmeaKind.IGNORED) {
        set({ notice: NoticeKey.NMEA_IGNORED })
        return
      }
      if (parsed.kind === NmeaKind.HEADING) {
        commitRealHeading({ status: HeadingStatus.KNOWN, degrees: parsed.headingDegrees })
        set({ notice: NoticeKey.NMEA_APPLIED })
        return
      }
      if (parsed.kind === NmeaKind.MOTION) {
        commitRealMotion(parsed.speedKnots, parsed.courseDegrees)
        set({ notice: NoticeKey.NMEA_APPLIED })
        return
      }
      // FIX 与 POSITION 都走同一个真实位置入口；缺失字段由真实读数缓存补全，不读模拟船位。
      const result = parsed.kind === NmeaKind.POSITION
        ? commitRealPosition({
            position: parsed.position,
            speedKnots: null,
            courseDegrees: null,
            heading: null,
            timestamp: parsed.timestamp,
          })
        : commitRealPosition({
            position: parsed.position,
            speedKnots: parsed.speedKnots,
            courseDegrees: parsed.courseDegrees,
            heading: null,
            timestamp: parsed.timestamp,
          })
      if (!result.applied) return
      // 到点/偏航/完成等导航事件优先发布，只有没有事件时才报 NMEA 已应用。
      set({ notice: result.notice ?? NoticeKey.NMEA_APPLIED })
    },
    addWaypoint: (position, name) => {
      if (get().hydration !== 'ready') return
      const waypoint: Waypoint = {
        id: createId(),
        name,
        position,
        description: '',
        createdAt: now(),
      }
      set((state) => ({
        waypoints: state.waypoints.concat(waypoint),
        notice: NoticeKey.WAYPOINT_ADDED,
      }))
    },
    renameWaypoint: (waypointId, name) => {
      if (get().hydration !== 'ready') return
      const state = get()
      const trimmed = name.trim()
      if (trimmed === '') return
      const lockedRoute = state.routes.find(
        (route) => route.id === activeSession(state.navigation)?.routeId,
      )
      // 会话引用的航点锁定，与删除、排序共用同一把锁。
      if (lockedRoute?.waypointIds.includes(waypointId)) return
      if (!state.waypoints.some((waypoint) => waypoint.id === waypointId)) return
      set((prev) => ({
        waypoints: prev.waypoints.map((waypoint) => {
          if (waypoint.id !== waypointId) {
            return waypoint
          }
          return { ...waypoint, name: trimmed }
        }),
        notice: NoticeKey.WAYPOINT_RENAMED,
      }))
    },
    removeWaypoint: (waypointId) => {
      if (get().hydration !== 'ready') return
      const state = get()
      const lockedRoute = state.routes.find((route) => route.id === activeSession(state.navigation)?.routeId)
      if (lockedRoute?.waypointIds.includes(waypointId)) return
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
      if (get().hydration !== 'ready') return
      const state = get()
      if (activeSession(state.navigation) !== null) return
      if (state.waypoints.length < 2) {
        set({ notice: NoticeKey.ROUTE_NEED_WAYPOINT })
        return
      }
      const route: Route = {
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
      if (get().hydration !== 'ready') return
      const state = get()
      const nav = activeSession(state.navigation)
      if (nav !== null && nav.routeId !== routeId) return
      const route = state.routes.find((item) => item.id === routeId)
      if (route === undefined) {
        return
      }
      set({ activeRouteId: routeId, notice: NoticeKey.ROUTE_ACTIVATED })
    },
    setLegKind: (routeId, legKind) => {
      if (get().hydration !== 'ready') return
      if (sessionRouteLocked(get(), routeId)) return
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
    moveRouteNode: (routeId, waypointId, direction) => {
      if (get().hydration !== 'ready') return
      if (sessionRouteLocked(get(), routeId)) return
      set((state) => ({
        routes: state.routes.map((route) => {
          if (route.id !== routeId) {
            return route
          }
          const waypointIds = [...route.waypointIds]
          const index = waypointIds.indexOf(waypointId)
          const target = index + direction
          if (index < 0 || target < 0 || target >= waypointIds.length) {
            return route
          }
          const current = waypointIds[index]!
          const swap = waypointIds[target]!
          waypointIds[index] = swap
          waypointIds[target] = current
          return { ...route, waypointIds }
        }),
        notice: NoticeKey.LEG_UPDATED,
      }))
    },
    removeRouteNode: (routeId, waypointId) => {
      if (get().hydration !== 'ready') return
      if (sessionRouteLocked(get(), routeId)) return
      set((state) => ({
        routes: state.routes.map((route) => {
          if (route.id !== routeId) {
            return route
          }
          const waypointIds = route.waypointIds.filter((id) => id !== waypointId)
          if (waypointIds.length < 2) {
            return route
          }
          return { ...route, waypointIds }
        }),
      }))
    },
    retryPersist: () => {
      queue.retry()
    },
    resetCorruptData: () => {
      return resetCorruptData()
    },
    startRealNavigation: (routeId) => {
      if (get().hydration !== 'ready') return
      const state = get()
      if (activeSession(state.navigation) !== null) return
      const route = state.routes.find((item) => item.id === routeId)
      if (route === undefined) {
        return
      }
      const ordered = orderedWaypoints(route, state.waypoints)
      if (ordered.length < 2) {
        set({ notice: NoticeKey.ROUTE_NEED_WAYPOINT })
        return
      }
      // 真实导航必须有未过期的真实定位；模拟位置不能作为 GPS 船位。
      if (!isFreshFix(state.realFix, now())) {
        set({ notice: NoticeKey.NO_FIX })
        return
      }
      set({
        activeRouteId: route.id,
        ownShip: { ...state.realFix },
        navigation: {
          status: 'running',
          mode: 'real',
          routeId: route.id,
          activeIndex: 1,
          simulationSpeedKnots: state.navigation.simulationSpeedKnots,
        },
        notice: NoticeKey.NAV_STARTED,
      })
    },
    startSimulationNavigation: (routeId) => {
      if (get().hydration !== 'ready') return
      const state = get()
      if (activeSession(state.navigation) !== null) return
      const route = state.routes.find((item) => item.id === routeId)
      if (route === undefined) {
        return
      }
      const ordered = orderedWaypoints(route, state.waypoints)
      if (ordered.length < 2) {
        set({ notice: NoticeKey.ROUTE_NEED_WAYPOINT })
        return
      }
      // 模拟会话统一从首航点初始化，不复用当前 GPS 定位或上一次模拟终点。
      const ownShip: OwnShip = {
        status: FixStatus.FIXED,
        position: ordered[0]!.position,
        speedKnots: 0,
        courseDegrees: 0,
        heading: { status: HeadingStatus.UNKNOWN },
        timestamp: now(),
      }
      set({
        activeRouteId: route.id,
        ownShip,
        navigation: {
          status: 'running',
          mode: 'simulation',
          routeId: route.id,
          activeIndex: 1,
          simulationSpeedKnots: 6,
        },
        notice: NoticeKey.NAV_STARTED,
      })
    },
    setSimulationSpeed: (knots) => {
      const state = get()
      if (activeSession(state.navigation)?.mode !== 'simulation') return
      set({ navigation: { ...state.navigation, simulationSpeedKnots: Math.max(0, knots) } })
    },
    pauseNavigation: () => {
      if (get().hydration !== 'ready') return
      const nav = get().navigation
      if (nav.status !== 'running') {
        return
      }
      set({ navigation: { ...nav, status: 'paused' }, notice: NoticeKey.NAV_PAUSED })
    },
    resumeNavigation: () => {
      if (get().hydration !== 'ready') return
      const nav = get().navigation
      if (nav.status !== 'paused') {
        return
      }
      set({ navigation: { ...nav, status: 'running' }, notice: NoticeKey.NAV_RESUMED })
    },
    endNavigation: () => {
      if (get().hydration !== 'ready') return
      set({
        navigation: IDLE_SESSION,
        notice: NoticeKey.NAV_ENDED,
      })
    },
    simulationTick: (elapsedSeconds) => {
      if (get().hydration !== 'ready') return
      const state = get()
      const nav = state.navigation
      // 步进只驱动模拟会话；真实导航由 GPS 定位推进。
      if (nav.status !== 'running' || nav.mode !== 'simulation') {
        return
      }
      const route = state.routes.find((item) => item.id === nav.routeId)
      if (route === undefined) {
        return
      }
      const ordered = orderedWaypoints(route, state.waypoints)
      if (ordered.length < 2) {
        return
      }
      const current = state.ownShip
      const position = current.status === FixStatus.FIXED ? current.position : ordered[0]!.position
      const result = stepSimulation({
        waypoints: ordered,
        progress: { activeIndex: nav.activeIndex, position },
        speedKnots: nav.simulationSpeedKnots,
        elapsedSeconds,
        legKind: route.legKind,
      })
      const arrived = result.events.some((event) => event.type === 'ARRIVAL_WAYPOINT')
      const completed = result.events.some((event) => event.type === 'ROUTE_COMPLETE')
      set({
        ownShip: {
          status: FixStatus.FIXED,
          position: result.position,
          speedKnots: nav.simulationSpeedKnots,
          courseDegrees: result.courseDegrees,
          heading: current.status === FixStatus.FIXED ? current.heading : { status: HeadingStatus.UNKNOWN },
          timestamp: now(),
        },
        navigation: {
          status: completed ? 'ended' : 'running',
          mode: 'simulation',
          routeId: nav.routeId,
          activeIndex: result.activeIndex,
          simulationSpeedKnots: nav.simulationSpeedKnots,
        },
        notice: completed ? NoticeKey.ROUTE_COMPLETE : arrived ? NoticeKey.ARRIVAL_WAYPOINT : state.notice,
      })
    },
    }
  })

  const queue = new PersistenceQueue(options.storage, (persistence) => {
    store.setState({ persistence })
  })

  store.subscribe((state) => {
    if (state.hydration !== 'ready') return
    const snapshot: ReturnType<typeof emptySnapshot> = {
      waypoints: state.waypoints,
      routes: state.routes,
      tracks: state.tracks,
      activeRouteId: state.activeRouteId,
    }
    queue.save(serializeSnapshot(snapshot))
  })

  let hydrationPromise: Promise<void> | null = null

  async function doHydrate(): Promise<void> {
    let raw: string | null
    try {
      raw = await options.storage.load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      store.setState({
        hydration: 'failed',
        hydrated: false,
        loadError: { kind: 'read', message: `读取本地数据失败：${message}` },
        resetError: null,
      })
      return
    }

    const parsed = parsePersist(raw)
    if (parsed.kind === 'valid') {
      queue.setBaseline(serializeSnapshot(parsed.data))
      store.setState({
        waypoints: parsed.data.waypoints,
        routes: parsed.data.routes,
        tracks: parsed.data.tracks,
        activeRouteId: parsed.data.activeRouteId,
        hydrated: true,
        hydration: 'ready',
        loadError: null,
        resetError: null,
      })
      return
    }

    store.setState({
      hydration: 'failed',
      hydrated: false,
      loadError: { kind: parsed.kind, message: parsed.message },
      resetError: null,
    })
  }

  let resetPromise: Promise<void> | null = null

  function hydrate(): Promise<void> {
    const current = store.getState()
    if (current.hydration === 'ready') {
      return Promise.resolve()
    }
    if (hydrationPromise !== null) {
      return hydrationPromise
    }
    store.setState({ hydration: 'loading', loadError: null, resetError: null })
    hydrationPromise = (async () => {
      if (resetPromise !== null) {
        await resetPromise
      }
      if (store.getState().hydration === 'ready') {
        return
      }
      await doHydrate()
    })().finally(() => {
      hydrationPromise = null
    })
    return hydrationPromise
  }

  async function doReset(): Promise<void> {
    const serialized = serializeSnapshot(emptySnapshot())
    try {
      await options.storage.save(serialized)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 保留损坏错误分类，清空写入原因记入独立 resetError，界面保留重试入口。
      store.setState({ resetError: `清空本地数据失败：${message}` })
      return
    }
    queue.setBaseline(serialized)
    store.setState({
      waypoints: [],
      routes: [],
      tracks: [],
      activeRouteId: '',
      realFix: null,
      realReadings: null,
      hydrated: true,
      hydration: 'ready',
      loadError: null,
      resetError: null,
      persistence: { state: 'idle', message: null },
    })
  }

  function resetCorruptData(): Promise<void> {
    const current = store.getState()
    if (current.hydration !== 'failed' || current.loadError?.kind !== 'corrupt') {
      return Promise.resolve()
    }
    if (resetPromise !== null) {
      return resetPromise
    }
    resetPromise = doReset().finally(() => {
      resetPromise = null
    })
    return resetPromise
  }

  return { store, hydrate, resetCorruptData }
}
