import { isNull } from 'lodash-es'
import { Heading, HeadingStatus } from '../domain/ownShip'
import { normalizeBearing } from './navigation'

const KNOTS_PER_METER_PER_SECOND = 1.943844

export function metersPerSecondToKnots(metersPerSecond: number | null) {
  if (isNull(metersPerSecond)) {
    return 0
  }
  if (metersPerSecond < 0) {
    return 0
  }
  return metersPerSecond * KNOTS_PER_METER_PER_SECOND
}

export function headingFromDegrees(degrees: number | null): Heading {
  if (isNull(degrees)) {
    return { status: HeadingStatus.UNKNOWN }
  }
  if (degrees < 0) {
    return { status: HeadingStatus.UNKNOWN }
  }
  return { status: HeadingStatus.KNOWN, degrees: normalizeBearing(degrees) }
}

export function courseFromDegrees(degrees: number | null) {
  const heading = headingFromDegrees(degrees)
  if (heading.status === HeadingStatus.UNKNOWN) {
    return 0
  }
  return heading.degrees
}
