/**
 * Spreadsheet data sources for @pvotly/core.
 *
 * Two helpers:
 *  - {@link sheetToRecords} converts a plain array-of-arrays (a "matrix",
 *    typically with a header row) into `DataRecord[]`.
 *  - {@link parseXlsx} reads an `.xlsx` workbook (an `ArrayBuffer`/`Uint8Array`)
 *    into records using a tiny, self-contained ZIP + XML reader — NO third-party
 *    dependency. An `.xlsx` file is a ZIP of XML parts; we inflate the relevant
 *    parts ({@link ./zip}/{@link ./inflate}) and extract cell values.
 *
 * Limitations (best-effort reader): reads the FIRST worksheet only; ZIP64 and
 * encrypted workbooks are unsupported; dates stored as styled serial numbers
 * come through as their numeric serial (no style/number-format resolution).
 */

import type { DataRecord, DataValue } from '../types';
import { coerce } from './parseCSV';
import { unzip } from './zip';

/** Options controlling how a matrix is turned into records. */
export interface SheetToRecordsOptions {
  /**
   * Whether the first row holds column headers (default `true`). When `false`,
   * synthetic headers `column1`, `column2`, ... are generated.
   */
  header?: boolean;
}

/** Coerce a raw sheet cell to a typed primitive, leaving non-strings as-is. */
function coerceCell(value: unknown): DataValue {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return coerce(value, true);
  // Fallback for anything exotic a sheet parser might emit.
  return coerce(String(value), true);
}

/**
 * Convert an array-of-arrays (e.g. a parsed sheet) into an array of records.
 * By default the first row is treated as the header; pass `{ header: false }`
 * to generate synthetic `columnN` headers instead.
 */
export function sheetToRecords(rows: unknown[][], opts: SheetToRecordsOptions = {}): DataRecord[] {
  const header = opts.header ?? true;
  if (!rows.length) return [];

  let headers: string[];
  let startRow: number;
  if (header) {
    const headerRow = rows[0] ?? [];
    headers = headerRow.map((cell, idx) =>
      cell == null || cell === '' ? `column${idx + 1}` : String(cell),
    );
    startRow = 1;
  } else {
    // Header width is the widest row so no columns are lost.
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
    headers = Array.from({ length: width }, (_, idx) => `column${idx + 1}`);
    startRow = 0;
  }

  const records: DataRecord[] = [];
  for (let r = startRow; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    // Skip fully empty rows.
    if (cells.length === 0 || cells.every((c) => c == null || c === '')) continue;
    const record: DataRecord = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]!] = coerceCell(cells[c]);
    }
    records.push(record);
  }
  return records;
}

/* -------------------------------------------------------------------------- */
/* .xlsx (SpreadsheetML) reading                                              */
/* -------------------------------------------------------------------------- */

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

/** Decode the handful of XML entities used by SpreadsheetML text nodes. */
function decodeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (match) => {
    if (match[1] === '#') {
      const hex = match[2] === 'x' || match[2] === 'X';
      const code = parseInt(match.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[match] ?? match;
  });
}

/** Concatenate the text of every `<t>` node within an XML fragment. */
function extractText(fragment: string): string {
  let out = '';
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment))) out += decodeXml(m[1]!);
  return out;
}

/** Parse the shared-strings table into an ordered array. */
function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) strings.push(m[1] ? extractText(m[1]) : '');
  return strings;
}

/** Convert a cell reference column ("A", "B", "AA") into a 0-based index. */
function columnIndex(ref: string): number {
  let idx = 0;
  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i);
    if (code < 65 || code > 90) break; // stop at the row digits
    idx = idx * 26 + (code - 64);
  }
  return idx - 1;
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : undefined;
}

/** Parse a worksheet XML part into an array-of-arrays of typed values. */
function parseSheet(xml: string, shared: string[]): unknown[][] {
  const rows: unknown[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const inner = rowMatch[1] ?? '';
    const cells: unknown[] = [];
    let auto = 0;
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(inner))) {
      const attrs = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const ref = attr(attrs, 'r');
      const col = ref ? columnIndex(ref) : auto;
      auto = col + 1;
      const type = attr(attrs, 't');

      let value: unknown = null;
      if (type === 'inlineStr') {
        value = extractText(body);
      } else {
        const vm = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body);
        const raw = vm ? decodeXml(vm[1]!) : '';
        if (vm) {
          if (type === 's') {
            value = shared[Number(raw)] ?? '';
          } else if (type === 'b') {
            value = raw === '1';
          } else if (type === 'str') {
            value = raw;
          } else {
            // Numeric (t omitted or 'n').
            const num = Number(raw);
            value = Number.isFinite(num) ? num : raw;
          }
        }
      }
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** Pick the first worksheet part from the unzipped archive. */
function firstWorksheet(files: Map<string, Uint8Array>): Uint8Array | undefined {
  if (files.has('xl/worksheets/sheet1.xml')) return files.get('xl/worksheets/sheet1.xml');
  const names = [...files.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return names.length ? files.get(names[0]!) : undefined;
}

/**
 * Parse an `.xlsx` workbook (the first worksheet) into records, using a
 * built-in ZIP + XML reader with zero third-party dependencies.
 *
 * @param input the workbook bytes (`ArrayBuffer` or `Uint8Array`).
 * @returns the records of the first worksheet (first row treated as the header).
 * @throws if the bytes are not a valid `.xlsx`/ZIP archive.
 */
export function parseXlsx(input: ArrayBuffer | Uint8Array): DataRecord[] {
  const files = unzip(input);
  const decoder = new TextDecoder('utf-8');
  const sheetBytes = firstWorksheet(files);
  if (!sheetBytes) return [];

  const sharedBytes = files.get('xl/sharedStrings.xml');
  const shared = parseSharedStrings(sharedBytes ? decoder.decode(sharedBytes) : undefined);
  const rows = parseSheet(decoder.decode(sheetBytes), shared);
  return sheetToRecords(rows, { header: true });
}
