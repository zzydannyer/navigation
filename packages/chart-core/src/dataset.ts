import type { ChartSourceKind } from './sourceKind'

/**
 * Coverage rectangle in degrees. When a field is not recoverable from the
 * source it MUST be reported as `undefined` (displayed as "unknown" in the
 * UI) rather than invented.
 */
export interface CoverageBox {
  west: number
  south: number
  east: number
  north: number
}

/**
 * Metadata about a chart dataset. Every field that cannot be read from the
 * source or its catalogue record is `undefined`; the UI surfaces that as
 * "unknown". The platform must never synthesise a value it did not read.
 */
export interface ChartDataset {
  /** Stable identifier assigned by the catalogue (never user-visible). */
  id: string
  kind: ChartSourceKind
  /** Human label, e.g. cell name or archive basename. */
  title: string
  /** Origin of the data (official source, distributor, or "unknown"). */
  source: string | undefined
  /** Edition string, e.g. "3.1" or "unknown". */
  edition: string | undefined
  /** Update application string, e.g. "UTA 2026-09" or "unknown". */
  update: string | undefined
  /** Spatial coverage. */
  coverage: CoverageBox | undefined
  /** Nominal scale denominator, e.g. 1:25000 -> 25000. */
  scaleDenominator: number | undefined
  /** ISO timestamp of last update as reported by the source. */
  updatedAt: string | undefined
  /** Free-form data-quality note (e.g. "LO", "U") or "unknown". */
  dataQuality: string | undefined
  /** Validity window start/end as ISO dates or "unknown". */
  validFrom: string | undefined
  validUntil: string | undefined
  /** Required datum/CRS note, e.g. "WGS84" or "unknown". */
  datum: string | undefined
  /** Absolute on-disk path where the committed file lives. */
  filePath: string
  /** Size in bytes of the committed file. */
  fileSizeBytes: number
  /** Content hash (best-effort, e.g. xxhash/sha256) used for dedupe. */
  contentHash: string
}
