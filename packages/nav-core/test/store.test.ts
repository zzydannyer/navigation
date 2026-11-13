import { describe, expect, it } from 'vitest'
import { createNavigationStore } from '../src/store/createNavigationStore'
import { LegKind } from '../src/domain/route'

function memoryStorage(initial = '') {
  let value = initial
  return {
    read: () => value,
    write: (v: string) => {
      value = v
    },
    get: () => value,
  }
}

let idCounter = 0
const createId = () => `id-${idCounter++}`

describe('createNavigationStore persistence (zod DTO)', () => {
  it('falls back to empty state when storage holds malformed JSON', () => {
    idCounter = 0
    const storage = memoryStorage('not-json-at-all')
    const store = createNavigationStore(storage, createId)
    const state = store.getState()
    expect(state.waypoints).toEqual([])
    expect(state.routes).toEqual([])
    expect(state.tracks).toEqual([])
    expect(state.activeRouteId).toBe('')
  })

  it('falls back to empty state when storage JSON fails the DTO shape', () => {
    idCounter = 0
    const storage = memoryStorage(JSON.stringify({ waypoints: 'should-be-array', routes: 123 }))
    const store = createNavigationStore(storage, createId)
    const state = store.getState()
    expect(state.waypoints).toEqual([])
    expect(state.routes).toEqual([])
  })

  it('loads a valid waypoint from storage and rejects a malformed one', () => {
    idCounter = 0
    const valid = {
      waypoints: [
        { id: 'w1', name: 'A', position: { latitude: 30, longitude: 122 }, description: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      routes: [],
      tracks: [],
      activeRouteId: '',
    }
    const storage = memoryStorage(JSON.stringify(valid))
    const store = createNavigationStore(storage, createId)
    expect(store.getState().waypoints).toHaveLength(1)
    expect(store.getState().waypoints[0].id).toBe('w1')
  })

  it('persists state on write when a waypoint is added', () => {
    idCounter = 0
    const storage = memoryStorage('{}')
    const store = createNavigationStore(storage, createId)
    store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'SW Offing')
    const written = JSON.parse(storage.get())
    expect(written.waypoints).toHaveLength(1)
    expect(written.waypoints[0].name).toBe('SW Offing')
  })

  it('createRoute requires at least two waypoints and defaults to RHUMB', () => {
    idCounter = 0
    const storage = memoryStorage('{}')
    const store = createNavigationStore(storage, createId)
    store.getState().addWaypoint({ latitude: 30, longitude: 122 }, 'A')
    store.getState().addWaypoint({ latitude: 30.02, longitude: 122 }, 'B')
    store.getState().createRoute('Crossing')
    expect(store.getState().routes).toHaveLength(1)
    expect(store.getState().routes[0].legKind).toBe(LegKind.RHUMB)
  })
})
