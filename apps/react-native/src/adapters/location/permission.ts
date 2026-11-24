import { Linking, PermissionsAndroid, Platform } from 'react-native';

/**
 * 定位授权状态：
 * - granted：精确定位或粗略定位任一获准，位置层可启动
 * - denied：本次被拒绝，通常还能再次弹窗（但不保证）
 * - blocked：用户选择不再询问，只能去系统设置开启
 */
export type LocationPermissionState = 'granted' | 'denied' | 'blocked';

/** 一次授权读取的结果；error 非空表示检查本身失败，界面应提供重试。 */
export interface PermissionOutcome {
  state: LocationPermissionState;
  error: string | null;
}

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 读取当前授权状态，不弹系统对话框。
 * Android 12+ 的“大致位置”只有 COARSE，因此任一权限获准即可用。
 */
export async function checkLocationPermission(): Promise<PermissionOutcome> {
  if (Platform.OS !== 'android') {
    return { state: 'denied', error: null };
  }
  try {
    if (await PermissionsAndroid.check(COARSE)) {
      return { state: 'granted', error: null };
    }
    if (await PermissionsAndroid.check(FINE)) {
      return { state: 'granted', error: null };
    }
    return { state: 'denied', error: null };
  } catch (error) {
    return { state: 'denied', error: describe(error) };
  }
}

/**
 * 请求前台定位授权，保留“精确定位或粗略定位任一获准即通过”。
 * check() 无法判断永久拒绝，这里以 never_ask_again 作为 blocked 的唯一依据。
 */
export async function requestLocationPermission(): Promise<PermissionOutcome> {
  if (Platform.OS !== 'android') {
    return { state: 'denied', error: null };
  }
  try {
    const results = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
    const values = Object.values(results);
    if (values.some((value) => value === PermissionsAndroid.RESULTS.GRANTED)) {
      return { state: 'granted', error: null };
    }
    if (values.some((value) => value === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
      return { state: 'blocked', error: null };
    }
    return { state: 'denied', error: null };
  } catch (error) {
    return { state: 'denied', error: describe(error) };
  }
}

/** 打开本应用系统设置页；失败返回错误文案，由界面提供重试。 */
export async function openAppSettings(): Promise<string | null> {
  try {
    await Linking.openSettings();
    return null;
  } catch (error) {
    return describe(error);
  }
}
