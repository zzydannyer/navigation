import { describe, expect, it } from 'vitest'
import { FixStatus, HeadingStatus, LegKind, NoticeKey } from '@navigation/core'
import { createNavigationStore } from '../src/store/createNavigationStore'
import { selectActiveLeg } from '../src/store/selectActiveLeg'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface TestStorage {
  load(): Promise<string | null>
  save(next: string): Promise<void>
  value: string | null
  saveCalls: string[]
  pending: Deferred<void>[]
  loads: number
}

function testStorage(initial: string | null): TestStorage {
  let value = initial
  const saveCalls: string[] = []
  const pending: Deferred<void>[] = []
  let loads = 0
  return {
    get value() {
      return value
    },
    get saveCalls() {
      return saveCalls
    },
    get pending() {
      return pending
    },
    get loads() {
      return loads
    },
    async load() {
      loads += 1
      return value
    },
    async save(next: string) {
      saveCalls.push(next)
      const item = deferred<void>()
      pending.push(item)
      value = next
      return item.promise
    },
  }
}

const tick = () => Promise.resolve()

/** 排空异步链上的若干微任务跳转；不使用固定定时器判断竞态。 */
async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await tick()
  }
}

let idCounter = 0
const createId = () => `id-${idCounter++}`

function freshStore(storage: TestStorage, now: () => string = fixedNow) {
  idCounter = 0
  return createNavigationStore({ storage, createId, now })
}

const fixedNow = () => '2026-01-01T00:00:00.000Z'

function nmea(body: string): string {
  let checksum = 0
  for (let index = 0; index < body.length; index += 1) {
    checksum ^= body.charCodeAt(index)
  }
  return `$${body}*${checksum.toString(16).toUpperCase().padStart(2, '0')}`
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

function nmeaCoordinate(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative
  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutes = (absolute - degrees) * 60
  return `${pad(degrees)}${minutes.toFixed(4).padStart(7, '0')},${hemisphere}`
}

function utcClock(when: Date): string {
  return `${pad(when.getUTCHours())}${pad(when.getUTCMinutes())}${pad(when.getUTCSeconds())}`
}

function utcDate(when: Date): string {
  return `${pad(when.getUTCDate())}${pad(when.getUTCMonth() + 1)}${pad(when.getUTCFullYear() % 100)}`
}

/** 用当前 UTC 时间构造 RMC，时间戳与真实系统时间一致才能通过有效期校验。 */
function rmc(latitude: number, longitude: number, speedKnots: number, courseDegrees: number, when = new Date()) {
  return nmea(
    `GPRMC,${utcClock(when)},A,${nmeaCoordinate(latitude, 'N', 'S')},${nmeaCoordinate(longitude, 'E', 'W')},`
    + `${speedKnots.toFixed(1)},${courseDegrees.toFixed(1)},${utcDate(when)},,A`,
  )
}

function gga(latitude: number, longitude: number, when = new Date()) {
  return nmea(
    `GPGGA,${utcClock(when)},${nmeaCoordinate(latitude, 'N', 'S')},${nmeaCoordinate(longitude, 'E', 'W')},`
    + '1,08,0.9,0.0,M,0.0,M,,',
  )
}

function vtg(speedKnots: number, courseDegrees: number) {
  return nmea(`GPVTG,${courseDegrees.toFixed(1)},T,,M,${speedKnots.toFixed(1)},N,,K`)
}

function hdt(headingDegrees: number) {
  return nmea(`GPHDT,${headingDegrees.toFixed(1)},T`)
}

const realNow = () => new Date().toISOString()

async function flushSaves(storage: TestStorage) {
  for (let round = 0; round < 3; round += 1) {
    storage.pending.forEach((item) => item.resolve())
    storage.pending.length = 0
    await flush()
  }
}

const validBody = {
  waypoints: [
    {
      id: 'w1',
      name: 'A',
      position: { latitude: 30, longitude: 122 },
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  routes: [],
  tracks: [],
  activeRouteId: '',
}

describe('createNavigationStore hydration', () => {
  it('two concurrent hydrate calls read storage only once', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    const first = handle.hydrate()
    const second = handle.hydrate()
    await Promise.all([first, second])
    expect(storage.loads).toBe(1)
    expect(handle.store.getState().hydration).toBe('ready')
  })

  it('recovers to editable state after first read fails and second succeeds', async () => {
    let readFail = true
    const storage: TestStorage = testStorage(null)
    const originalLoad = storage.load.bind(storage)
    storage.load = async () => {
      if (readFail) {
        throw new Error('io failure')
      }
      return originalLoad()
    }
    const handle = freshStore(storage)

    await handle.hydrate()
    expect(handle.store.getState().hydration).toBe('failed')
    expect(handle.store.getState().loadError?.kind).toBe('read')

    readFail = false
    await handle.hydrate()
    expect(handle.store.getState().hydration).toBe('ready')
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'A')
    expect(handle.store.getState().waypoints).toHaveLength(1)
  })

  it('blocks waypoint, route and track mutations while hydrating, and writes no empty snapshot', async () => {
    const loadDeferred = deferred<string | null>()
    let loads = 0
    const storage: TestStorage = testStorage(null)
    storage.load = async () => {
      loads += 1
      return loadDeferred.promise
    }
    const handle = freshStore(storage)

    const pending = handle.hydrate()
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'Blocked')
    handle.store.getState().createRoute('Blocked')
    expect(handle.store.getState().waypoints).toEqual([])
    expect(handle.store.getState().routes).toEqual([])
    expect(storage.saveCalls).toHaveLength(0)

    loadDeferred.resolve(null)
    await pending
    expect(handle.store.getState().hydration).toBe('ready')
    expect(storage.saveCalls).toHaveLength(0)
  })

  it('hydrate on valid data produces no cold-start write', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    expect(storage.saveCalls).toHaveLength(0)
  })

  it('loads legacy body without schemaVersion and version 1 body', async () => {
    const legacy = testStorage(JSON.stringify(validBody))
    const legacyHandle = freshStore(legacy)
    await legacyHandle.hydrate()
    expect(legacyHandle.store.getState().waypoints).toHaveLength(1)

    const v1 = testStorage(JSON.stringify({ schemaVersion: 1, ...validBody }))
    const v1Handle = freshStore(v1)
    await v1Handle.hydrate()
    expect(v1Handle.store.getState().waypoints).toHaveLength(1)
  })

  it('rejects an unknown schema version without writing back', async () => {
    const storage = testStorage(JSON.stringify({ schemaVersion: 99, ...validBody }))
    const handle = freshStore(storage)
    await handle.hydrate()
    expect(handle.store.getState().hydration).toBe('failed')
    expect(handle.store.getState().loadError?.kind).toBe('unsupported-version')
    expect(storage.saveCalls).toHaveLength(0)
  })
})

describe('createNavigationStore corrupt recovery', () => {
  it('does not overwrite corrupt data; reset succeeds only after empty snapshot is written, then editing is allowed', async () => {
    const raw = '{not-json-at-all'
    const storage = testStorage(raw)
    const handle = freshStore(storage)

    await handle.hydrate()
    expect(handle.store.getState().hydration).toBe('failed')
    expect(handle.store.getState().loadError?.kind).toBe('corrupt')
    expect(storage.value).toBe(raw)
    expect(storage.saveCalls).toHaveLength(0)

    const resetDone = handle.resetCorruptData()
    await flush()
    storage.pending.forEach((item) => item.resolve())
    storage.pending.length = 0
    await resetDone
    expect(handle.store.getState().hydration).toBe('ready')
    expect(handle.store.getState().hydrated).toBe(true)
    const written = JSON.parse(storage.value ?? '{}')
    expect(written.waypoints).toEqual([])

    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'Recovered')
    expect(handle.store.getState().waypoints).toHaveLength(1)
  })

  it('keeps failed state when reset write fails; a later successful reset enters ready', async () => {
    let resetFails = true
    const storage: TestStorage = testStorage('{not-json')
    storage.save = async (next: string) => {
      if (resetFails) {
        throw new Error('write failure')
      }
      storage.saveCalls.push(next)
    }
    const handle = freshStore(storage)
    await handle.hydrate()
    expect(handle.store.getState().hydration).toBe('failed')

    await handle.resetCorruptData()
    await flush()
    expect(handle.store.getState().hydration).toBe('failed')
    expect(handle.store.getState().hydrated).toBe(false)
    expect(handle.store.getState().loadError?.kind).toBe('corrupt')
    expect(handle.store.getState().resetError).toContain('write failure')

    resetFails = false
    await handle.resetCorruptData()
    await flush()
    expect(handle.store.getState().hydration).toBe('ready')
    expect(handle.store.getState().resetError).toBeNull()
  })

  it('rejects reset on ready, loading and unsupported-version without calling storage.save', async () => {
    const readyStorage = testStorage(null)
    const readyHandle = freshStore(readyStorage)
    await readyHandle.hydrate()
    await readyHandle.resetCorruptData()
    expect(readyStorage.saveCalls).toHaveLength(0)

    const loadDeferred = deferred<string | null>()
    let loads = 0
    const loadingStorage: TestStorage = testStorage(null)
    loadingStorage.load = async () => {
      loads += 1
      return loadDeferred.promise
    }
    const loadingHandle = freshStore(loadingStorage)
    const pendingHydrate = loadingHandle.hydrate()
    await loadingHandle.resetCorruptData()
    expect(loadingStorage.saveCalls).toHaveLength(0)
    loadDeferred.resolve(null)
    await pendingHydrate

    const unknownStorage = testStorage(JSON.stringify({ schemaVersion: 99, ...validBody }))
    const unknownHandle = freshStore(unknownStorage)
    await unknownHandle.hydrate()
    await unknownHandle.resetCorruptData()
    expect(unknownStorage.saveCalls).toHaveLength(0)
  })

  it('concurrent reset calls write once; hydrate waits for reset instead of loading concurrently', async () => {
    const storage = testStorage('{not-json')
    const handle = freshStore(storage)
    await handle.hydrate()
    expect(storage.loads).toBe(1)

    const firstReset = handle.resetCorruptData()
    const secondReset = handle.resetCorruptData()
    expect(storage.saveCalls).toHaveLength(1)

    const hydrateDuringReset = handle.hydrate()
    expect(storage.loads).toBe(1)

    storage.pending.forEach((item) => item.resolve())
    storage.pending.length = 0
    await Promise.all([firstReset, secondReset, hydrateDuringReset])
    expect(handle.store.getState().hydration).toBe('ready')
    expect(storage.loads).toBe(1)
  })
})

describe('createNavigationStore persistence', () => {
  it('loads a valid waypoint from storage', async () => {
    const storage = testStorage(JSON.stringify(validBody))
    const handle = freshStore(storage)
    await handle.hydrate()
    expect(handle.store.getState().waypoints).toHaveLength(1)
    expect(handle.store.getState().waypoints[0].id).toBe('w1')
  })

  it('persists state when a waypoint is added after hydrate', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'SW Offing')
    await flushSaves(storage)
    const written = JSON.parse(storage.value ?? '{}')
    expect(written.waypoints).toHaveLength(1)
    expect(written.waypoints[0].name).toBe('SW Offing')
  })

  it('createRoute requires at least two waypoints and defaults to RHUMB', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'A')
    handle.store.getState().addWaypoint({ latitude: 30.02, longitude: 122 }, 'B')
    handle.store.getState().createRoute('Crossing')
    expect(handle.store.getState().routes).toHaveLength(1)
    expect(handle.store.getState().routes[0].legKind).toBe(LegKind.RHUMB)
  })

  it('keeps the latest snapshot when writes are triggered back to back', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'A')
    handle.store.getState().addWaypoint({ latitude: 30.02, longitude: 122 }, 'B')
    await flushSaves(storage)
    const written = JSON.parse(storage.value ?? '{}')
    expect(written.waypoints).toHaveLength(2)
    expect(written.waypoints.map((waypoint: { name: string }) => waypoint.name)).toEqual(['A', 'B'])
  })

  it('reports save failure and recovers through retryPersist', async () => {
    let saveCalls = 0
    let value: string | null = null
    const storage: TestStorage = testStorage(null)
    storage.save = async (next: string) => {
      saveCalls += 1
      if (saveCalls === 1) {
        throw new Error('disk full')
      }
      value = next
    }
    const handle = freshStore(storage)
    await handle.hydrate()
    handle.store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'A')
    await tick()
    expect(handle.store.getState().persistence.state).toBe('failed')

    handle.store.getState().retryPersist()
    await tick()
    expect(handle.store.getState().persistence.state).toBe('saved')
    expect(value).not.toBeNull()
  })
})

describe('createNavigationStore navigation session', () => {
  async function seedRoute(handle: ReturnType<typeof freshStore>, points: Array<{ latitude: number; longitude: number; name: string }>) {
    const state = handle.store.getState()
    points.forEach((point) => state.addWaypoint({ latitude: point.latitude, longitude: point.longitude }, point.name))
    state.createRoute('R')
    return handle.store.getState().routes[0]!
  }

  const fix = (latitude: number, longitude: number, speedKnots = 6) => ({
    position: { latitude, longitude },
    speedKnots,
    courseDegrees: 0,
    heading: { status: HeadingStatus.UNKNOWN },
    timestamp: '2026-01-01T00:00:00.000Z',
  })

  it('starts a simulation session, pauses, resumes and ends', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    let nav = handle.store.getState().navigation
    expect(nav.status).toBe('running')
    expect(nav.mode).toBe('simulation')
    expect(nav.activeIndex).toBe(1)
    expect(handle.store.getState().activeRouteId).toBe(route.id)

    handle.store.getState().pauseNavigation()
    expect(handle.store.getState().navigation.status).toBe('paused')

    handle.store.getState().resumeNavigation()
    expect(handle.store.getState().navigation.status).toBe('running')

    handle.store.getState().endNavigation()
    nav = handle.store.getState().navigation
    expect(nav.status).toBe('idle')
    expect(nav.routeId).toBe('')
  })

  it('does not advance while paused; a running sim tick uses the independent sim speed', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().pauseNavigation()
    const pausedPosition = handle.store.getState().ownShip
    handle.store.getState().simulationTick(300)
    const stillPaused = handle.store.getState().ownShip
    expect(stillPaused).toEqual(pausedPosition)

    handle.store.getState().resumeNavigation()
    handle.store.getState().setSimulationSpeed(6)
    handle.store.getState().simulationTick(300)
    const moving = handle.store.getState().ownShip
    expect(moving.status).toBe(FixStatus.FIXED)
    if (moving.status === FixStatus.FIXED) {
      expect(moving.position.latitude).toBeGreaterThan(30)
    }
  })

  it('blocks real navigation without a valid fix and never fabricates the first waypoint', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startRealNavigation(route.id)
    expect(handle.store.getState().navigation.status).toBe('idle')
    expect(handle.store.getState().notice).toBe(NoticeKey.NO_FIX)
    expect(handle.store.getState().ownShip.status).toBe(FixStatus.NO_FIX)
  })

  it('marks route complete when a real GPS fix reaches the final waypoint', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps(fix(30, 122))
    handle.store.getState().startRealNavigation(route.id)
    handle.store.getState().applyGps({ ...fix(30.01667, 122), timestamp: '2026-01-01T00:00:10.000Z' })
    const nav = handle.store.getState().navigation
    expect(nav.status).toBe('ended')
    expect(nav.mode).toBe('real')
    expect(handle.store.getState().notice).toBe(NoticeKey.ROUTE_COMPLETE)
  })

  it('flags an off-track real fix without leaving the running session', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps(fix(30, 122))
    handle.store.getState().startRealNavigation(route.id)
    handle.store.getState().applyGps({ ...fix(30.008, 122.02), timestamp: '2026-01-01T00:00:10.000Z' })
    expect(handle.store.getState().notice).toBe(NoticeKey.OFF_TRACK)
    expect(handle.store.getState().navigation.status).toBe('running')
  })

  it('does not advance a real session through the simulation tick', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps(fix(30, 122))
    handle.store.getState().startRealNavigation(route.id)
    const before = handle.store.getState().ownShip
    handle.store.getState().simulationTick(300)
    const after = handle.store.getState().ownShip
    expect(after).toEqual(before)
    expect(handle.store.getState().navigation.activeIndex).toBe(1)
  })

  it('does not let a real GPS fix override the simulation ship position', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().setSimulationSpeed(6)
    handle.store.getState().simulationTick(120)
    const simShip = handle.store.getState().ownShip
    handle.store.getState().applyGps(fix(31, 123, 12))
    expect(handle.store.getState().ownShip).toEqual(simShip)
    expect(handle.store.getState().navigation.mode).toBe('simulation')
  })

  it('selects the middle-to-final leg after passing the middle waypoint', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
      { latitude: 30.03333, longitude: 122, name: 'C' },
    ])
    const [, b, c] = handle.store.getState().waypoints

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().setSimulationSpeed(6)
    // 6 节 × 720 秒 = 1.2 海里，越过 B 进入 B→C 航段。
    handle.store.getState().simulationTick(720)

    const leg = selectActiveLeg(handle.store.getState())
    expect(leg.activeIndex).toBe(2)
    expect(leg.from?.id).toBe(b!.id)
    expect(leg.to?.id).toBe(c!.id)
    expect(leg.remainingDistanceNauticalMiles).toBeGreaterThanOrEqual(leg.nextDistanceNauticalMiles)
  })

  it('rejects route edits while a session is running or paused', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01, longitude: 122, name: 'B' },
      { latitude: 30.02, longitude: 122, name: 'C' },
    ])
    const [a, b, c] = handle.store.getState().waypoints
    handle.store.getState().startSimulationNavigation(route.id)

    const snapshot = () => ({
      waypointIds: [...handle.store.getState().routes[0]!.waypointIds],
      legKind: handle.store.getState().routes[0]!.legKind,
      waypointCount: handle.store.getState().waypoints.length,
      routeCount: handle.store.getState().routes.length,
    })
    const locked = snapshot()

    handle.store.getState().moveRouteNode(route.id, b!.id, -1)
    handle.store.getState().removeRouteNode(route.id, c!.id)
    handle.store.getState().setLegKind(route.id, LegKind.GREAT_CIRCLE)
    handle.store.getState().removeWaypoint(b!.id)
    handle.store.getState().createRoute('R2')
    handle.store.getState().startRealNavigation(route.id)
    expect(snapshot()).toEqual(locked)

    handle.store.getState().pauseNavigation()
    handle.store.getState().moveRouteNode(route.id, a!.id, 1)
    handle.store.getState().removeWaypoint(a!.id)
    handle.store.getState().setLegKind(route.id, LegKind.GREAT_CIRCLE)
    expect(snapshot()).toEqual(locked)
  })

  it('moves and removes route nodes when no session is active', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01, longitude: 122, name: 'B' },
      { latitude: 30.02, longitude: 122, name: 'C' },
    ])
    const [a, b, c] = handle.store.getState().waypoints
    handle.store.getState().moveRouteNode(route.id, b!.id, -1)
    expect(handle.store.getState().routes[0]!.waypointIds).toEqual([b!.id, a!.id, c!.id])

    handle.store.getState().removeRouteNode(route.id, c!.id)
    expect(handle.store.getState().routes[0]!.waypointIds).toHaveLength(2)
  })

  it('rejects real navigation after a simulation ends when no real fix is cached', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().endNavigation()
    handle.store.getState().startRealNavigation(route.id)
    expect(handle.store.getState().navigation.status).toBe('idle')
    expect(handle.store.getState().notice).toBe(NoticeKey.NO_FIX)
  })

  it('starts real navigation from the cached real position, not the sim ship', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps(fix(30.01, 122))
    handle.store.getState().startRealNavigation(route.id)
    const ship = handle.store.getState().ownShip
    expect(handle.store.getState().navigation.mode).toBe('real')
    expect(ship.status).toBe(FixStatus.FIXED)
    if (ship.status === FixStatus.FIXED) {
      expect(ship.position.latitude).toBeCloseTo(30.01, 5)
    }
  })

  it('rejects a stale cached real fix', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps({ ...fix(30, 122), timestamp: '2025-12-31T23:00:00.000Z' })
    handle.store.getState().startRealNavigation(route.id)
    expect(handle.store.getState().navigation.status).toBe('idle')
    expect(handle.store.getState().notice).toBe(NoticeKey.NO_FIX)
  })

  it('restarts simulation from the first waypoint instead of the previous sim endpoint', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, fixedNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().setSimulationSpeed(6)
    handle.store.getState().simulationTick(720)
    handle.store.getState().endNavigation()
    handle.store.getState().startSimulationNavigation(route.id)

    const ship = handle.store.getState().ownShip
    expect(ship.status).toBe(FixStatus.FIXED)
    if (ship.status === FixStatus.FIXED) {
      expect(ship.position.latitude).toBeCloseTo(30, 5)
      expect(ship.position.longitude).toBeCloseTo(122, 5)
    }
  })

  it('feeds an NMEA FIX into realFix during a simulation without touching the sim ship', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    const simShip = handle.store.getState().ownShip
    handle.store.getState().applySentence(rmc(48.1173, 11.5167, 22.4, 84.4))

    const fix = handle.store.getState().realFix
    expect(fix?.status).toBe(FixStatus.FIXED)
    if (fix?.status === FixStatus.FIXED) {
      expect(fix.position.latitude).toBeCloseTo(48.1173, 3)
      expect(fix.speedKnots).toBeCloseTo(22.4, 1)
    }
    expect(handle.store.getState().ownShip).toEqual(simShip)
  })

  it('keeps an NMEA heading update in realFix during a simulation', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().applySentence(rmc(48.1173, 11.5167, 22.4, 84.4))
    handle.store.getState().applySentence(hdt(84.4))

    const fix = handle.store.getState().realFix
    expect(fix?.status).toBe(FixStatus.FIXED)
    if (fix?.status === FixStatus.FIXED) {
      expect(fix.heading.status).toBe(HeadingStatus.KNOWN)
    }
    expect(handle.store.getState().ownShip.status).toBe(FixStatus.FIXED)
    if (handle.store.getState().ownShip.status === FixStatus.FIXED) {
      expect(handle.store.getState().ownShip.position.latitude).toBeCloseTo(30, 5)
    }
  })

  it('applies an NMEA FIX to ownShip and tracks outside a simulation', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()

    handle.store.getState().applySentence(rmc(48.1173, 11.5167, 22.4, 84.4))
    const ship = handle.store.getState().ownShip
    expect(ship.status).toBe(FixStatus.FIXED)
    if (ship.status === FixStatus.FIXED) {
      expect(ship.position.latitude).toBeCloseTo(48.1173, 3)
    }
    expect(handle.store.getState().realFix).toEqual(ship)
    expect(handle.store.getState().tracks).toHaveLength(1)
  })

  it('keeps real speed, course and heading from VTG/HDT that arrive before the position', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()

    handle.store.getState().applySentence(vtg(12, 90))
    handle.store.getState().applySentence(hdt(45))
    expect(handle.store.getState().ownShip.status).toBe(FixStatus.NO_FIX)

    handle.store.getState().applySentence(gga(30, 122))
    const ship = handle.store.getState().ownShip
    expect(ship.status).toBe(FixStatus.FIXED)
    if (ship.status === FixStatus.FIXED) {
      expect(ship.speedKnots).toBeCloseTo(12, 1)
      expect(ship.courseDegrees).toBeCloseTo(90, 1)
      expect(ship.heading).toEqual({ status: HeadingStatus.KNOWN, degrees: 45 })
    }
  })

  it('does not inherit the simulation speed for the first real GGA during a simulation', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().startSimulationNavigation(route.id)
    handle.store.getState().setSimulationSpeed(20)
    handle.store.getState().applySentence(gga(30.01, 122))

    const fix = handle.store.getState().realFix
    expect(fix?.status).toBe(FixStatus.FIXED)
    if (fix?.status === FixStatus.FIXED) {
      expect(fix.speedKnots).toBe(0)
      expect(fix.courseDegrees).toBe(0)
      expect(fix.heading.status).toBe(HeadingStatus.UNKNOWN)
    }
    expect(handle.store.getState().navigation.simulationSpeedKnots).toBe(20)
    expect(handle.store.getState().ownShip.status).toBe(FixStatus.FIXED)
  })

  it('keeps the completion notice when an NMEA fix finishes the route', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage, realNow)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps({
      position: { latitude: 30, longitude: 122 },
      speedKnots: 6,
      courseDegrees: 0,
      heading: null,
      timestamp: new Date(Date.now() - 5000).toISOString(),
    })
    handle.store.getState().startRealNavigation(route.id)
    handle.store.getState().applySentence(rmc(30.01667, 122, 6, 0))

    expect(handle.store.getState().navigation.status).toBe('ended')
    expect(handle.store.getState().notice).toBe(NoticeKey.ROUTE_COMPLETE)
  })

  it('rejects out-of-range coordinates without touching the ship or tracks', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()

    handle.store.getState().applyGps({ ...fix(95, 200) })
    expect(handle.store.getState().realFix).toBeNull()
    expect(handle.store.getState().ownShip.status).toBe(FixStatus.NO_FIX)
    expect(handle.store.getState().tracks).toHaveLength(0)
  })

  it('rejects a future fix beyond tolerance but accepts one inside it', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()

    handle.store.getState().applyGps({ ...fix(30, 122), timestamp: '2026-01-01T00:02:00.000Z' })
    expect(handle.store.getState().realFix).toBeNull()

    handle.store.getState().applyGps({ ...fix(30, 122), timestamp: '2026-01-01T00:00:30.000Z' })
    expect(handle.store.getState().realFix?.status).toBe(FixStatus.FIXED)
  })

  it('ignores an out-of-order fix at the final waypoint and duplicate timestamps', async () => {
    const storage = testStorage(null)
    const handle = freshStore(storage)
    await handle.hydrate()
    const route = await seedRoute(handle, [
      { latitude: 30, longitude: 122, name: 'A' },
      { latitude: 30.01667, longitude: 122, name: 'B' },
    ])

    handle.store.getState().applyGps(fix(30, 122))
    handle.store.getState().startRealNavigation(route.id)
    expect(handle.store.getState().navigation.activeIndex).toBe(1)

    handle.store.getState().applyGps({ ...fix(30.01667, 122), timestamp: '2025-12-31T23:59:00.000Z' })
    const nav = handle.store.getState().navigation
    expect(nav.status).toBe('running')
    expect(nav.activeIndex).toBe(1)

    handle.store.getState().applyGps(fix(30.005, 122))
    expect(handle.store.getState().tracks).toHaveLength(1)
  })
})
