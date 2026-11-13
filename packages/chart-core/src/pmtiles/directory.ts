/**
 * Directory decoding for PMTiles v3.
 *
 * The v3 directory format is COLUMNAR, not row-by-row:
 *   [count(varint)]
 *   [count] tile_id_delta varints   (delta from previous; first is absolute)
 *   [count] run_length varints
 *   [count] length varints
 *   [count] offset varints          (0 means "continue previous entry's blob";
 *                                     otherwise stored value minus 1)
 */
export interface DirectoryEntry {
  /** Absolute tileId of this entry. */
  tileId: number
  /** Run length; 0 means "leaf directory follows at offset". */
  runLength: number
  /** Byte length of the tile/leaf data. */
  length: number
  /** Byte offset (relative to tileDataOffset / leafDirectoryOffset). */
  offset: number
}

/** Read an unsigned varint (LEB128) at `cursor`. */
export function readVarint(bytes: Uint8Array, cursor: number): { value: number; next: number } {
  let result = 0
  let shift = 0
  let i = cursor
  while (i < bytes.byteLength) {
    const b = bytes[i]
    i++
    result |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) {
      return { value: result, next: i }
    }
    shift += 7
    if (shift > 35) {
      throw new Error('varint too long')
    }
  }
  throw new Error('truncated varint')
}

/**
 * Decode a raw (already decompressed) directory byte block into entries.
 */
export function decodeDirectory(bytes: Uint8Array): DirectoryEntry[] {
  if (bytes.byteLength === 0) {
    return []
  }
  let cursor = 0
  const count = readVarint(bytes, cursor).value
  cursor = readVarint(bytes, cursor).next
  const entries: DirectoryEntry[] = []
  let lastId = 0
  for (let i = 0; i < count; i++) {
    const delta = readVarint(bytes, cursor)
    cursor = delta.next
    lastId += delta.value
    entries.push({ tileId: lastId, runLength: 1, length: 0, offset: 0 })
  }
  for (let i = 0; i < count; i++) {
    const runLength = readVarint(bytes, cursor)
    cursor = runLength.next
    entries[i].runLength = runLength.value
  }
  for (let i = 0; i < count; i++) {
    const length = readVarint(bytes, cursor)
    cursor = length.next
    entries[i].length = length.value
  }
  for (let i = 0; i < count; i++) {
    const offsetRaw = readVarint(bytes, cursor)
    cursor = offsetRaw.next
    if (offsetRaw.value === 0 && i > 0) {
      entries[i].offset = entries[i - 1].offset + entries[i - 1].length
    } else {
      entries[i].offset = offsetRaw.value - 1
    }
  }
  return entries
}

/**
 * Locate the entry for `targetId` in a decoded directory.
 */
export function lookupEntry(
  entries: DirectoryEntry[],
  targetId: number,
): DirectoryEntry | undefined {
  let lo = 0
  let hi = entries.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (entries[mid].tileId <= targetId) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found < 0) {
    return undefined
  }
  const entry = entries[found]
  if (entry.runLength === 0) {
    return entry
  }
  if (targetId - entry.tileId < entry.runLength) {
    return entry
  }
  return undefined
}
