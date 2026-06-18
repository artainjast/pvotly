import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import { parseXlsx } from '@pvotly/core';
import type { DataRecord, Slice } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'xlsx',
  title: 'Excel (.xlsx) import',
  description:
    'parseXlsx(ArrayBuffer) reads an .xlsx workbook (first worksheet) into records using a built-in, dependency-free ZIP + XML reader — no SheetJS required. Pick any .xlsx file to pivot it instantly, or load the built-in sample workbook (generated in-browser and round-tripped through parseXlsx). Columns are typed automatically and the slice is inferred from the data.',
  group: 'Data sources',
  code: `import { PivotTable } from '@pvotly/react';
import { parseXlsx } from '@pvotly/core';
import '@pvotly/web/styles.css';

async function onFile(file: File) {
  const buffer = await file.arrayBuffer();
  const records = parseXlsx(buffer); // first worksheet -> DataRecord[]
  setData(records);
}

<input type="file" accept=".xlsx" onChange={(e) => onFile(e.target.files![0])} />
<PivotTable dataSource={{ data }} slice={slice} />`,
};

/* ---- A tiny .xlsx writer (stored ZIP) so the sample works offline -------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function columnLetter(index: number): string {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
}

function sheetXml(rows: Array<Array<string | number>>): string {
  const body = rows
    .map((cells, r) => {
      const tags = cells
        .map((cell, c) => {
          const ref = `${columnLetter(c)}${r + 1}`;
          if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(cell))}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${tags}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

/** Build a minimal single-entry ZIP (stored) holding the worksheet part. */
function buildXlsx(rows: Array<Array<string | number>>): Uint8Array {
  const enc = new TextEncoder();
  const name = enc.encode('xl/worksheets/sheet1.xml');
  const data = enc.encode(sheetXml(rows));
  const crc = crc32(data);
  const n = data.length;

  const local = new Uint8Array(30 + name.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(6, 0, true);
  lv.setUint16(8, 0, true); // stored
  lv.setUint32(14, crc, true);
  lv.setUint32(18, n, true);
  lv.setUint32(22, n, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(10, 0, true); // stored
  cv.setUint32(16, crc, true);
  cv.setUint32(20, n, true);
  cv.setUint32(24, n, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, 0, true); // local header offset
  central.set(name, 46);

  const localBlock = local.length + n;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, localBlock, true);

  const out = new Uint8Array(localBlock + central.length + eocd.length);
  out.set(local, 0);
  out.set(data, local.length);
  out.set(central, localBlock);
  out.set(eocd, localBlock + central.length);
  return out;
}

const SAMPLE_ROWS: Array<Array<string | number>> = [
  ['country', 'category', 'channel', 'units', 'revenue'],
  ['USA', 'Cars', 'Online', 4, 48000],
  ['USA', 'Bikes', 'Retail', 12, 3600],
  ['Canada', 'Cars', 'Online', 3, 27000],
  ['Canada', 'Accessories', 'Retail', 40, 2000],
  ['Germany', 'Cars', 'Retail', 2, 22000],
  ['Germany', 'Bikes', 'Online', 9, 2700],
  ['France', 'Accessories', 'Online', 30, 1500],
  ['France', 'Cars', 'Retail', 5, 41000],
];

/* ---- Slice inference from arbitrary records ------------------------------ */

function inferSlice(records: DataRecord[]): Slice {
  const first = records[0] ?? {};
  const keys = Object.keys(first);
  const numeric = keys.filter((k) => typeof first[k] === 'number');
  const dims = keys.filter((k) => !numeric.includes(k));
  return {
    rows: dims[0] ? [{ uniqueName: dims[0] }] : [],
    columns: dims[1] ? [{ uniqueName: dims[1] }] : [],
    measures: (numeric.length ? numeric : keys.slice(0, 1)).map((uniqueName) => ({
      uniqueName,
      aggregation: 'sum' as const,
    })),
  };
}

export default function Xlsx() {
  const [records, setRecords] = useState<DataRecord[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const slice = useMemo(() => (records ? inferSlice(records) : null), [records]);

  const handleFile = async (file: File) => {
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseXlsx(buffer);
      setRecords(parsed);
      setFileName(`${file.name} (${parsed.length} rows)`);
    } catch (err) {
      setError(`Could not parse: ${(err as Error).message}`);
    }
  };

  const loadSample = () => {
    setError('');
    const bytes = buildXlsx(SAMPLE_ROWS);
    const parsed = parseXlsx(bytes);
    setRecords(parsed);
    setFileName(`sample.xlsx (${parsed.length} rows)`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={loadSample}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          Load sample workbook
        </button>
        {fileName && <span style={{ opacity: 0.7 }}>Imported: {fileName}</span>}
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>}

      {records && slice ? (
        <PivotTable height={420} dataSource={{ data: records }} slice={slice} />
      ) : (
        <div
          style={{
            padding: '40px 16px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
            borderRadius: 8,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          Choose an .xlsx file or click “Load sample workbook” to pivot a spreadsheet.
        </div>
      )}
    </div>
  );
}
