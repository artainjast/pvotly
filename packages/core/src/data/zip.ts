/**
 * Minimal, dependency-free ZIP archive reader.
 *
 * Reads the central directory of a ZIP file and returns each entry's bytes,
 * transparently inflating DEFLATE-compressed (method 8) and copying stored
 * (method 0) entries. Used by {@link import('./spreadsheet').parseXlsx} since an
 * `.xlsx` workbook is a ZIP of XML parts.
 *
 * Supported: classic (non-ZIP64) archives with stored or DEFLATE entries — the
 * shape produced by every spreadsheet app. Not supported: ZIP64 (>4GB / >65535
 * entries), encryption, and compression methods other than 0/8.
 */

import { inflateRaw } from './inflate';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;

function toUint8(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** Locate the End Of Central Directory record (scanning back over its comment). */
function findEocd(view: DataView, bytes: Uint8Array): number {
  // EOCD is at least 22 bytes; the trailing comment can be up to 65535 bytes.
  const minPos = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/**
 * Parse a ZIP archive into a `name -> bytes` map.
 *
 * @throws if the archive is not a valid ZIP, or uses an unsupported feature.
 */
export function unzip(input: Uint8Array | ArrayBuffer): Map<string, Uint8Array> {
  const bytes = toUint8(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const eocd = findEocd(view, bytes);
  if (eocd < 0) throw new Error('unzip: not a ZIP archive (no end-of-central-directory record)');

  const entryCount = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true); // central directory offset

  const out = new Map<string, Uint8Array>();
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(ptr, true) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error('unzip: corrupt central directory');
    }
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);

    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    // Walk the local header to find where the entry's data actually begins.
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      data = inflateRaw(compressed, uncompressedSize);
    } else {
      throw new Error(`unzip: unsupported compression method ${method} for "${name}"`);
    }
    out.set(name, data);

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}
