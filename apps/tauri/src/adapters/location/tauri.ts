import {
  checkPermissions,
  clearWatch,
  getCurrentPosition,
  requestPermissions,
  watchPosition,
} from '@tauri-apps/plugin-geolocation'
import { LocationDeniedError, type RawPosition } from './types'

async function ensurePermission(): Promise<void> {
  let permission = await checkPermissions()
  if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
    permission = await requestPermissions(['location'])
  }
  if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
    throw new LocationDeniedError()
  }
}

function toRaw(position: { coords: { latitude: number; longitude: number; speed: number | null; heading: number | null }; timestamp: number }): RawPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speed: position.coords.speed,
    heading: position.coords.heading,
    timestamp: position.timestamp,
  }
}

/** Tauri 原生（Android/桌面）定位；只负责授权与取点，不写应用状态。 */
export async function requestTauriPosition(): Promise<RawPosition> {
  await ensurePermission()
  const position = await getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 3000,
  })
  return toRaw(position)
}

/** 持续订阅原生定位；返回 watchId，由 stopTauriWatch 释放。 */
export async function watchTauriPosition(
  onSuccess: (position: RawPosition) => void,
  onError: (error: Error) => void,
): Promise<number> {
  await ensurePermission()
  return watchPosition(
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    (location, error) => {
      if (error !== undefined || location === null) {
        onError(new Error(error ?? '定位不可用'))
        return
      }
      onSuccess(toRaw(location))
    },
  )
}

export async function stopTauriWatch(watchId: number): Promise<void> {
  await clearWatch(watchId)
}
