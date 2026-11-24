import { beforeEach, describe, expect, it } from 'vitest'
import {
  createNavigationStore,
  projectChartLayers,
  selectActiveLeg,
  selectNavigationGuidance,
} from '../src'
import type { NavigationState } from '../src'
import { ArrivalStatus, LegKind } from '@navigation/core'

const NOW = '2026-11-24T00:00:00.000Z'

function memoryStorage() {
  let value: string | null = null
  return {
    load: async () => value,
    save: async (next: string) => {
      value = next
    },
    peek: () => value,
  }
}

function createStore(storage = memoryStorage()) {
  let sequence = 0
  const handle = createNavigationStore({
    storage,
    createId: () => `id-${++sequence}`,
    now: () => NOW,
  })
  return { handle, storage }
}

async function flushPersistence(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

/** 三点航线：沿经线，相邻约 1 海里，便于手算剩余距离。 */
async function threePointRoute() {
  const { handle, storage } = createStore()
  await handle.hydrate()
  const store = handle.store
  const actions = store.getState()
  actions.addWaypoint({ latitude: 30, longitude: 122 }, 'A')
  actions.addWaypoint({ latitude: 30.01667, longitude: 122 }, 'B')
  actions.addWaypoint({ latitude: 30.03333, longitude: 122 }, 'C')
  store.getState().createRoute('R1')
  return { storage, store }
}

describe('共享海图投影', () => {
  it('投影同一组航点、当前航线、当前航段、本船与空轨迹', async () => {
    const { store } = await threePointRoute()
    const state = store.getState()
    const routeId = state.activeRouteId
    expect(state.waypoints).toHaveLength(3)

    store.getState().startSimulationNavigation(routeId)
    const selected = selectActiveLeg(store.getState())
    expect(selected.activeIndex).toBe(1)
    expect(selected.to?.name).toBe('B')

    const layers = projectChartLayers(store.getState())
    expect(layers.waypoints.features).toHaveLength(3)
    expect(layers.route.features).toHaveLength(1)
    expect(layers.route.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [122, 30],
        [122, 30.01667],
        [122, 30.03333],
      ],
    })
    expect(layers.leg.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [122, 30],
        [122, 30.01667],
      ],
    })
    expect(layers.ownShip.features.some((feature) => feature.properties?.kind === 'ship')).toBe(true)
    expect(layers.track.features).toHaveLength(0)
  })

  it('同一状态给出相同的下一航点、剩余距离与 ETA', async () => {
    const { store } = await threePointRoute()
    store.getState().startSimulationNavigation(store.getState().activeRouteId)
    const state = store.getState()
    const guidance = selectNavigationGuidance(state, NOW)

    expect(guidance.leg.to?.name).toBe('B')
    expect(guidance.leg.nextDistanceNauticalMiles).toBeCloseTo(1, 2)
    // B 到 C 约 1 海里，全程剩余约 2 海里。
    expect(guidance.leg.remainingDistanceNauticalMiles).toBeCloseTo(2, 2)
    expect(guidance.speedKnots).toBe(6)
    expect(guidance.arrival?.status).toBe(ArrivalStatus.MOVING)
    if (guidance.arrival?.status === ArrivalStatus.MOVING) {
      expect(guidance.arrival.hours).toBeCloseTo(guidance.leg.remainingDistanceNauticalMiles / 6, 4)
    }
    expect(guidance.crossTrack?.distanceNauticalMiles).toBeLessThan(0.01)
    expect(guidance.canStartRealNavigation).toBe(false)
  })

  it('切换距离圈/航向线只影响本船图层，不改变导航状态', async () => {
    const { store } = await threePointRoute()
    store.getState().startSimulationNavigation(store.getState().activeRouteId)
    const before = JSON.stringify(store.getState())

    const plain = projectChartLayers(store.getState(), { rings: false, vectors: false })
    const full = projectChartLayers(store.getState(), { rings: true, vectors: true })
    expect(plain.ownShip.features.length).toBeLessThan(full.ownShip.features.length)
    expect(JSON.stringify(store.getState())).toBe(before)
  })
})

describe('三点航线模拟流程', () => {
  it('暂停后船位停止，继续后跨过中间点并切到第二段，到终点后结束', async () => {
    const { store } = await threePointRoute()
    store.getState().startSimulationNavigation(store.getState().activeRouteId)
    // 6 节 × 12 分钟 = 1.2 海里，跨过 B（约 1 海里）。
    store.getState().simulationTick(720)
    expect(store.getState().navigation.status).toBe('running')
    expect(store.getState().navigation.activeIndex).toBe(2)
    expect(selectActiveLeg(store.getState()).to?.name).toBe('C')

    store.getState().pauseNavigation()
    const pausedPosition = store.getState().ownShip.position
    store.getState().simulationTick(600)
    expect(store.getState().ownShip.position).toEqual(pausedPosition)
    expect(store.getState().navigation.status).toBe('paused')

    store.getState().resumeNavigation()
    expect(store.getState().navigation.status).toBe('running')
    // 剩余约 0.8 海里；6 节 × 10 分钟 = 1 海里，足以到终点。
    store.getState().simulationTick(600)
    expect(store.getState().navigation.status).toBe('ended')
    expect(selectNavigationGuidance(store.getState(), NOW).leg.remainingDistanceNauticalMiles).toBeLessThan(0.001)
  })

  it('重启后航点和航线仍在，模拟会话不自动恢复', async () => {
    const { store, storage } = await threePointRoute()
    store.getState().startSimulationNavigation(store.getState().activeRouteId)
    store.getState().simulationTick(120)
    for (let attempt = 0; attempt < 20 && storage.peek() === null; attempt += 1) {
      await flushPersistence()
    }
    expect(storage.peek()).toContain('"waypoints"')

    const restarted = createNavigationStore({
      storage,
      createId: () => 'restart-1',
      now: () => NOW,
    })
    await restarted.hydrate()
    const state: NavigationState = restarted.store.getState()
    expect(state.waypoints).toHaveLength(3)
    expect(state.routes).toHaveLength(1)
    expect(state.navigation.status).toBe('idle')
    expect(state.activeRouteId).toBe(store.getState().activeRouteId)
  })

  it('绘制航法切换与重命名在会话前可用，会话中锁定航线节点', async () => {
    const { store } = await threePointRoute()
    const routeId = store.getState().activeRouteId
    const waypointId = store.getState().waypoints[0]!.id

    store.getState().renameWaypoint(waypointId, '起点')
    expect(store.getState().waypoints[0]?.name).toBe('起点')
    store.getState().setLegKind(routeId, LegKind.GREAT_CIRCLE)
    expect(store.getState().routes[0]?.legKind).toBe(LegKind.GREAT_CIRCLE)

    store.getState().startSimulationNavigation(routeId)
    store.getState().renameWaypoint(waypointId, '改名失败')
    expect(store.getState().waypoints[0]?.name).toBe('起点')
    store.getState().moveRouteNode(routeId, waypointId, 1)
    expect(store.getState().routes[0]?.waypointIds[0]).toBe(waypointId)
    store.getState().setLegKind(routeId, LegKind.RHUMB)
    expect(store.getState().routes[0]?.legKind).toBe(LegKind.GREAT_CIRCLE)
  })
})
