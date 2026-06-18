import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { parseXlsx, sheetToRecords } from './spreadsheet';

/* -------------------------------------------------------------------------- */
/* Tiny in-memory .xlsx (ZIP) builder for the tests                           */
/* -------------------------------------------------------------------------- */

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const bytes = (s: string) => Array.from(new TextEncoder().encode(s));

interface Entry {
  name: string;
  data: string;
  method: 0 | 8;
}

function makeZip(entries: Entry[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];

  for (const entry of entries) {
    const nameBytes = bytes(entry.name);
    const raw = new TextEncoder().encode(entry.data);
    const stored = entry.method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const localOffset = local.length;

    // Local file header.
    local.push(
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(entry.method),
      ...u16(0),
      ...u16(0),
      ...u32(0), // crc (ignored by our reader)
      ...u32(stored.length),
      ...u32(raw.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...stored,
    );

    // Central directory header.
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(entry.method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(stored.length),
      ...u32(raw.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(localOffset),
      ...nameBytes,
    );
  }

  const centralOffset = local.length;
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(centralOffset),
    ...u16(0),
  ];

  return new Uint8Array([...local, ...central, ...eocd]);
}

const SHARED = `<?xml version="1.0"?><sst><si><t>country</t></si><si><t>revenue</t></si><si><t>USA</t></si><si><t>Canada</t></si></sst>`;
const SHEET = `<?xml version="1.0"?><worksheet><sheetData>` +
  `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
  `<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>100</v></c></row>` +
  `<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><v>200</v></c></row>` +
  `</sheetData></worksheet>`;

describe('parseXlsx (zero-dependency reader)', () => {
  it('reads a stored (uncompressed) workbook', () => {
    const zip = makeZip([
      { name: 'xl/sharedStrings.xml', data: SHARED, method: 0 },
      { name: 'xl/worksheets/sheet1.xml', data: SHEET, method: 0 },
    ]);
    expect(parseXlsx(zip)).toEqual([
      { country: 'USA', revenue: 100 },
      { country: 'Canada', revenue: 200 },
    ]);
  });

  it('reads a DEFLATE-compressed workbook (exercises the inflate path)', () => {
    const zip = makeZip([
      { name: 'xl/sharedStrings.xml', data: SHARED, method: 8 },
      { name: 'xl/worksheets/sheet1.xml', data: SHEET, method: 8 },
    ]);
    expect(parseXlsx(zip)).toEqual([
      { country: 'USA', revenue: 100 },
      { country: 'Canada', revenue: 200 },
    ]);
  });

  it('handles inline strings and booleans', () => {
    const sheet = `<worksheet><sheetData>` +
      `<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>active</t></is></c></row>` +
      `<row r="2"><c r="A2" t="inlineStr"><is><t>Ann</t></is></c><c r="B2" t="b"><v>1</v></c></row>` +
      `</sheetData></worksheet>`;
    const zip = makeZip([{ name: 'xl/worksheets/sheet1.xml', data: sheet, method: 8 }]);
    expect(parseXlsx(zip)).toEqual([{ name: 'Ann', active: true }]);
  });

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const zip = makeZip([
      { name: 'xl/sharedStrings.xml', data: SHARED, method: 8 },
      { name: 'xl/worksheets/sheet1.xml', data: SHEET, method: 8 },
    ]);
    const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    expect(parseXlsx(ab)).toHaveLength(2);
  });

  it('throws on non-zip input', () => {
    expect(() => parseXlsx(new Uint8Array([1, 2, 3, 4]))).toThrow(/ZIP/i);
  });
});

describe('sheetToRecords', () => {
  it('uses the first row as the header by default', () => {
    expect(sheetToRecords([['a', 'b'], [1, 2]])).toEqual([{ a: 1, b: 2 }]);
  });
});
