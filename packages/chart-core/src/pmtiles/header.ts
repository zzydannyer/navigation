/**
 * PMTiles v3 on-disk format constants.
 *
 * Reference: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 * and the protomaps/pmtiles-js reference implementation.
 */

/** 7-byte magic at offset 0. */
export const PM_TILES_MAGIC = 'PMTiles'

/** Total header size in bytes. */
export const HEADER_LENGTH = 127

export enum InternalCompression {
  UNKNOWN = 0,
  NONE = 1,
  GZIP = 2,
  BROTLI = 3,
  ZSTD = 4,
}

export enum TileType {
  UNKNOWN = 0,
  MVT = 1,
  PNG = 2,
  JPEG = 3,
  WEBP = 4,
  AVIF = 5,
  MLT = 6,
}

export enum TileCompression {
  UNKNOWN = 0,
  NONE = 1,
  GZIP = 2,
  BROTLI = 3,
  ZSTD = 4,
}

export interface PmTilesHeader {
  specVersion: number
  rootDirectoryOffset: bigint
  rootDirectoryLength: bigint
  jsonMetadataOffset: bigint
  jsonMetadataLength: bigint
  leafDirectoryOffset: bigint
  leafDirectoryLength: bigint
  tileDataOffset: bigint
  tileDataLength: bigint
  addressedTilesCount: bigint
  tileEntriesCount: bigint
  tileContentsCount: bigint
  clustered: boolean
  internalCompression: InternalCompression
  tileCompression: TileCompression
  tileType: TileType
  minZoom: number
  maxZoom: number
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
  centerZoom: number
  centerLon: number
  centerLat: number
}

/**
 * Parse the 127-byte header. Throws on structural problems; the caller
 * converts that to ChartError.CORRUPTED.
 */
export function parseHeader(bytes: Uint8Array): PmTilesHeader {
  if (bytes.byteLength < HEADER_LENGTH) {
    throw new Error('header too short')
  }
  const magic = new TextDecoder('latin1').decode(bytes.subarray(0, 7))
  if (magic !== PM_TILES_MAGIC) {
    throw new Error('bad magic')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  const version = bytes[7]
  if (version !== 3) {
    throw new Error(`unsupported spec version ${version}`)
  }
  const e7 = (i: number) => view.getInt32(i, true) / 1e7
  return {
    specVersion: version,
    rootDirectoryOffset: view.getBigUint64(8, true),
    rootDirectoryLength: view.getBigUint64(16, true),
    jsonMetadataOffset: view.getBigUint64(24, true),
    jsonMetadataLength: view.getBigUint64(32, true),
    leafDirectoryOffset: view.getBigUint64(40, true),
    leafDirectoryLength: view.getBigUint64(48, true),
    tileDataOffset: view.getBigUint64(56, true),
    tileDataLength: view.getBigUint64(64, true),
    addressedTilesCount: view.getBigUint64(72, true),
    tileEntriesCount: view.getBigUint64(80, true),
    tileContentsCount: view.getBigUint64(88, true),
    clustered: bytes[96] === 1,
    internalCompression: bytes[97] as InternalCompression,
    tileCompression: bytes[98] as TileCompression,
    tileType: bytes[99] as TileType,
    minZoom: bytes[100],
    maxZoom: bytes[101],
    minLon: e7(102),
    minLat: e7(106),
    maxLon: e7(110),
    maxLat: e7(114),
    centerZoom: bytes[118],
    centerLon: e7(119),
    centerLat: e7(123),
  }
}

/** Rotate (x,y) within a square of side 2^n for the Hilbert curve. */
function rotate(n: number, x: number, y: number, sx: number, sy: number): [number, number] {
  if (sy === 0) {
    if (sx === 1) {
      return [n - 1 - x, n - 1 - y]
    }
    return [y, x]
  }
  return [x, y]
}

/**
 * Convert (z, x, y) to the global Hilbert tileId used in PMTiles v3
 * directories. This is the reference implementation's formula.
 */
export function zxyToTileId(z: number, x: number, y: number): number {
  if (z > 26) {
    throw new Error('tile zoom exceeds max safe number limit (26)')
  }
  if (x >= 1 << z || y >= 1 << z) {
    throw new Error('tile x/y outside zoom level bounds')
  }
  let acc = ((1 << z) * (1 << z) - 1) / 3
  let n = z - 1
  let s = x
  let i = y
  for (let a = 1 << n; a > 0; a >>= 1) {
    const cx = s & a
    const cy = i & a
    acc += (3 * (cx !== 0 ? 1 : 0) ^ (cy !== 0 ? 1 : 0)) * (1 << n)
    const rotated = rotate(a, s, i, cx, cy)
    s = rotated[0]
    i = rotated[1]
    n--
  }
  return acc
}
