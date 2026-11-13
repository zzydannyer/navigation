import { Position } from './position'

export enum FixStatus {
  NO_FIX = 'NO_FIX',
  FIXED = 'FIXED',
}

export enum HeadingStatus {
  UNKNOWN = 'UNKNOWN',
  KNOWN = 'KNOWN',
}

export interface HeadingUnknown {
  status: HeadingStatus.UNKNOWN
}

export interface HeadingKnown {
  status: HeadingStatus.KNOWN
  degrees: number
}

export type Heading = HeadingUnknown | HeadingKnown

export interface OwnShipNoFix {
  status: FixStatus.NO_FIX
  speedKnots: number
  courseDegrees: number
  heading: Heading
}

export interface OwnShipFixed {
  status: FixStatus.FIXED
  position: Position
  speedKnots: number
  courseDegrees: number
  heading: Heading
  timestamp: string
}

export type OwnShip = OwnShipNoFix | OwnShipFixed

export interface GpsFix {
  position: Position
  speedKnots: number
  courseDegrees: number
  heading: Heading
  timestamp: string
}

export const initialOwnShip: OwnShip = {
  status: FixStatus.NO_FIX,
  speedKnots: 0,
  courseDegrees: 0,
  heading: { status: HeadingStatus.UNKNOWN },
}

export function withMotion(ownShip: OwnShip, speedKnots: number, courseDegrees: number): OwnShip {
  if (ownShip.status === FixStatus.NO_FIX) {
    return {
      status: FixStatus.NO_FIX,
      speedKnots,
      courseDegrees,
      heading: ownShip.heading,
    }
  }
  return {
    status: FixStatus.FIXED,
    position: ownShip.position,
    speedKnots,
    courseDegrees,
    heading: ownShip.heading,
    timestamp: ownShip.timestamp,
  }
}

export function withHeading(ownShip: OwnShip, heading: Heading): OwnShip {
  if (ownShip.status === FixStatus.NO_FIX) {
    return {
      status: FixStatus.NO_FIX,
      speedKnots: ownShip.speedKnots,
      courseDegrees: ownShip.courseDegrees,
      heading,
    }
  }
  return {
    status: FixStatus.FIXED,
    position: ownShip.position,
    speedKnots: ownShip.speedKnots,
    courseDegrees: ownShip.courseDegrees,
    heading,
    timestamp: ownShip.timestamp,
  }
}
