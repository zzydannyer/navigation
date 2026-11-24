/**
 * 由单调时钟毫秒时间戳计算推进秒数；只采样相邻两次差值，不读取墙钟，
 * 系统时间前后调整不会改变实际推进量。
 */
export function elapsedMonotonicSeconds(
  lastTick: number | null,
  now: number,
): { elapsedSeconds: number; nextTick: number } {
  const nextTick = now
  const elapsedSeconds = lastTick === null ? 0 : Math.max(0, (now - lastTick) / 1000)
  return { elapsedSeconds, nextTick }
}
