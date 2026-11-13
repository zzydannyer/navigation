import { useState } from 'react'
import {
  ActiveLegStatus,
  Arrival,
  ArrivalStatus,
  CrossTrack,
  FixStatus,
  Heading,
  HeadingStatus,
  orderedWaypoints,
  OwnShip,
  resolveActiveLeg,
  SteerSide,
} from '@navigation/core'
import { isUndefined } from 'lodash-es'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigationStore } from './store'

export function InstrumentPane() {
  const { t } = useTranslation()
  const [sentence, setSentence] = useState('')
  const ownShip = useNavigationStore((state) => state.ownShip)
  const waypoints = useNavigationStore((state) => state.waypoints)
  const routes = useNavigationStore((state) => state.routes)
  const activeRouteId = useNavigationStore((state) => state.activeRouteId)
  const applySentence = useNavigationStore((state) => state.applySentence)
  const activeRoute = routes.find((route) => route.id === activeRouteId)
  const leg =
    ownShip.status === FixStatus.FIXED && !isUndefined(activeRoute)
      ? resolveActiveLeg(
          ownShip.position,
          orderedWaypoints(activeRoute, waypoints),
          activeRoute.legKind,
          ownShip.speedKnots,
          ownShip.timestamp,
        )
      : { status: ActiveLegStatus.NONE as const }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <Readout label={t('instrument.route')} value={isUndefined(activeRoute) ? t('instrument.none') : activeRoute.name} />
      <Readout label={t('instrument.position')} value={positionText(ownShip, t('instrument.unknown'))} />
      <Readout label={t('instrument.speed')} value={t('instrument.knots', { value: ownShip.speedKnots.toFixed(1) })} />
      <Readout label={t('instrument.course')} value={t('instrument.degrees', { value: ownShip.courseDegrees.toFixed(0) })} />
      <Readout label={t('instrument.heading')} value={headingText(ownShip.heading, t)} />
      <Readout
        label={t('instrument.bearing')}
        value={leg.status === ActiveLegStatus.ACTIVE ? t('instrument.degrees', { value: leg.bearingDegrees.toFixed(0) }) : t('instrument.unknown')}
      />
      <Readout
        label={t('instrument.distance')}
        value={leg.status === ActiveLegStatus.ACTIVE ? t('instrument.nauticalMiles', { value: leg.distanceNauticalMiles.toFixed(2) }) : t('instrument.unknown')}
      />
      <Readout
        label={t('instrument.crossTrack')}
        value={leg.status === ActiveLegStatus.ACTIVE ? crossTrackText(leg.crossTrack, t) : t('instrument.unknown')}
      />
      <Readout
        label={t('instrument.arrival')}
        value={leg.status === ActiveLegStatus.ACTIVE ? arrivalText(leg.arrival, t) : t('instrument.unknown')}
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
