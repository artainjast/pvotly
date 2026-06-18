import type { CsvParseOptions, DataRecord, DataValue } from '../types';

const DEFAULTS: Required<Omit<CsvParseOptions, 'delimiter'>> & { delimiter: string } = {
  delimiter: ',',
  header: true,
  quote: '"',
  trim: true,
  dynamicTyping: true,
};

/**
 * Parse CSV text into rows of string cells. Handles quoted fields, escaped
 * quotes (`""`), and embedded newlines/delimiters inside quotes.
 */
export function parseCsvToMatrix(text: string, options: CsvParseOptions = {}): string[][] {
  const { delimiter, quote } = { ...DEFAULTS, ...options };
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === quote) {
        if (text[i + 1] === quote) {
          field += quote;
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === quote) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Normalize CRLF / CR.
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush trailing field/row unless the file ended on a newline with no data.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows;
}

/** Coerce a raw CSV string cell into a typed primitive when enabled. */
export function coerce(raw: string, dynamicTyping: boolean): DataValue {
  if (!dynamicTyping) return raw;
  if (raw === '') return null;
  const lower = raw.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return null;
  // Numbers (allow leading +/-, decimals, exponent). Reject things like "1,234".
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

/** Parse CSV text into an array of record objects. */
export function parseCsv(text: string, options: CsvParseOptions = {}): DataRecord[] {
  const opts = { ...DEFAULTS, ...options };
  const matrix = parseCsvToMatrix(text, opts);
  if (!matrix.length) return [];

  const maybeTrim = (s: string) => (opts.trim ? s.trim() : s);

  let headers: string[];
  let startRow: number;
  if (opts.header) {
    headers = matrix[0]!.map(maybeTrim);
    startRow = 1;
  } else {
    headers = matrix[0]!.map((_, idx) => `column${idx + 1}`);
    startRow = 0;
  }

  const records: DataRecord[] = [];
  for (let r = startRow; r < matrix.length; r++) {
    const cells = matrix[r]!;
    // Skip fully empty trailing lines.
    if (cells.length === 1 && cells[0] === '') continue;
    const record: DataRecord = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]!;
      const value = maybeTrim(cells[c] ?? '');
      record[key] = coerce(value, opts.dynamicTyping);
    }
    records.push(record);
  }
  return records;
}
