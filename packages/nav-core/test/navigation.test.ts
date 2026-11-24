import { describe, expect, it } from 'vitest'
import { LegKind } from '../src/domain/route'
import type { Waypoint } from '../src/domain/waypoint'
import { stepSimulation } from '../src/navigation/simulation'

const waypoint = (id: string, latitude: number, longitude: number): Waypoint => ({
  id,
  name: id,
  position: { latitude, longitude },
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
})

// 沿经线排列，相邻节点约 1 海里（1 分纬度）。
const a = waypoint('A', 30.0, 122.0)
const b = waypoint('B', 30.01667, 122.0)
const c = waypoint('C', 30.03333, 122.0)

const baseInput = {
  waypoints: [a, b, c],
  legKind: LegKind.RHUMB,
}

describe('stepSimulation', () => {
  it('marks finished without moving for fewer than two waypoints', () => {
    const result = stepSimulation({
      ...baseInput,
      waypoints: [a],
      progress: { activeIndex: 0, position: a.position },
      speedKnots: 6,
      elapsedSeconds: 300,
    })
    expect(result.finished).toBe(true)
    expect(result.events).toEqual([])
    expect(result.position).toEqual(a.position)
  })

  it('does not advance at zero speed and emits no event', () => {
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 1, position: a.position },
      speedKnots: 0,
      elapsedSeconds: 300,
    })
    expect(result.position).toEqual(a.position)
    expect(result.finished).toBe(false)
    expect(result.events).toEqual([])
  })

  it('moves partway along the current leg without arriving', () => {
    // 6 节 × 5 分钟 = 0.5 海里，未到达 1 海里外的 B。
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 1, position: a.position },
      speedKnots: 6,
      elapsedSeconds: 300,
    })
    expect(result.activeIndex).toBe(1)
    expect(result.finished).toBe(false)
    expect(result.events).toEqual([])
    expect(result.position.latitude).toBeGreaterThan(a.position.latitude)
    expect(result.position.latitude).toBeLessThan(b.position.latitude)
  })

  it('arrives at a middle waypoint and advances to the next leg', () => {
    // 6 节 × 12 分钟 = 1.2 海里，超过到 B 的约 1 海里航段。
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 1, position: a.position },
      speedKnots: 6,
      elapsedSeconds: 720,
    })
    expect(result.events).toEqual([{ type: 'ARRIVAL_WAYPOINT', waypointId: 'B', index: 1 }])
    expect(result.activeIndex).toBe(2)
    expect(result.finished).toBe(false)
  })

  it('emits ROUTE_COMPLETE and finishes at the final waypoint', () => {
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 2, position: b.position },
      speedKnots: 6,
      elapsedSeconds: 720,
    })
    expect(result.events).toEqual([
      { type: 'ARRIVAL_WAYPOINT', waypointId: 'C', index: 2 },
      { type: 'ROUTE_COMPLETE', waypointId: 'C', index: 2 },
    ])
    expect(result.finished).toBe(true)
    expect(result.position).toEqual(c.position)
  })

  it('does not mark finished at zero speed even when the target is the final waypoint', () => {
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 2, position: c.position },
      speedKnots: 0,
      elapsedSeconds: 300,
    })
    expect(result.position).toEqual(c.position)
    expect(result.finished).toBe(false)
    expect(result.events).toEqual([])
  })

  it('advances along a high-latitude rhumb parallel without turning to great-circle', () => {
    const d = waypoint('D', 60, 120)
    const e = waypoint('E', 60, 120.5)
    const result = stepSimulation({
      waypoints: [d, e],
      legKind: LegKind.RHUMB,
      progress: { activeIndex: 1, position: d.position },
      speedKnots: 6,
      elapsedSeconds: 600,
    })
    expect(result.finished).toBe(false)
    expect(result.position.longitude).toBeGreaterThan(d.position.longitude)
    expect(result.position.latitude).toBeCloseTo(60, 4)
  })

  it('consumes leftover distance across more than one leg in a single step', () => {
    // 6 节 × 1500 秒 ≈ 2.5 海里，连续越过 B 并抵达终点 C。
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 1, position: a.position },
      speedKnots: 6,
      elapsedSeconds: 1500,
    })
    expect(result.events).toEqual([
      { type: 'ARRIVAL_WAYPOINT', waypointId: 'B', index: 1 },
      { type: 'ARRIVAL_WAYPOINT', waypointId: 'C', index: 2 },
      { type: 'ROUTE_COMPLETE', waypointId: 'C', index: 2 },
    ])
    expect(result.activeIndex).toBe(2)
    expect(result.finished).toBe(true)
    expect(result.position).toEqual(c.position)
  })

  it('snaps to the target inside the arrival radius and completes without stalling', () => {
    // 船位距 B 约 0.004 海里，已在到点半径内；即使里程不足也应吸附到点。
    const nearB = { latitude: 30.016, longitude: 122 }
    const result = stepSimulation({
      ...baseInput,
      progress: { activeIndex: 1, position: nearB },
      speedKnots: 6,
      elapsedSeconds: 1,
    })
    expect(result.events).toEqual([{ type: 'ARRIVAL_WAYPOINT', waypointId: 'B', index: 1 }])
    expect(result.activeIndex).toBe(2)
    expect(result.finished).toBe(false)
    expect(result.position).toEqual(b.position)
  })

  it('advances past consecutive duplicate waypoints without looping', () => {
    const p = waypoint('P', 30, 122)
    const q = waypoint('Q', 30, 122)
    const r = waypoint('R', 30, 122)
    const result = stepSimulation({
      waypoints: [p, q, r],
      legKind: LegKind.RHUMB,
      progress: { activeIndex: 1, position: p.position },
      speedKnots: 6,
      elapsedSeconds: 60,
    })
    expect(result.events).toEqual([
      { type: 'ARRIVAL_WAYPOINT', waypointId: 'Q', index: 1 },
      { type: 'ARRIVAL_WAYPOINT', waypointId: 'R', index: 2 },
      { type: 'ROUTE_COMPLETE', waypointId: 'R', index: 2 },
    ])
    expect(result.finished).toBe(true)
  })

  it('moves a small step along a short leg without arriving', () => {
    const shortA = waypoint('SA', 30, 122)
    const shortB = waypoint('SB', 30.001, 122)
    const shortC = waypoint('SC', 30.002, 122)
    // 6 节 × 10 秒 ≈ 0.017 海里，短航段约 0.06 海里，小步不应该到点。
    const result = stepSimulation({
      waypoints: [shortA, shortB, shortC],
      legKind: LegKind.RHUMB,
      progress: { activeIndex: 1, position: shortA.position },
      speedKnots: 6,
      elapsedSeconds: 10,
    })
    expect(result.finished).toBe(false)
    expect(result.events).toEqual([])
    expect(result.activeIndex).toBe(1)
    expect(result.position.latitude).toBeGreaterThan(shortA.position.latitude)
    expect(result.position.latitude).toBeLessThan(shortB.position.latitude)
  })
})
