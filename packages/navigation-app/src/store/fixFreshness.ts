import { FixStatus, type OwnShip, type OwnShipFixed } from '@navigation/core'

/** 真实定位超过该时长视为过期，不能用于开始真实导航，也不能写入缓存。 */
export const FIX_STALE_MS = 5 * 60 * 1000

/** 允许设备时间轻微领先本机的容差；超出即视为未来定位并拒绝。 */
export const FIX_FUTURE_TOLERANCE_MS = 60 * 1000

/**
 * 定位是否新鲜：已定位、时间可解析、不早于当前 5 分钟、不超前容差。
 * 真实导航开始按钮与 store 的启动守卫共用这一规则。
 */
export function isFreshFix(fix: OwnShip | null, nowIso: string): fix is OwnShipFixed {
  if (fix === null || fix.status !== FixStatus.FIXED) {
    return false
  }
  const ageMs = Date.parse(nowIso) - Date.parse(fix.timestamp)
  return ageMs >= 0 && ageMs <= FIX_STALE_MS
}

/** 当前缓存是否有可用的真实定位（模拟船位不算）。 */
export function hasFreshRealFix(
  state: { realFix: OwnShip | null },
  nowIso: string,
): boolean {
  return isFreshFix(state.realFix, nowIso)
}
