import { describe, expect, it } from 'vitest'
import { createWatchCoordinator, type WatchHandle, type WatchHandlers } from '../src/adapters/location/watchCoordinator'
import type { RawPosition } from '../src/adapters/location/types'

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

const position: RawPosition = { latitude: 30, longitude: 122, speed: 1, heading: 90, timestamp: 0 }

function setup() {
  const opens: { handlers: WatchHandlers; settle: Deferred<WatchHandle> }[] = []
  const closed: number[] = []
  const positions: RawPosition[] = []
  const errors: unknown[] = []
  let openCount = 0

  const coordinator = createWatchCoordinator({
    open: (handlers) => {
      openCount += 1
      const settle = deferred<WatchHandle>()
      opens.push({ handlers, settle })
      return settle.promise
    },
    onPosition: (value) => positions.push(value),
    onError: (error) => errors.push(error),
  })

  const handle = (index: number): WatchHandle => ({
    close: () => {
      closed.push(index)
    },
  })

  return { coordinator, opens, closed, positions, errors, handle, openCount: () => openCount }
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve()
  }
}

describe('createWatchCoordinator', () => {
  it('opens only one subscription when start is called repeatedly', async () => {
    const ctx = setup()
    const first = ctx.coordinator.start()
    const second = ctx.coordinator.start()
    expect(ctx.opens).toHaveLength(1)
    expect(second).toBe(first)

    ctx.opens[0]!.settle.resolve(ctx.handle(0))
    await first
    ctx.opens[0]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(1)
  })

  it('releases the subscription when stop happens while starting', async () => {
    const ctx = setup()
    const started = ctx.coordinator.start()
    ctx.coordinator.stop()
    ctx.opens[0]!.settle.resolve(ctx.handle(0))
    await started

    expect(ctx.closed).toEqual([0])
    ctx.opens[0]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(0)
  })

  it('creates a fresh subscription after stop and start during startup', async () => {
    const ctx = setup()
    const first = ctx.coordinator.start()
    ctx.coordinator.stop()
    const second = ctx.coordinator.start()
    expect(ctx.opens).toHaveLength(1)

    ctx.opens[0]!.settle.resolve(ctx.handle(0))
    await flush()

    expect(ctx.opens).toHaveLength(2)
    expect(ctx.closed).toEqual([0])

    ctx.opens[1]!.settle.resolve(ctx.handle(1))
    await Promise.all([first, second])
    ctx.opens[1]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(1)
    expect(ctx.closed).toEqual([0])
  })

  it('ignores callbacks from a stopped generation', async () => {
    const ctx = setup()
    const started = ctx.coordinator.start()
    ctx.opens[0]!.settle.resolve(ctx.handle(0))
    await started

    ctx.coordinator.stop()
    ctx.opens[0]!.handlers.onPosition(position)
    ctx.opens[0]!.handlers.onError(new Error('late'))
    expect(ctx.positions).toHaveLength(0)
    expect(ctx.errors).toHaveLength(0)
    expect(ctx.closed).toEqual([0])
  })

  it('reports a failed start and allows a later restart', async () => {
    const ctx = setup()
    const started = ctx.coordinator.start()
    const failure = new Error('permission denied')
    ctx.opens[0]!.settle.reject(failure)
    await started
    expect(ctx.errors).toEqual([failure])

    const restarted = ctx.coordinator.start()
    expect(ctx.opens).toHaveLength(2)
    ctx.opens[1]!.settle.resolve(ctx.handle(1))
    await restarted
    ctx.opens[1]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(1)
  })

  it('rebuilds the subscription when a stale startup fails after stop and restart', async () => {
    const ctx = setup()
    const first = ctx.coordinator.start()
    ctx.coordinator.stop()
    const second = ctx.coordinator.start()
    expect(ctx.opens).toHaveLength(1)

    // 旧代际 A 启动失败：错误不发布，按最新意图自动打开 B。
    ctx.opens[0]!.settle.reject(new Error('stale failure'))
    await flush()
    expect(ctx.errors).toHaveLength(0)
    expect(ctx.opens).toHaveLength(2)

    ctx.opens[1]!.settle.resolve(ctx.handle(1))
    await Promise.all([first, second])
    ctx.opens[1]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(1)

    // 已建立订阅后再 start 不重复打开。
    await ctx.coordinator.start()
    expect(ctx.opens).toHaveLength(2)

    // stop 释放 B，且旧回调失效。
    ctx.coordinator.stop()
    expect(ctx.closed).toEqual([1])
    ctx.opens[1]!.handlers.onPosition(position)
    expect(ctx.positions).toHaveLength(1)
  })
})
