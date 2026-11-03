import type {
  AggregationType,
  DataRecord,
  DataSourceConfig,
  DataValue,
  DatePart,
  FieldMapping,
  FieldType,
} from '../types';
import { datePartCaption, datePartValue, toDate } from '../engine/dateParts';
import { asNumber } from '../engine/aggregate';
import { parseCsv } from './parseCSV';
import { discoverFields, inferFieldType, normalizeValue } from './inferTypes';

const DATE_PARTS: DatePart[] = [
  'year',
  'quarter',
  'month',
  'monthName',
  'week',
  'dayOfMonth',
  'weekday',
  'date',
  'hour',
  'minute',
  'second',
];
const DATE_PART_SET = new Set<string>(DATE_PARTS);

export interface FieldInfo {
  /** Identity used by the slice config: base field, or `field.part`. */
  uniqueName: string;
  /** Underlying source field name. */
  field: string;
  /** Date part, when this is a derived date field. */
  part?: DatePart;
  caption: string;
  type: FieldType;
  /** Numeric field usable on the Values axis. */
  isMeasure: boolean;
  /** Usable as a row/column/filter dimension. */
  isDimension: boolean;
  /** For a base date field: the parts it can expand into. */
  dateParts?: DatePart[];
  /** Default aggregation when dropped into Values. */
  aggregation?: AggregationType;
  /** Default number-format name. */
  format?: string;
}

interface ParsedName {
  field: string;
  part?: DatePart;
}

/**
 * Dictionary-encoded column: `values[codes[i]]` is the resolved value of a field
 * for record `i`. Values are distinct members in first-seen order; two values
 * share a code exactly when they are the same member (same type and value, Dates
 * by timestamp).
 */
export interface EncodedColumn {
  codes: Int32Array;
  values: DataValue[];
}

/**
 * Normalized, queryable view over a data source. Owns type inference, value
 * normalization, date-part resolution, member enumeration and captions.
 */
export class Dataset {
  readonly records: DataRecord[];
  private readonly mapping: Record<string, FieldMapping>;
  private readonly types = new Map<string, FieldType>();
  private readonly fieldOrder: string[];
  private readonly memberCache = new Map<string, DataValue[]>();
  // Per-field caches. Records are never mutated after construction, so these
  // stay valid for the life of the dataset.
  private readonly nameCache = new Map<string, Readonly<ParsedName>>();
  private readonly valueCache = new Map<string, DataValue[]>();
  private readonly encodedCache = new Map<string, EncodedColumn>();
  private readonly numberCache = new Map<string, Float64Array>();

  constructor(config: DataSourceConfig) {
    this.mapping = config.mapping ?? {};
    const raw = Dataset.extractRecords(config);
    this.fieldOrder = discoverFields(raw);

    // Resolve a type per field (mapping override wins over inference).
    for (const field of this.fieldOrder) {
      const override = this.mapping[field]?.type;
      this.types.set(field, override ?? inferFieldType(raw, field));
    }

    // Normalize every value to its resolved type once, up front.
    this.records = raw.map((record) => {
      const out: DataRecord = {};
      for (const field of this.fieldOrder) {
        out[field] = normalizeValue(record[field], this.types.get(field)!);
      }
      return out;
    });
  }

  private static extractRecords(config: DataSourceConfig): DataRecord[] {
    if (config.data) return config.data;
    if (config.csv != null) return parseCsv(config.csv, config.csvOptions);
    if (config.matrix && config.matrix.length) {
      const [header, ...rows] = config.matrix;
      const keys = header!.map((h) => String(h));
      return rows.map((row) => {
        const rec: DataRecord = {};
        keys.forEach((k, i) => {
          rec[k] = row[i] ?? null;
        });
        return rec;
      });
    }
    return [];
  }

  /** Split `field.part` into its components, validating the part. */
  parseName(uniqueName: string): ParsedName {
    let parsed = this.nameCache.get(uniqueName);
    if (!parsed) {
      parsed = Object.freeze(this.parseNameUncached(uniqueName));
      this.nameCache.set(uniqueName, parsed);
    }
    return parsed;
  }

  private parseNameUncached(uniqueName: string): ParsedName {
    const dot = uniqueName.lastIndexOf('.');
    if (dot > 0) {
      const maybePart = uniqueName.slice(dot + 1);
      const base = uniqueName.slice(0, dot);
      if (DATE_PART_SET.has(maybePart) && this.types.has(base)) {
        return { field: base, part: maybePart as DatePart };
      }
    }
    return { field: uniqueName };
  }

  fieldType(field: string): FieldType {
    return this.types.get(field) ?? 'string';
  }

  /** Resolve the value of a (possibly derived) field for one record. */
  resolveValue(record: DataRecord, uniqueName: string): DataValue {
    const { field, part } = this.parseName(uniqueName);
    const raw = record[field];
    if (part) {
      const d = toDate(raw);
      return d ? datePartValue(d, part) : null;
    }
    return raw ?? null;
  }

  /** Display caption for a member value of a given field. */
  memberCaption(uniqueName: string, value: DataValue): string {
    const { part } = this.parseName(uniqueName);
    if (value == null) return this.mapping[uniqueName]?.caption ? '' : '(blank)';
    if (part) return datePartCaption(value, part);
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  /** Caption for the field itself (header label). */
  fieldCaption(uniqueName: string): string {
    const explicit = this.mapping[uniqueName]?.caption;
    if (explicit) return explicit;
    const { field, part } = this.parseName(uniqueName);
    const baseCaption = this.mapping[field]?.caption ?? field;
    if (part) {
      const partLabel = part.charAt(0).toUpperCase() + part.slice(1);
      return `${baseCaption} (${partLabel})`;
    }
    return baseCaption;
  }

  /** Call `visit` with the resolved value of a (possibly derived) field for every record. */
  private resolveAll(uniqueName: string, visit: (value: DataValue, index: number) => void): void {
    const cached = this.valueCache.get(uniqueName);
    if (cached) {
      for (let i = 0; i < cached.length; i++) visit(cached[i]!, i);
      return;
    }
    const { field, part } = this.parseName(uniqueName);
    const records = this.records;
    for (let i = 0; i < records.length; i++) {
      const raw = records[i]![field];
      if (part) {
        const d = toDate(raw);
        visit(d ? datePartValue(d, part) : null, i);
      } else {
        visit(raw ?? null, i);
      }
    }
  }

  /** Resolved value of a (possibly derived) field for every record, computed once. */
  values(uniqueName: string): DataValue[] {
    let column = this.valueCache.get(uniqueName);
    if (!column) {
      const out = new Array<DataValue>(this.records.length);
      this.resolveAll(uniqueName, (v, i) => {
        out[i] = v;
      });
      column = out;
      this.valueCache.set(uniqueName, column);
    }
    return column;
  }

  /** Dictionary-encoded view of a field (see {@link EncodedColumn}), computed once. */
  encoded(uniqueName: string): EncodedColumn {
    let column = this.encodedCache.get(uniqueName);
    if (!column) {
      const codes = new Int32Array(this.records.length);
      const dictionary: DataValue[] = [];
      // Dates are keyed by timestamp in their own map so they never collide with numbers.
      const byValue = new Map<DataValue, number>();
      const byTime = new Map<number, number>();
      this.resolveAll(uniqueName, (v, i) => {
        const isDate = v instanceof Date;
        const index = (isDate ? byTime : byValue) as Map<unknown, number>;
        const key = isDate ? v.getTime() : v;
        let code = index.get(key);
        if (code === undefined) {
          code = dictionary.length;
          dictionary.push(v);
          index.set(key, code);
        }
        codes[i] = code;
      });
      column = { codes, values: dictionary };
      this.encodedCache.set(uniqueName, column);
    }
    return column;
  }

  /**
   * Numeric view of a field for the built-in numeric reducers: the value each
   * record contributes, or `NaN` where it contributes nothing (null, blank,
   * non-numeric, non-finite).
   */
  numbers(uniqueName: string): Float64Array {
    let column = this.numberCache.get(uniqueName);
    if (!column) {
      const out = new Float64Array(this.records.length);
      this.resolveAll(uniqueName, (v, i) => {
        out[i] = asNumber(v) ?? NaN;
      });
      column = out;
      this.numberCache.set(uniqueName, column);
    }
    return column;
  }

  /** Distinct, sorted member values for a field. */
  getMembers(uniqueName: string): DataValue[] {
    if (this.memberCache.has(uniqueName)) return this.memberCache.get(uniqueName)!;
    const members = [...this.encoded(uniqueName).values].sort(compareValues);
    this.memberCache.set(uniqueName, members);
    return members;
  }

  /** Field-list metadata for every available (and derived) field. */
  listFields(): FieldInfo[] {
    const out: FieldInfo[] = [];
    for (const field of this.fieldOrder) {
      const mapping = this.mapping[field];
      if (mapping?.visible === false) continue;
      const type = this.types.get(field)!;
      const isNumber = type === 'number';
      const baseInfo: FieldInfo = {
        uniqueName: field,
        field,
        caption: this.fieldCaption(field),
        type,
        isMeasure: mapping?.isMeasure ?? isNumber,
        isDimension: !(mapping?.isMeasure === true),
        dateParts: undefined,
        aggregation: mapping?.aggregation,
        format: mapping?.format,
      };
      if ((type === 'date' || type === 'datetime') && mapping?.dateParts?.length) {
        baseInfo.dateParts = mapping.dateParts;
        out.push(baseInfo);
        for (const part of mapping.dateParts) {
          const uniqueName = `${field}.${part}`;
          out.push({
            uniqueName,
            field,
            part,
            caption: this.fieldCaption(uniqueName),
            type: part === 'monthName' || part === 'date' ? 'string' : 'number',
            isMeasure: false,
            isDimension: true,
          });
        }
      } else {
        out.push(baseInfo);
      }
    }
    return out;
  }

  get fields(): string[] {
    return [...this.fieldOrder];
  }
}

// Same ordering as `localeCompare(b, undefined, options)`, without building a
// collator on every comparison.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Total ordering across mixed primitive/date values (nulls last). */
export function compareValues(a: DataValue, b: DataValue): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  if (typeof av === 'boolean' && typeof bv === 'boolean') return av === bv ? 0 : av ? 1 : -1;
  return collator.compare(String(av), String(bv));
}
