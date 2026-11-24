import type { RawPosition } from './types'

function toRaw(position: GeolocationPosition): RawPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speed: position.coords.speed,
    heading: position.coords.heading,
    timestamp: position.timestamp,
  }
}

/** 浏览器 WebView 定位；不触碰 Tauri 插件或应用 store。 */
export function requestBrowserPosition(): Promise<RawPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('此环境不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toRaw(position)),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    )
  })
}

/** 持续订阅浏览器定位；返回 watchId，由 stopBrowserWatch 释放。 */
export function watchBrowserPosition(
  onSuccess: (position: RawPosition) => void,
  onError: (error: GeolocationPositionError) => void,
): number {
  return navigator.geolocation.watchPosition((position) => onSuccess(toRaw(position)), onError, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 3000,
  })
}

export function stopBrowserWatch(watchId: number): void {
  navigator.geolocation.clearWatch(watchId)
}
