import type { DataRecord, DataValue, FieldType } from '../types';
import { toDate } from '../engine/dateParts';

/** Classify a single value. Returns null for blanks (ignored when inferring). */
function classify(value: DataValue): FieldType | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'datetime';
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'false') return 'boolean';
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value)) return 'number';
    // ISO-ish date detection — avoid treating arbitrary strings as dates.
    if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(value) && toDate(value)) {
      return /\d{2}:\d{2}/.test(value) ? 'datetime' : 'date';
    }
  }
  return 'string';
}

/**
 * Infer the dominant type of a field by sampling its values across records.
 * Numbers/dates only "win" when every non-blank value agrees; otherwise the
 * field falls back to string to stay safe.
 */
export function inferFieldType(records: DataRecord[], field: string, sampleSize = 200): FieldType {
  const counts: Partial<Record<FieldType, number>> = {};
  let seen = 0;
  for (let i = 0; i < records.length && seen < sampleSize; i++) {
    const t = classify(records[i]![field]);
    if (t === null) continue;
    counts[t] = (counts[t] ?? 0) + 1;
    seen += 1;
  }
  if (seen === 0) return 'string';

  const datey = (counts.date ?? 0) + (counts.datetime ?? 0);
  if (datey === seen) return (counts.datetime ?? 0) > 0 ? 'datetime' : 'date';
  if ((counts.number ?? 0) === seen) return 'number';
  if ((counts.boolean ?? 0) === seen) return 'boolean';
  return 'string';
}

/** Normalize a raw value to its declared type (used after inference). */
export function normalizeValue(value: DataValue, type: FieldType): DataValue {
  if (value == null || value === '') return null;
  switch (type) {
    case 'number': {
      if (typeof value === 'number') return value;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const s = String(value).toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      return null;
    }
    case 'date':
    case 'datetime': {
      return toDate(value);
    }
    default:
      return value;
  }
}

/** Discover the set of field names across a record array, preserving first-seen order. */
export function discoverFields(records: DataRecord[]): string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        fields.push(key);
      }
    }
  }
  return fields;
}
