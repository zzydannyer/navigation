import { isTauri } from '@tauri-apps/api/core'
import { checkPermissions, requestPermissions, getCurrentPosition } from '@tauri-apps/plugin-geolocation'
import { courseFromDegrees, headingFromDegrees, LocationPermissionStatus, metersPerSecondToKnots, NoticeKey } from '@navigation/core'
import { useNavigationStore } from './store'

export async function requestLocation(): Promise<string> {
  const store = useNavigationStore.getState()
  store.setNotice(NoticeKey.NONE)
  try {
    const nativeMobile = isTauri() && /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (nativeMobile) {
      let permission = await checkPermissions()
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        permission = await requestPermissions(['location'])
      }
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        store.setPermission(LocationPermissionStatus.DENIED)
        return '未获得定位权限，请在系统设置中允许航海访问位置'
      }
    }
    const position = nativeMobile
      ? await getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 })
      : await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('此环境不支持定位')); return }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 })
      })
    store.setPermission(LocationPermissionStatus.GRANTED)
    store.applyGps({
      position: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      speedKnots: metersPerSecondToKnots(position.coords.speed),
      courseDegrees: courseFromDegrees(position.coords.heading),
      heading: headingFromDegrees(position.coords.heading),
      timestamp: new Date(position.timestamp).toISOString(),
    })
    return '定位成功，可点击“定位”居中'
  } catch (error) {
    // A timeout, disabled location service, or unsupported API is not a permission denial.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 1) {
      store.setPermission(LocationPermissionStatus.DENIED)
    }
    return `定位未完成：${error instanceof Error ? error.message : String(error)}。请确认系统定位已开启后重试`
  }
}
