import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  FixStatus,
  HeadingStatus,
  SteerSide,
  zh,
  type CrossTrack,
  type Heading,
  type OwnShip,
} from '@navigation/core';
import { selectNavigationGuidance } from '@navigation/app';
import { useNavigationStore } from '../store';

/** 仪表：与 Tauri InstrumentPanel 同字段、同单位；模拟/真实来源单独标识。 */
export function InstrumentScreen() {
  const state = useNavigationStore();
  const guidance = selectNavigationGuidance(state);
  const navigation = state.navigation;
  const ownShip = state.ownShip;
  const leg = guidance.leg;

  const status = {
    idle: zh.nav.statusIdle,
    running: zh.nav.statusRunning,
    paused: zh.nav.statusPaused,
    ended: zh.nav.statusEnded,
  }[navigation.status];
  const source = guidance.sessionActive
    ? guidance.mode === 'simulation'
      ? zh.nav.modeSimulation
      : zh.nav.modeReal
    : null;
  const statusText = source === null ? status : `${status} · ${source}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Readout label={zh.instrument.route} value={leg.route?.name ?? zh.instrument.none} />
      <Readout label={zh.nav.status} value={statusText} />
      <Readout label={zh.instrument.position} value={positionText(ownShip)} />
      <Readout
        label={zh.instrument.speed}
        value={zh.instrument.knots.replace('{{value}}', ownShip.speedKnots.toFixed(1))}
      />
      <Readout
        label={zh.instrument.course}
        value={zh.instrument.degrees.replace('{{value}}', ownShip.courseDegrees.toFixed(0))}
      />
      <Readout label={zh.instrument.heading} value={headingText(ownShip.heading)} />
      <Readout
        label={zh.instrument.bearing}
        value={
          guidance.bearingDegrees === null
            ? zh.instrument.unknown
            : zh.instrument.degrees.replace('{{value}}', guidance.bearingDegrees.toFixed(0))
        }
      />
      <Readout
        label={zh.instrument.distance}
        value={leg.to === null ? zh.instrument.unknown : nauticalMiles(leg.nextDistanceNauticalMiles)}
      />
      <Readout label={zh.instrument.crossTrack} value={crossTrackText(guidance.crossTrack)} />
      <Readout label={zh.instrument.arrival} value={arrivalText(guidance.arrival)} />
      <Readout label={zh.nav.next} value={leg.to?.name ?? zh.instrument.unknown} />
      <Readout label={zh.nav.remaining} value={nauticalMiles(leg.remainingDistanceNauticalMiles)} />
      <Readout
        label={zh.instrument.realFix}
        value={state.realFix === null ? zh.instrument.noRealFix : positionText(state.realFix)}
      />
    </ScrollView>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function nauticalMiles(value: number): string {
  return zh.instrument.nauticalMiles.replace('{{value}}', value.toFixed(2));
}

function positionText(ownShip: OwnShip): string {
  if (ownShip.status !== FixStatus.FIXED) return zh.instrument.unknown;
  const latitude = `${Math.abs(ownShip.position.latitude).toFixed(5)}° ${ownShip.position.latitude >= 0 ? 'N' : 'S'}`;
  const longitude = `${Math.abs(ownShip.position.longitude).toFixed(5)}° ${ownShip.position.longitude >= 0 ? 'E' : 'W'}`;
  return `${latitude}  ${longitude}`;
}

function headingText(heading: Heading): string {
  if (heading.status === HeadingStatus.UNKNOWN) return zh.instrument.unknown;
  return zh.instrument.degrees.replace('{{value}}', heading.degrees.toFixed(0));
}

function crossTrackText(crossTrack: CrossTrack | null): string {
  if (crossTrack === null) return zh.instrument.unknown;
  if (crossTrack.steerSide === SteerSide.ON_TRACK) return zh.instrument.onTrack;
  const template =
    crossTrack.steerSide === SteerSide.PORT ? zh.instrument.port : zh.instrument.starboard;
  return template.replace('{{value}}', crossTrack.distanceNauticalMiles.toFixed(2));
}

function arrivalText(arrival: ReturnType<typeof selectNavigationGuidance>['arrival']): string {
  if (arrival === null) return zh.instrument.unknown;
  if (arrival.status === 'STOPPED') return zh.instrument.stopped;
  return `${zh.instrument.hours.replace('{{value}}', arrival.hours.toFixed(1))} · ${arrival.arrivalAt.slice(11, 16)} UTC`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 120, gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  label: { fontSize: 12, color: '#64748b' },
  value: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
});
