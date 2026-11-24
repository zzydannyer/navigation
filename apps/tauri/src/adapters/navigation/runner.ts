import { elapsedMonotonicSeconds } from '@navigation/app'
import { navigationStore } from '@/store'

let timer: number | null = null
let lastTick: number | null = null

function frame(): void {
  // performance.now() 为单调时钟；暂停/停止清空基线，恢复后重新采样。
  const nowMs = performance.now()
  const { elapsedSeconds, nextTick } = elapsedMonotonicSeconds(lastTick, nowMs)
  lastTick = nextTick
  navigationStore.getState().simulationTick(elapsedSeconds)
}

/**
 * 应用侧计时：核心模拟步进是纯函数，interval 只负责按实际经过时间驱动 simulationTick。
 * 重复调用不会叠加定时器；停止时清理句柄并重置时间基线。
 */
export function startSimulationRunner(): void {
  if (timer !== null) {
    return
  }
  lastTick = performance.now()
  timer = window.setInterval(frame, 1000)
}

export function stopSimulationRunner(): void {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  lastTick = null
}
