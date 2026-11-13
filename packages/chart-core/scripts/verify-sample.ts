/**
 * Real-file verification of the PMTiles v3 reader against the Protomaps
 * Firenze sample (ODbL). Run: pnpm --filter @navigation/chart-core exec tsx scripts/verify-sample.ts
 */
import { createReadStream, statSync } from 'node:fs'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { open } from 'node:fs/promises'
import { PmTilesReader, InternalCompression, TileType, zxyToTileId, type Decompressor, type FileSource } from '../src'

const path = process.argv[2]
if (!path) {
  console.error('usage: verify-sample.ts <file.pmtiles>')
  process.exit(2)
}

class NodeFileSource implements FileSource {
  private readonly fd: number
  private readonly sizeBytes: number
  constructor(fd: number, size: number) {
    this.fd = fd
    this.sizeBytes = size
  }
  static async open(path: string): Promise<NodeFileSource> {
    const handle = await open(path, 'r')
    const size = (await handle.stat()).size
    return new NodeFileSource(handle.fd, size)
  }
  async read(offset: number, length: number): Promise<Uint8Array> {
    const handle = await open(path, 'r')
    const buf = Buffer.alloc(length)
    await handle.read(buf, 0, length, offset)
    await handle.close()
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  size(): number {
    return this.sizeBytes
  }
}

const decompress: Decompressor = (kind, bytes) => {
  if (kind === InternalCompression.GZIP) return new Uint8Array(gunzipSync(bytes))
  if (kind === InternalCompression.BROTLI) return new Uint8Array(brotliDecompressSync(bytes))
  if (kind === InternalCompression.ZSTD) throw new Error('zstd not supported in node sample verifier')
  return bytes
}

async function main() {
  const file = await NodeFileSource.open(path)
  const reader = new PmTilesReader(file, decompress)
  const header = await reader.open()
  console.log('=== header ===')
  console.log('specVersion      :', header.specVersion)
  console.log('tileType         :', TileType[header.tileType], `(${header.tileType})`)
  console.log('tileCompression  :', header.tileCompression)
  console.log('internalCompress :', header.internalCompression)
  console.log('zoom range       :', header.minZoom, '-', header.maxZoom)
  console.log('coverage         :', [header.minLon, header.minLat, header.maxLon, header.maxLat].map((v) => v.toFixed(4)).join(', '))
  console.log('clustered        :', header.clustered)
  console.log('addressedTiles   :', header.addressedTilesCount.toString())
  console.log('tileDataLength   :', header.tileDataLength.toString(), 'bytes')
  const meta = reader.getMetadata()
  console.log('=== metadata ===')
  console.log('name             :', meta?.name)
  console.log('format           :', meta?.format)
  console.log('attribution      :', meta?.attribution)
  if (Array.isArray(meta?.vector_layers)) {
    console.log('vector_layers    :', meta!.vector_layers.map((l) => l.id).join(', '))
  }
  console.log('=== tile lookup (Florence ~11.25E, 43.77N) ===')
  // Iterate z=0..15 and find the tile that covers Florence.
  for (let z = 0; z <= 15; z++) {
    const n = 2 ** z
    const x = Math.floor(((11.25 + 180) / 360) * n)
    const latRad = (43.77 * Math.PI) / 180
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    const t = await reader.getTile(z, x, y)
    if (t) {
      console.log(`z${z}/${x}/${y}    : HIT ${t.data.byteLength} bytes (type=${TileType[t.tileType]})`)
    }
  }
  console.log('tileId(z=7,x=68,y=47):', zxyToTileId(7, 68, 47))
  reader.validateTileType(header)
  console.log('validateTileType : OK')
}

main().catch((err) => {
  console.error('FAIL', err)
  process.exit(1)
})
