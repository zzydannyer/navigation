import { isTauri } from '@tauri-apps/api/core'
import {
  courseFromDegrees,
  headingFromDegrees,
  metersPerSecondToKnots,
  NoticeKey,
} from '@navigation/core'
import { LocationPermissionStatus } from '@navigation/app'
import { navigationStore } from '@/store'
import { requestBrowserPosition, stopBrowserWatch, watchBrowserPosition } from './browser'
import { requestTauriPosition, stopTauriWatch, watchTauriPosition } from './tauri'
import { createWatchCoordinator } from './watchCoordinator'
import { LocationDeniedError, type RawPosition } from './types'

function isNativeMobile(): boolean {
  return isTauri() && /Android|iPhone|iPad/i.test(navigator.userAgent)
}

function applyRawPosition(position: RawPosition): void {
  // 缺失的速度/航向保留为 null，交由状态层从真实读数缓存补全，不提前转成 0。
  navigationStore.getState().applyGps({
    position: { latitude: position.latitude, longitude: position.longitude },
    speedKnots: position.speed === null ? null : metersPerSecondToKnots(position.speed),
    courseDegrees: position.heading === null ? null : courseFromDegrees(position.heading),
    heading: position.heading === null ? null : headingFromDegrees(position.heading),
    timestamp: new Date(position.timestamp).toISOString(),
  })
}

function handleWatchError(error: unknown): void {
  const store = navigationStore.getState()
  if (error instanceof LocationDeniedError) {
    store.setPermission(LocationPermissionStatus.DENIED)
    return
  }
  if (typeof error === 'object' && error !== null && 'code' in error && (error as GeolocationPositionError).code === 1) {
    store.setPermission(LocationPermissionStatus.DENIED)
  }
}

/**
 * 应用定位服务：选择平台 adapter、归一化单位与航向、写入 store，并返回面向用户的提示。
 * 授权拒绝、超时、定位关闭与运行错误分别归类，不一律算作权限拒绝。
 */
export async function requestLocation(): Promise<string> {
  const store = navigationStore.getState()
  store.setNotice(NoticeKey.NONE)
  try {
    const position = isNativeMobile()
      ? await requestTauriPosition()
      : await requestBrowserPosition()
    store.setPermission(LocationPermissionStatus.GRANTED)
    applyRawPosition(position)
    return '定位成功，可点击“定位”居中'
  } catch (error) {
    if (error instanceof LocationDeniedError) {
      store.setPermission(LocationPermissionStatus.DENIED)
      return '未获得定位权限，请在系统设置中允许航海访问位置'
    }
    handleWatchError(error)
    return `定位未完成：${error instanceof Error ? error.message : String(error)}。请确认系统定位已开启后重试`
  }
}

let coordinator: ReturnType<typeof createWatchCoordinator> | null = null

/** 启动持续定位订阅；重复调用复用同一订阅，不重复注册。 */
export function startLocationWatch(): Promise<void> {
  if (coordinator === null) {
    coordinator = createWatchCoordinator({
      open: async (handlers) => {
        if (isNativeMobile()) {
          const watchId = await watchTauriPosition(handlers.onPosition, handlers.onError)
          return {
            close: async () => {
              await stopTauriWatch(watchId)
            },
          }
        }
        if (!navigator.geolocation) {
          throw new Error('此环境不支持定位')
        }
        const watchId = watchBrowserPosition(handlers.onPosition, handlers.onError)
        return {
          close: () => stopBrowserWatch(watchId),
        }
      },
      onPosition: (position) => {
        navigationStore.getState().setPermission(LocationPermissionStatus.GRANTED)
        applyRawPosition(position)
      },
      onError: handleWatchError,
    })
  }
  return coordinator.start()
}

/** 停止持续定位订阅并释放底层 watchId。 */
export function stopLocationWatch(): void {
  coordinator?.stop()
}
