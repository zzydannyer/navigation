/** 定位授权状态；由平台 adapter 归一化后写入应用状态。 */
export enum LocationPermissionStatus {
  UNKNOWN = 'UNKNOWN',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
}

/** 归一化后的定位结果，单位由应用服务换算；缺失速度/航向用 null 表达。 */
export interface LocationPosition {
  latitude: number
  longitude: number
  /** 米每秒；无速度时为 null。 */
  speedMs: number | null
  /** 度；无航向时为 null。 */
  headingDegrees: number | null
  /** ISO 8601 时间戳。 */
  timestamp: string
}

/** 稳定错误码；界面文案由各端自行映射，状态层不携带平台文案。 */
export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN'

export class LocationError extends Error {
  readonly code: LocationErrorCode

  constructor(code: LocationErrorCode, message: string) {
    super(message)
    this.name = 'LocationError'
    this.code = code
  }
}
