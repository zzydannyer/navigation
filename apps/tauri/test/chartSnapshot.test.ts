import { describe, expect, it } from 'vitest'
import { createNavigationStore, projectChartLayers } from '@navigation/app'
import { buildChartSnapshot } from '../src/features/chart/chartSnapshot'

const NOW = '2026-11-24T00:00:00.000Z'

async function navigatedState() {
  let sequence = 0
  const handle = createNavigationStore({
    storage: { load: async () => null, save: async () => undefined },
    createId: () => `tauri-${++sequence}`,
    now: () => NOW,
  })
  await handle.hydrate()
  const store = handle.store
  const actions = store.getState()
  actions.addWaypoint({ latitude: 30, longitude: 122 }, 'A')
  actions.addWaypoint({ latitude: 30.01667, longitude: 122 }, 'B')
  actions.addWaypoint({ latitude: 30.03333, longitude: 122 }, 'C')
  store.getState().createRoute('R1')
  store.getState().startSimulationNavigation(store.getState().activeRouteId)
  store.getState().simulationTick(720)
  return store.getState()
}

describe('Tauri 海图快照', () => {
  it('图层数据与 RN 调用的共享投影完全一致，只有 follow 是 Web 端附加', async () => {
    const state = await navigatedState()
    const projected = projectChartLayers(state, { rings: true, vectors: true })
    const snapshot = buildChartSnapshot(state, true, { rings: true, vectors: true })

    expect(snapshot.follow).toBe(true)
    expect(snapshot.track).toEqual(projected.track)
    expect(snapshot.route).toEqual(projected.route)
    expect(snapshot.leg).toEqual(projected.leg)
    expect(snapshot.waypoints).toEqual(projected.waypoints)
    expect(snapshot.ownShip).toEqual(projected.ownShip)
  })

  it('当前航段已跨到第二段，剩余距离由共享选择器派生', async () => {
    const state = await navigatedState()
    const snapshot = buildChartSnapshot(state, false)
    expect(snapshot.leg.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [122, 30.01667],
        [122, 30.03333],
      ],
    })
  })
})
