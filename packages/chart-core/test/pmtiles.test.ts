import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  ChartErrorCode,
  InternalCompression,
  PmTilesReader,
  PmTilesError,
  TileCompression,
  TileType,
  zxyToTileId,
  type Decompressor,
  type FileSource,
} from '../src'

const decompress: Decompressor = (kind, bytes) => {
  if (kind === InternalCompression.GZIP) return new Uint8Array(gunzipSync(bytes))
  if (kind === InternalCompression.BROTLI) return new Uint8Array(brotliDecompressSync(bytes))
  if (kind === InternalCompression.ZSTD) throw new PmTilesError(ChartErrorCode.UNSUPPORTED, 'zstd not supported')
  return bytes
}

function varint(n: number): number[] {
  const out: number[] = []
  let v = n
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v > 0) b |= 0x80
    out.push(b)
  } while (v > 0)
  return out
}

class MemFile implements FileSource {
  constructor(private readonly buf: Uint8Array) {}
  read(offset: number, length: number): Promise<Uint8Array> {
    return Promise.resolve(this.buf.slice(offset, offset + length))
  }
  size(): number {
    return this.buf.byteLength
  }
}

interface BuildOptions {
  tileType?: TileType
  internalCompression?: InternalCompression
  tileCompression?: TileCompression
  badMagic?: boolean
  truncate?: number
}

/**
 * Build a minimal valid PMTiles v3 archive in memory using the columnar
 * directory format. One tile at z=0,x=0,y=0 (Hilbert tileId = 0).
 */
function buildArchive(opts: BuildOptions = {}): Uint8Array {
  const tile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  const meta = new TextEncoder().encode(JSON.stringify({ name: 'test', format: 'pbf' }))

  // Columnar directory: count=1, then 1 delta, 1 runLength, 1 length, 1 offset.
  // offset varint = 1 -> decoded offset = 0 (i-1).
  const rootDir = new Uint8Array([
    ...varint(1), // count
    ...varint(0), // tileId delta (first = absolute 0)
    ...varint(1), // runLength
    ...varint(tile.byteLength), // length
    ...varint(1), // offset (stored as 1, decoded as 0)
  ])

  const layout = {
    rootDirOffset: 127,
    rootDirLength: rootDir.byteLength,
    metaOffset: 127 + rootDir.byteLength,
    metaLength: meta.byteLength,
    tileOffset: 127 + rootDir.byteLength + meta.byteLength,
    tileLength: tile.byteLength,
  }

  const header = new Uint8Array(127)
  const view = new DataView(header.buffer)
  header.set(new TextEncoder().encode(opts.badMagic ? 'XXXXXXX' : 'PMTiles'), 0)
  header[7] = 3
  view.setBigUint64(8, BigInt(layout.rootDirOffset), true)
  view.setBigUint64(16, BigInt(layout.rootDirLength), true)
  view.setBigUint64(24, BigInt(layout.metaOffset), true)
  view.setBigUint64(32, BigInt(layout.metaLength), true)
  view.setBigUint64(40, 0n, true)
  view.setBigUint64(48, 0n, true)
  view.setBigUint64(56, BigInt(layout.tileOffset), true)
  view.setBigUint64(64, BigInt(layout.tileLength), true)
  view.setBigUint64(72, 1n, true)
  view.setBigUint64(80, 1n, true)
  view.setBigUint64(88, 1n, true)
  header[96] = 0
  header[97] = (opts.internalCompression ?? InternalCompression.NONE) as number
  header[98] = (opts.tileCompression ?? TileCompression.NONE) as number
  header[99] = (opts.tileType ?? TileType.PNG) as number
  header[100] = 0
  header[101] = 2
  view.setInt32(102, -180e7, true)
  view.setInt32(106, -85e7, true)
  view.setInt32(110, 180e7, true)
  view.setInt32(114, 85e7, true)
  header[118] = 0
  view.setInt32(119, 0, true)
  view.setInt32(123, 0, true)

  const out = new Uint8Array(127 + rootDir.byteLength + meta.byteLength + tile.byteLength)
  out.set(header, 0)
  out.set(rootDir, 127)
  out.set(meta, 127 + rootDir.byteLength)
  out.set(tile, 127 + rootDir.byteLength + meta.byteLength)

  if (typeof opts.truncate === 'number') {
    return out.slice(0, opts.truncate)
  }
  return out
}

describe('zxyToTileId (Hilbert)', () => {
  it('z=0,x=0,y=0 maps to id 0', () => {
    expect(zxyToTileId(0, 0, 0)).toBe(0)
  })
  it('throws for out-of-bounds x/y', () => {
    expect(() => zxyToTileId(1, 2, 0)).toThrow()
  })
})

describe('PmTilesReader (synthetic archive)', () => {
  it('opens, parses header and metadata', async () => {
    const reader = new PmTilesReader(new MemFile(buildArchive()), decompress)
    const header = await reader.open()
    expect(header.specVersion).toBe(3)
    expect(header.tileType).toBe(TileType.PNG)
    expect(header.minZoom).toBe(0)
    expect(header.maxZoom).toBe(2)
    expect(reader.getMetadata()?.name).toBe('test')
  })

  it('returns the exact tile bytes for z=0,x=0,y=0', async () => {
    const reader = new PmTilesReader(new MemFile(buildArchive()), decompress)
    await reader.open()
    const tile = await reader.getTile(0, 0, 0)
    expect(tile).toBeDefined()
    expect(Array.from(tile!.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns undefined for out-of-range zoom', async () => {
    const reader = new PmTilesReader(new MemFile(buildArchive()), decompress)
    await reader.open()
    expect(await reader.getTile(5, 0, 0)).toBeUndefined()
  })

  it('bad magic maps to CORRUPTED', async () => {
    const reader = new PmTilesReader(new MemFile(buildArchive({ badMagic: true })), decompress)
    await expect(reader.open()).rejects.toMatchObject({ code: ChartErrorCode.CORRUPTED })
  })

  it('truncated file maps to CORRUPTED', async () => {
    const reader = new PmTilesReader(new MemFile(buildArchive({ truncate: 50 })), decompress)
    await expect(reader.open()).rejects.toMatchObject({ code: ChartErrorCode.CORRUPTED })
  })

  it('unsupported tile type (AVIF) is rejected by validateTileType', async () => {
    const reader = new PmTilesReader(
      new MemFile(buildArchive({ tileType: TileType.AVIF })),
      decompress,
    )
    const header = await reader.open()
    try {
      reader.validateTileType(header)
      throw new Error('expected validateTileType to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(PmTilesError)
      expect((err as PmTilesError).code).toBe(ChartErrorCode.UNSUPPORTED)
    }
  })
})
