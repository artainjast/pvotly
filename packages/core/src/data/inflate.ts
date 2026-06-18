/**
 * Minimal, dependency-free DEFLATE (RFC 1951) decompressor.
 *
 * This is a TypeScript port of the well-known "tiny-inflate" algorithm
 * (Joergen Ibsen's original C `tinf`, ported to JS by Devon Govett, MIT). It is
 * used by {@link import('./zip').unzip} so @pvotly/core can read `.xlsx`
 * (a zip of XML) with no runtime dependencies and no reliance on `zlib` /
 * `DecompressionStream`, keeping the path synchronous and identical in Node and
 * the browser.
 *
 * Decompresses raw DEFLATE streams (as stored inside zip entries). The
 * uncompressed size must be known up front (zip headers provide it).
 */

const TINF_OK = 0;
const TINF_DATA_ERROR = -3;

class Tree {
  /** Number of codes of each bit-length. */
  table = new Uint16Array(16);
  /** Code -> symbol translation table. */
  trans = new Uint16Array(288);
}

class Data {
  sourceIndex = 0;
  tag = 0;
  bitcount = 0;
  destLen = 0;
  ltree = new Tree();
  dtree = new Tree();
  constructor(
    public readonly source: Uint8Array,
    public readonly dest: Uint8Array,
  ) {}
}

const sltree = new Tree();
const sdtree = new Tree();

const lengthBits = new Uint8Array(30);
const lengthBase = new Uint16Array(30);
const distBits = new Uint8Array(30);
const distBase = new Uint16Array(30);

// Special ordering of code length codes.
const clcidx = new Uint8Array([
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
]);

const codeTree = new Tree();
const lengths = new Uint8Array(288 + 32);
const offs = new Uint16Array(16);

function buildBitsBase(bits: Uint8Array, base: Uint16Array, delta: number, first: number): void {
  let i: number;
  let sum: number;
  for (i = 0; i < delta; ++i) bits[i] = 0;
  for (i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;
  for (sum = first, i = 0; i < 30; ++i) {
    base[i] = sum;
    sum += 1 << bits[i]!;
  }
}

function buildFixedTrees(lt: Tree, dt: Tree): void {
  let i: number;
  for (i = 0; i < 7; ++i) lt.table[i] = 0;
  lt.table[7] = 24;
  lt.table[8] = 152;
  lt.table[9] = 112;
  for (i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
  for (i = 0; i < 144; ++i) lt.trans[24 + i] = i;
  for (i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
  for (i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;
  for (i = 0; i < 5; ++i) dt.table[i] = 0;
  dt.table[5] = 32;
  for (i = 0; i < 32; ++i) dt.trans[i] = i;
}

function buildTree(t: Tree, src: Uint8Array, off: number, num: number): void {
  let i: number;
  let sum: number;
  for (i = 0; i < 16; ++i) t.table[i] = 0;
  for (i = 0; i < num; ++i) {
    const sym = src[off + i]!;
    t.table[sym] = (t.table[sym] ?? 0) + 1;
  }
  t.table[0] = 0;
  for (sum = 0, i = 0; i < 16; ++i) {
    offs[i] = sum;
    sum += t.table[i] ?? 0;
  }
  for (i = 0; i < num; ++i) {
    const len = src[off + i]!;
    if (len) {
      t.trans[offs[len]!] = i;
      offs[len] = (offs[len] ?? 0) + 1;
    }
  }
}

function getBit(d: Data): number {
  if (!d.bitcount--) {
    d.tag = d.source[d.sourceIndex++]!;
    d.bitcount = 7;
  }
  const bit = d.tag & 1;
  d.tag >>>= 1;
  return bit;
}

function readBits(d: Data, num: number, base: number): number {
  if (!num) return base;
  while (d.bitcount < 24) {
    d.tag |= (d.source[d.sourceIndex++] ?? 0) << d.bitcount;
    d.bitcount += 8;
  }
  const val = d.tag & (0xffff >>> (16 - num));
  d.tag >>>= num;
  d.bitcount -= num;
  return val + base;
}

function decodeSymbol(d: Data, t: Tree): number {
  while (d.bitcount < 24) {
    d.tag |= (d.source[d.sourceIndex++] ?? 0) << d.bitcount;
    d.bitcount += 8;
  }
  let sum = 0;
  let cur = 0;
  let len = 0;
  let tag = d.tag;
  do {
    cur = 2 * cur + (tag & 1);
    tag >>>= 1;
    ++len;
    sum += t.table[len]!;
    cur -= t.table[len]!;
  } while (cur >= 0);
  d.tag = tag;
  d.bitcount -= len;
  return t.trans[sum + cur]!;
}

function decodeTrees(d: Data, lt: Tree, dt: Tree): void {
  let num: number;
  let length: number;
  const hlit = readBits(d, 5, 257);
  const hdist = readBits(d, 5, 1);
  const hclen = readBits(d, 4, 4);
  for (let i = 0; i < 19; ++i) lengths[i] = 0;
  for (let i = 0; i < hclen; ++i) {
    const clen = readBits(d, 3, 0);
    lengths[clcidx[i]!] = clen;
  }
  buildTree(codeTree, lengths, 0, 19);
  for (num = 0; num < hlit + hdist; ) {
    const sym = decodeSymbol(d, codeTree);
    switch (sym) {
      case 16: {
        const prev = lengths[num - 1]!;
        for (length = readBits(d, 2, 3); length; --length) lengths[num++] = prev;
        break;
      }
      case 17:
        for (length = readBits(d, 3, 3); length; --length) lengths[num++] = 0;
        break;
      case 18:
        for (length = readBits(d, 7, 11); length; --length) lengths[num++] = 0;
        break;
      default:
        lengths[num++] = sym;
        break;
    }
  }
  buildTree(lt, lengths, 0, hlit);
  buildTree(dt, lengths, hlit, hdist);
}

function inflateBlockData(d: Data, lt: Tree, dt: Tree): number {
  for (;;) {
    let sym = decodeSymbol(d, lt);
    if (sym === 256) return TINF_OK;
    if (sym < 256) {
      d.dest[d.destLen++] = sym;
    } else {
      sym -= 257;
      const length = readBits(d, lengthBits[sym]!, lengthBase[sym]!);
      const dist = decodeSymbol(d, dt);
      const offset = d.destLen - readBits(d, distBits[dist]!, distBase[dist]!);
      for (let i = offset; i < offset + length; ++i) d.dest[d.destLen++] = d.dest[i]!;
    }
  }
}

function inflateUncompressedBlock(d: Data): number {
  let length: number;
  let invlength: number;
  while (d.bitcount > 8) {
    d.sourceIndex--;
    d.bitcount -= 8;
  }
  length = d.source[d.sourceIndex + 1]!;
  length = 256 * length + d.source[d.sourceIndex]!;
  invlength = d.source[d.sourceIndex + 3]!;
  invlength = 256 * invlength + d.source[d.sourceIndex + 2]!;
  if (length !== (~invlength & 0x0000ffff)) return TINF_DATA_ERROR;
  d.sourceIndex += 4;
  for (let i = length; i; --i) d.dest[d.destLen++] = d.source[d.sourceIndex++]!;
  d.bitcount = 0;
  return TINF_OK;
}

let initialized = false;
function init(): void {
  if (initialized) return;
  buildFixedTrees(sltree, sdtree);
  buildBitsBase(lengthBits, lengthBase, 4, 3);
  buildBitsBase(distBits, distBase, 2, 1);
  // Fix up a couple of out-of-range values.
  lengthBits[28] = 0;
  lengthBase[28] = 258;
  initialized = true;
}

/**
 * Inflate a raw DEFLATE stream into a buffer of the (known) uncompressed size.
 *
 * @throws on malformed input.
 */
export function inflateRaw(source: Uint8Array, uncompressedSize: number): Uint8Array {
  init();
  const dest = new Uint8Array(uncompressedSize);
  const d = new Data(source, dest);
  let bfinal: number;
  let res: number;
  do {
    bfinal = getBit(d);
    const btype = readBits(d, 2, 0);
    switch (btype) {
      case 0:
        res = inflateUncompressedBlock(d);
        break;
      case 1:
        res = inflateBlockData(d, sltree, sdtree);
        break;
      case 2:
        decodeTrees(d, d.ltree, d.dtree);
        res = inflateBlockData(d, d.ltree, d.dtree);
        break;
      default:
        res = TINF_DATA_ERROR;
    }
    if (res !== TINF_OK) throw new Error('inflateRaw: corrupt DEFLATE stream');
  } while (!bfinal);

  return d.destLen === dest.length ? dest : dest.subarray(0, d.destLen);
}
