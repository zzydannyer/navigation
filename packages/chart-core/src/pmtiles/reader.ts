import { ChartErrorCode, type ChartError } from '../errors'
import { decodeDirectory, lookupEntry, type DirectoryEntry } from './directory'
import {
  HEADER_LENGTH,
  InternalCompression,
  parseHeader,
  TileCompression,
  TileType,
  zxyToTileId,
  type PmTilesHeader,
} from './header'

/**
 * Minimal file abstraction so the reader is platform-independent.
 */
export interface FileSource {
  read(offset: number, length: number): Promise<Uint8Array>
  size(): number
}

export type Decompressor = (kind: InternalCompression | TileCompression, bytes: Uint8Array) => Uint8Array

export interface PmTilesMetadata {
  name?: string
  format?: string
  attribution?: string
  description?: string
  vector_layers?: Array<{ id: string; fields: Record<string, string> }>
  [key: string]: unknown
}

export interface ResolvedTile {
  data: Uint8Array
  tileType: TileType
  tileCompression: TileCompression
}

export class PmTilesError extends Error {
  constructor(public code: ChartErrorCode, message: string) {
    super(message)
  }
}

export class PmTilesReader {
  private header: PmTilesHeader | undefined
  private root: DirectoryEntry[] | undefined
  private metadata: PmTilesMetadata | undefined

  constructor(
    private readonly file: FileSource,
    private readonly decompress: Decompressor,
  ) {}

  async open(): Promise<PmTilesHeader> {
    try {
      const headerBytes = await this.file.read(0, HEADER_LENGTH)
      const header = parseHeader(headerBytes)
      this.header = header
      this.assertHeaderSanity(header)
      const rootBytes = await this.file.read(
        Number(header.rootDirectoryOffset),
        Number(header.rootDirectoryLength),
      )
      this.root = decodeDirectory(this.decompressBlock(header.internalCompression, rootBytes))
      if (header.jsonMetadataLength > 0n) {
        const metaBytes = await this.file.read(
          Number(header.jsonMetadataOffset),
          Number(header.jsonMetadataLength),
        )
        const raw = this.decompressBlock(header.internalCompression, metaBytes)
        this.metadata = JSON.parse(new TextDecoder('utf-8').decode(raw)) as PmTilesMetadata
      }
      return header
    } catch (err) {
      if (err instanceof PmTilesError) {
        throw err
      }
      throw new PmTilesError(ChartErrorCode.CORRUPTED, (err as Error).message)
    }
  }

  getHeader(): PmTilesHeader {
    if (!this.header) {
      throw new PmTilesError(ChartErrorCode.RUNTIME, 'reader not opened')
    }
    return this.header
  }

  getMetadata(): PmTilesMetadata | undefined {
    return this.metadata
  }

  async getTile(z: number, x: number, y: number): Promise<ResolvedTile | undefined> {
    const header = this.getHeader()
    if (z < header.minZoom || z > header.maxZoom) {
      return undefined
    }
    if (!this.root) {
      throw new PmTilesError(ChartErrorCode.RUNTIME, 'reader not opened')
    }
    const tileId = zxyToTileId(z, x, y)
    let currentDir = this.root
    let dirOffset = header.rootDirectoryOffset
    let dirLength = header.rootDirectoryLength
    for (let depth = 0; depth <= 3; depth++) {
      const entry = lookupEntry(currentDir, tileId)
      if (!entry) {
        return undefined
      }
      if (entry.runLength > 0) {
        if (entry.length === 0) {
          return undefined
        }
        const absOffset = Number(BigInt(entry.offset) + header.tileDataOffset)
        const tileBytes = await this.file.read(absOffset, entry.length)
        let data = tileBytes
        if (header.tileCompression !== TileCompression.NONE && header.tileCompression !== TileCompression.UNKNOWN) {
          data = this.decompressBlock(header.tileCompression, tileBytes)
        }
        return { data, tileType: header.tileType, tileCompression: header.tileCompression }
      }
      // Leaf directory reference.
      const leafBytes = await this.file.read(
        Number(BigInt(entry.offset) + header.leafDirectoryOffset),
        entry.length,
      )
      currentDir = decodeDirectory(this.decompressBlock(header.internalCompression, leafBytes))
      dirOffset = header.leafDirectoryOffset
      dirLength = BigInt(entry.length)
    }
    throw new PmTilesError(ChartErrorCode.CORRUPTED, 'maximum directory depth exceeded')
  }

  validateTileType(header: PmTilesHeader): void {
    switch (header.tileType) {
      case TileType.MVT:
      case TileType.PNG:
      case TileType.JPEG:
      case TileType.WEBP:
        return
      default:
        throw new PmTilesError(
          ChartErrorCode.UNSUPPORTED,
          `tile type ${header.tileType} not supported`,
        )
    }
  }

  private decompressBlock(kind: InternalCompression | TileCompression, bytes: Uint8Array): Uint8Array {
    if (kind === InternalCompression.NONE || kind === InternalCompression.UNKNOWN) {
      return bytes
    }
    return this.decompress(kind, bytes)
  }

  private assertHeaderSanity(header: PmTilesHeader): void {
    const size = this.file.size()
    const maxEnd = Math.max(
      Number(header.rootDirectoryOffset + header.rootDirectoryLength),
      Number(header.jsonMetadataOffset + header.jsonMetadataLength),
      Number(header.leafDirectoryOffset + header.leafDirectoryLength),
      Number(header.tileDataOffset + header.tileDataLength),
    )
    if (maxEnd > size) {
      throw new PmTilesError(ChartErrorCode.CORRUPTED, 'header offsets exceed file size')
    }
    if (header.rootDirectoryLength === 0n) {
      throw new PmTilesError(ChartErrorCode.CORRUPTED, 'empty root directory')
    }
  }
}

export type { ChartError } from '../errors'
