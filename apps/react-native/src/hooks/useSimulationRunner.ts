import { useEffect } from 'react';
import { elapsedMonotonicSeconds } from '@navigation/app';
import { navigationStore } from '../store';

let timer: ReturnType<typeof setInterval> | null = null;
let lastTick: number | null = null;

/** Hermes 提供 performance.now；不可用时退回墙钟，保证至少能步进。 */
function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function frame(): void {
  const nowMs = monotonicNow();
  const { elapsedSeconds, nextTick } = elapsedMonotonicSeconds(lastTick, nowMs);
  lastTick = nextTick;
  navigationStore.getState().simulationTick(elapsedSeconds);
}

function start(): void {
  if (timer !== null) return;
  lastTick = monotonicNow();
  timer = setInterval(frame, 1000);
}

function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  lastTick = null;
}

/**
 * 每端只保留一个模拟计时器。由 App 按“运行中 + 模拟模式”挂载；
 * 暂停、结束或卸载都会清空句柄与单调时钟基线。
 */
export function useSimulationRunner(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return stop;
  }, [enabled]);
}
