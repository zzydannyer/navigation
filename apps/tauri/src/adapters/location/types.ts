/** 平台无关的原始定位结果；单位与归一化由应用服务统一处理。 */
export interface RawPosition {
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  timestamp: number
}

/** 定位授权被明确拒绝，区别于超时、定位关闭或运行错误。 */
export class LocationDeniedError extends Error {
  constructor() {
    super('location permission denied')
    this.name = 'LocationDeniedError'
  }
}
