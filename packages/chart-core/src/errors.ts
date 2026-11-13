/**
 * Stable, localisable error codes. The mobile layer maps these to i18n strings;
 * the core never talks in English prose directly.
 */
export enum ChartErrorCode {
  /** File is truncated, fails magic/CRC check, or cannot be parsed. */
  CORRUPTED = 'CORRUPTED',
  /** Format is recognised but not supported on this platform (e.g. zstd, S-63). */
  UNSUPPORTED = 'UNSUPPORTED',
  /** Source references an update package that is missing. */
  MISSING_UPDATE = 'MISSING_UPDATE',
  /** S-63 / DRM authorisation failed or certificate missing. */
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  /** Not enough free space on device. */
  DISK_FULL = 'DISK_FULL',
  /** User cancelled the import. */
  CANCELLED = 'CANCELLED',
  /** Duplicate content already installed. */
  DUPLICATE = 'DUPLICATE',
  /** Unclassified runtime failure. */
  RUNTIME = 'RUNTIME',
}

export interface ChartError {
  code: ChartErrorCode
  /** Optional machine-readable detail (path, expected vs actual). */
  detail?: string
}

export function chartError(code: ChartErrorCode, detail?: string): ChartError {
  return { code, detail }
}
