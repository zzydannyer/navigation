import { isUndefined } from 'lodash-es'
import { parseNmeaSentence } from 'nmea-simple'
import { Position } from '../domain/position'
import { normalizeBearing } from '../geo/navigation'

export enum NmeaKind {
  IGNORED = 'IGNORED',
  FIX = 'FIX',
  POSITION = 'POSITION',
  MOTION = 'MOTION',
  HEADING = 'HEADING',
}

export interface NmeaIgnored {
  kind: NmeaKind.IGNORED
}

export interface NmeaFix {
  kind: NmeaKind.FIX
  position: Position
  speedKnots: number
  courseDegrees: number
  timestamp: string
}

export interface NmeaPosition {
  kind: NmeaKind.POSITION
  position: Position
  timestamp: string
}

export interface NmeaMotion {
  kind: NmeaKind.MOTION
  speedKnots: number
  courseDegrees: number
}

export interface NmeaHeading {
  kind: NmeaKind.HEADING
  headingDegrees: number
}

export type NmeaResult = NmeaIgnored | NmeaFix | NmeaPosition | NmeaMotion | NmeaHeading

const ignored: NmeaIgnored = { kind: NmeaKind.IGNORED }

function checksumMatches(sentence: string) {
  const parts = sentence.split('*')
  const body = parts[0]
  const expectedText = parts[1]
  if (isUndefined(body) || isUndefined(expectedText)) {
    return false
  }
  if (body.length < 2) {
    return false
  }
  let checksum = body.charCodeAt(1)
  let index = 2
  while (index < body.length) {
    checksum ^= body.charCodeAt(index)
    index += 1
  }
  return checksum === Number.parseInt(expectedText, 16)
}

function sentenceIdentifier(fields: string[]) {
  const head = fields[0]
  if (isUndefined(head)) {
    return ''
  }
  if (!head.startsWith('$') || head.length < 6) {
    return ''
  }
  return head.slice(3)
}

function finiteOrZero(value: number) {
  if (Number.isFinite(value)) {
    return value
  }
  return 0
}

function fieldText(fields: string[], index: number) {
  const text = fields[index]
  if (isUndefined(text)) {
    return ''
  }
  return text
}

export function parseNmea(sentence: string): NmeaResult {
  const trimmed = sentence.trim()
  if (!checksumMatches(trimmed)) {
    return ignored
  }
  const star = trimmed.indexOf('*')
  const fields = trimmed.slice(0, star).split(',')
  const identifier = sentenceIdentifier(fields)
  if (identifier === 'RMC') {
    return parseRmc(trimmed, fields)
  }
  if (identifier === 'GGA') {
    return parseGga(trimmed, fields)
  }
  if (identifier === 'VTG') {
    return parseVtg(trimmed, fields)
  }
  if (identifier === 'HDT') {
    return parseHdt(trimmed, fields)
  }
  return ignored
}

function parseRmc(sentence: string, fields: string[]): NmeaResult {
  if (fields.length < 10) {
    return ignored
  }
  if (fieldText(fields, 3).length === 0 || fieldText(fields, 5).length === 0) {
    return ignored
  }
  const packet = parseNmeaSentence(sentence)
  if (packet.sentenceId !== 'RMC') {
    return ignored
  }
  if (packet.status !== 'valid') {
    return ignored
  }
  if (!Number.isFinite(packet.latitude) || !Number.isFinite(packet.longitude)) {
    return ignored
  }
  if (Number.isNaN(packet.datetime.getTime())) {
    return ignored
  }
  return {
    kind: NmeaKind.FIX,
    position: { latitude: packet.latitude, longitude: packet.longitude },
    speedKnots: finiteOrZero(packet.speedKnots),
    courseDegrees: normalizeBearing(finiteOrZero(packet.trackTrue)),
    timestamp: packet.datetime.toISOString(),
  }
}

function parseGga(sentence: string, fields: string[]): NmeaResult {
  if (fields.length < 7) {
    return ignored
  }
  if (fieldText(fields, 2).length === 0 || fieldText(fields, 4).length === 0) {
    return ignored
  }
  const packet = parseNmeaSentence(sentence)
  if (packet.sentenceId !== 'GGA') {
    return ignored
  }
  if (packet.fixType === 'none') {
    return ignored
  }
  if (!Number.isFinite(packet.latitude) || !Number.isFinite(packet.longitude)) {
    return ignored
  }
  if (Number.isNaN(packet.time.getTime())) {
    return ignored
  }
  return {
    kind: NmeaKind.POSITION,
    position: { latitude: packet.latitude, longitude: packet.longitude },
    timestamp: packet.time.toISOString(),
  }
}

function parseVtg(sentence: string, fields: string[]): NmeaResult {
  if (fields.length < 6) {
    return ignored
  }
  const packet = parseNmeaSentence(sentence)
  if (packet.sentenceId !== 'VTG') {
    return ignored
  }
  return {
    kind: NmeaKind.MOTION,
    speedKnots: finiteOrZero(packet.speedKnots),
    courseDegrees: normalizeBearing(finiteOrZero(packet.trackTrue)),
  }
}

function parseHdt(sentence: string, fields: string[]): NmeaResult {
  if (fields.length < 2) {
    return ignored
  }
  const packet = parseNmeaSentence(sentence)
  if (packet.sentenceId !== 'HDT') {
    return ignored
  }
  return {
    kind: NmeaKind.HEADING,
    headingDegrees: normalizeBearing(finiteOrZero(packet.heading)),
  }
}
