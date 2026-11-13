/**
 * Chart source kinds supported by the platform.
 *
 * S-100 is intentionally NOT a single catch-all bucket: S-57 (ENC), S-63
 * (encrypted ENC) and S-101 (S-100 ENC edition) are kept as separate kinds so
 * that capability declarations and failure modes can distinguish them.
 */
export enum ChartSourceKind {
  S57 = 'S57',
  S63 = 'S63',
  S101 = 'S101',
  PMTILES = 'PMTILES',
}

export function isChartSourceKind(value: string): value is ChartSourceKind {
  return (
    value === ChartSourceKind.S57 ||
    value === ChartSourceKind.S63 ||
    value === ChartSourceKind.S101 ||
    value === ChartSourceKind.PMTILES
  )
}
