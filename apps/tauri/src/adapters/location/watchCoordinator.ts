import type { RawPosition } from './types'

/** 已建立订阅的释放句柄。 */
export interface WatchHandle {
  close: () => void | Promise<void>
}

export interface WatchHandlers {
  onPosition: (position: RawPosition) => void
  onError: (error: unknown) => void
}

export interface WatchCoordinatorOptions {
  /** 打开一次底层订阅；拒绝时由协调器归类错误。 */
  open: (handlers: WatchHandlers) => Promise<WatchHandle>
  onPosition: (position: RawPosition) => void
  onError: (error: unknown) => void
}

export interface WatchCoordinator {
  /** 确保订阅在运行；重复调用返回同一次启动任务。 */
  start: () => Promise<void>
  /** 立即停止，使所有在途回调失效并释放已取得的 watchId。 */
  stop: () => void
}

async function safeClose(handle: WatchHandle): Promise<void> {
  try {
    await handle.close()
  } catch {
    // 释放失败不向调用方抛出，避免未处理的 rejection。
  }
}

/**
 * 持续定位订阅协调器：以 desired 意图 + 递增 generation 管理启动、停止与重启竞态。
 * 旧代际的回调不写入 store；旧启动任务完成时释放自己的 watchId，并按最新意图重建订阅。
 */
export function createWatchCoordinator(options: WatchCoordinatorOptions): WatchCoordinator {
  let desired = false
  let generation = 0
  let session: WatchHandle | null = null
  let sessionGeneration = -1
  let run: Promise<void> | null = null
  let lastRun: Promise<void> | null = null

  function gatedHandlers(gen: number): WatchHandlers {
    const current = () => desired && generation === gen
    return {
      onPosition: (position) => {
        if (!current()) return
        options.onPosition(position)
      },
      onError: (error) => {
        if (!current()) return
        options.onError(error)
      },
    }
  }

  async function converge(): Promise<void> {
    while (desired) {
      const gen = generation
      if (session !== null) {
        if (sessionGeneration === gen) return
        const stale = session
        session = null
        sessionGeneration = -1
        await safeClose(stale)
        continue
      }
      let opened: WatchHandle
      try {
        opened = await options.open(gatedHandlers(gen))
      } catch (error) {
        if (!desired) return
        // 旧代际启动失败不终止最新启动意图，继续按当前代际重新打开。
        if (generation !== gen) continue
        // 当前代际启动失败：清除运行意图，允许后续 start 重新尝试。
        desired = false
        options.onError(error)
        return
      }
      if (!desired || generation !== gen) {
        await safeClose(opened)
        continue
      }
      session = opened
      sessionGeneration = gen
      return
    }
  }

  function start(): Promise<void> {
    if (run !== null) {
      // 启动任务在途：停止后重启时提升代际，由该任务按最新意图重建订阅。
      if (!desired) {
        desired = true
        generation += 1
      }
      return run
    }
    if (desired) {
      // 订阅已建立：返回建立该订阅的任务，不重复打开。
      return lastRun ?? Promise.resolve()
    }
    desired = true
    generation += 1
    run = converge().finally(() => {
      run = null
    })
    lastRun = run
    return run
  }

  function stop(): void {
    if (!desired && session === null && run === null) return
    desired = false
    generation += 1
    const current = session
    session = null
    sessionGeneration = -1
    if (current !== null) {
      void safeClose(current)
    }
  }

  return { start, stop }
}
