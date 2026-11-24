import { useState } from 'react'
import {
  Arrival,
  ArrivalStatus,
  CrossTrack,
  FixStatus,
  Heading,
  HeadingStatus,
  OwnShip,
  SteerSide,
} from '@navigation/core'
import { selectNavigationGuidance } from '@navigation/app'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigationStore } from '@/store'

export function InstrumentPanel() {
  const { t } = useTranslation()
  const [sentence, setSentence] = useState('')
  const ownShip = useNavigationStore((state) => state.ownShip)
  const navigation = useNavigationStore((state) => state.navigation)
  const applySentence = useNavigationStore((state) => state.applySentence)
  const state = useNavigationStore()
  const guidance = selectNavigationGuidance(state)
  const leg = guidance.leg
  const navLabel = {
    idle: t('nav.statusIdle'),
    running: t('nav.statusRunning'),
    paused: t('nav.statusPaused'),
    ended: t('nav.statusEnded'),
  }[navigation.status]
  const sourceLabel = guidance.sessionActive
    ? guidance.mode === 'simulation'
      ? t('nav.modeSimulation')
      : t('nav.modeReal')
    : null

  const to = leg.to
  const bearing = guidance.bearingDegrees ?? undefined
  const cross = guidance.crossTrack ?? undefined
  const arrival = guidance.arrival

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4 pb-24 min-[1100px]:pb-4">
      <Readout label={t('instrument.route')} value={leg.route?.name ?? t('instrument.none')} />
      <Readout
        label={t('nav.status')}
        value={sourceLabel === null ? navLabel : `${navLabel} · ${sourceLabel}`}
      />
      <Readout label={t('instrument.position')} value={positionText(ownShip, t('instrument.unknown'))} />
      <Readout label={t('instrument.speed')} value={t('instrument.knots', { value: ownShip.speedKnots.toFixed(1) })} />
      <Readout label={t('instrument.course')} value={t('instrument.degrees', { value: ownShip.courseDegrees.toFixed(0) })} />
      <Readout label={t('instrument.heading')} value={headingText(ownShip.heading, t)} />
      <Readout
        label={t('instrument.bearing')}
        value={bearing === undefined ? t('instrument.unknown') : t('instrument.degrees', { value: bearing.toFixed(0) })}
      />
      <Readout
        label={t('instrument.distance')}
        value={to === null ? t('instrument.unknown') : t('instrument.nauticalMiles', { value: leg.nextDistanceNauticalMiles.toFixed(2) })}
      />
      <Readout
        label={t('instrument.crossTrack')}
        value={cross === undefined ? t('instrument.unknown') : crossTrackText(cross, t)}
      />
      <Readout
        label={t('instrument.arrival')}
        value={arrival === null ? t('instrument.unknown') : arrivalText(arrival, t)}
      />
      <label className="text-sm font-medium" htmlFor="nmea">{t('instrument.sentence')}</label>
      <input
        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        id="nmea"
        placeholder={t('instrument.placeholder')}
        value={sentence}
        onChange={(event) => {
          setSentence(event.currentTarget.value)
        }}
      />
      <Button
        type="button"
        onClick={() => {
          applySentence(sentence)
        }}
      >
        {t('instrument.apply')}
      </Button>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function positionText(ownShip: OwnShip, unknown: string) {
  if (ownShip.status !== FixStatus.FIXED) {
    return unknown
  }
  const latitude = `${Math.abs(ownShip.position.latitude).toFixed(5)}° ${ownShip.position.latitude >= 0 ? 'N' : 'S'}`
  const longitude = `${Math.abs(ownShip.position.longitude).toFixed(5)}° ${ownShip.position.longitude >= 0 ? 'E' : 'W'}`
  return `${latitude}  ${longitude}`
}

function headingText(heading: Heading, t: ReturnType<typeof useTranslation>['t']) {
  if (heading.status === HeadingStatus.UNKNOWN) {
    return t('instrument.unknown')
  }
  return t('instrument.degrees', { value: heading.degrees.toFixed(0) })
}

function crossTrackText(crossTrack: CrossTrack, t: ReturnType<typeof useTranslation>['t']) {
  if (crossTrack.steerSide === SteerSide.ON_TRACK) {
    return t('instrument.onTrack')
  }
  if (crossTrack.steerSide === SteerSide.PORT) {
    return t('instrument.port', { value: crossTrack.distanceNauticalMiles.toFixed(2) })
  }
  return t('instrument.starboard', { value: crossTrack.distanceNauticalMiles.toFixed(2) })
}

function arrivalText(arrival: Arrival, t: ReturnType<typeof useTranslation>['t']) {
  if (arrival.status === ArrivalStatus.STOPPED) {
    return t('instrument.stopped')
  }
  return `${t('instrument.hours', { value: arrival.hours.toFixed(1) })} ${arrival.arrivalAt.slice(11, 16)} UTC`
}
