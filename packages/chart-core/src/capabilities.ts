import type { ChartSourceKind } from './sourceKind'

/**
 * Capability declarations. A platform may support *reading* a format without
 * being able to *display* it. We must not claim display support for S-52
 * symbology we have not implemented, and S-63 requires an authorisation
 * certificate we do not ship.
 */
export type Capability =
  | 'read'
  | 'update'
  | 'display'
  | 'query'
  | 'securityCheck'
  | 'offline'

export interface PlatformProfile {
  /** e.g. "expo-ios", "expo-android", "desktop-tauri". */
  platform: string
  /** Map library version, e.g. "maplibre-native 13.6.1" or "unknown". */
  maplibreVersion: string
  /** Product edition string ("unknown" when unknown). */
  edition: string
}

/**
 * Declared capabilities for a given source kind on a given platform.
 * Unknown MUST NOT be treated as support: a capability is present only when
 * the entry explicitly lists it.
 */
export interface CapabilityDeclaration {
  kind: ChartSourceKind
  supported: readonly Capability[]
  /** Human-readable note explaining why something is NOT supported. */
  notes: string
}

/**
 * The ONLY place display capabilities are declared. If a capability is not
 * listed here, the UI must show "unsupported".
 *
 * - PMTILES: read + offline tile delivery are implemented (pure-TS reader);
 *   `display` is declared only for raster/vector tiles that MapLibre can
 *   render, NOT as an ENC safety-query input.
 * - S57/S101: read is declared as "capability probe only" — P3 will build the
 *   display engine; until then we deliberately do NOT declare `display`.
 * - S63: requires an authorisation certificate we do not have; declare nothing
 *   except `securityCheck` is unknown -> omitted.
 */
export function declareCapabilities(
  kind: ChartSourceKind,
  profile: PlatformProfile,
): CapabilityDeclaration {
  switch (kind) {
    case 'PMTILES' as ChartSourceKind:
      return {
        kind,
        supported: ['read', 'offline', 'display'],
        notes:
          'PMTiles v3 archive reader; tiles are raster/vector basemap tiles only, ' +
          'NOT an ENC safety-query source. Display via MapLibre tile source; ' +
          `native pmtiles:// support depends on ${profile.maplibreVersion}.`,
      }
    case 'S57' as ChartSourceKind:
      return {
        kind,
        supported: [],
        notes:
          'S-57 parse/display engine is P3. No read capability is declared yet: ' +
          'declaring support before the parser exists would mislead operators.',
      }
    case 'S101' as ChartSourceKind:
      return {
        kind,
        supported: [],
        notes: 'S-101 is P5, gated on the S-100 toolchain. No capability declared.',
      }
    case 'S63' as ChartSourceKind:
      return {
        kind,
        supported: [],
        notes: 'S-63 requires an external authorisation certificate; not shipped.',
      }
    default:
      return { kind, supported: [], notes: 'Unknown chart kind.' }
  }
}
