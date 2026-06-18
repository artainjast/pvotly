import { describe, expect, it } from 'vitest';
import type { DataRecord } from '../types';
import { discoverFields, inferFieldType, normalizeValue } from './inferTypes';

/** Helper: wrap raw values for a single field into records. */
function recordsFor(field: string, values: unknown[]): DataRecord[] {
  return values.map((v) => ({ [field]: v as DataRecord[string] }));
}

describe('inferFieldType', () => {
  describe('number classification', () => {
    it('infers number when every value is a native number', () => {
      const recs = recordsFor('n', [1, 2, 3, 0, -5, 3.14]);
      expect(inferFieldType(recs, 'n')).toBe('number');
    });

    it('infers number when every value is a numeric string', () => {
      const recs = recordsFor('n', ['1', '2', '3.5', '-10', '+4', '1e3', '.5']);
      expect(inferFieldType(recs, 'n')).toBe('number');
    });

    it('infers number for a mix of native numbers and numeric strings', () => {
      const recs = recordsFor('n', [1, '2', 3, '4.0']);
      expect(inferFieldType(recs, 'n')).toBe('number');
    });

    it('does NOT treat a non-numeric string as number (falls back to string)', () => {
      const recs = recordsFor('n', [1, 2, 'abc']);
      expect(inferFieldType(recs, 'n')).toBe('string');
    });
  });

  describe('boolean classification', () => {
    it('infers boolean when every value is a native boolean', () => {
      const recs = recordsFor('b', [true, false, true]);
      expect(inferFieldType(recs, 'b')).toBe('boolean');
    });

    it('infers boolean for "true"/"false" strings (case-insensitive)', () => {
      const recs = recordsFor('b', ['true', 'false', 'TRUE', 'False', 'tRuE']);
      expect(inferFieldType(recs, 'b')).toBe('boolean');
    });

    it('infers boolean for a mix of native booleans and bool strings', () => {
      const recs = recordsFor('b', [true, 'false', false, 'TRUE']);
      expect(inferFieldType(recs, 'b')).toBe('boolean');
    });

    it('does NOT treat "yes"/"no" as boolean (falls back to string)', () => {
      const recs = recordsFor('b', ['yes', 'no']);
      expect(inferFieldType(recs, 'b')).toBe('string');
    });
  });

  describe('date / datetime classification', () => {
    it('infers date for ISO date-only strings', () => {
      const recs = recordsFor('d', ['2023-01-15', '2024-12-31', '2020-02-29']);
      expect(inferFieldType(recs, 'd')).toBe('date');
    });

    it('infers datetime when values carry a time component', () => {
      const recs = recordsFor('d', ['2023-01-15T10:30', '2024-12-31T23:59']);
      expect(inferFieldType(recs, 'd')).toBe('datetime');
    });

    it('infers datetime for "YYYY-MM-DD HH:MM" (space-separated) values', () => {
      const recs = recordsFor('d', ['2023-01-15 10:30', '2024-06-01 00:00']);
      expect(inferFieldType(recs, 'd')).toBe('datetime');
    });

    it('promotes the whole field to datetime when date and datetime values mix', () => {
      // datey === seen (all are date-ish) and at least one datetime present.
      const recs = recordsFor('d', ['2023-01-15', '2023-01-16T08:00']);
      expect(inferFieldType(recs, 'd')).toBe('datetime');
    });

    it('infers datetime for native Date objects', () => {
      const recs = recordsFor('d', [new Date('2023-01-15'), new Date('2024-06-01')]);
      expect(inferFieldType(recs, 'd')).toBe('datetime');
    });

    it('does NOT treat a non-ISO date layout (e.g. MM/DD/YYYY) as date', () => {
      // The classifier only recognizes the leading ^YYYY-MM-DD shape.
      const recs = recordsFor('d', ['01/15/2023', '12/31/2024']);
      expect(inferFieldType(recs, 'd')).toBe('string');
    });

    it('does NOT treat single-digit month/day ISO-ish strings as date', () => {
      // Regex requires two-digit month and day.
      const recs = recordsFor('d', ['2023-1-5', '2023-2-9']);
      expect(inferFieldType(recs, 'd')).toBe('string');
    });

    it('rejects a syntactically ISO but invalid calendar date', () => {
      // Matches the shape but toDate() returns null for an impossible date.
      const recs = recordsFor('d', ['2023-13-45']);
      expect(inferFieldType(recs, 'd')).toBe('string');
    });
  });

  describe('string fallback for mixed data', () => {
    it('falls back to string when types disagree (number + boolean)', () => {
      const recs = recordsFor('m', [1, 'true', 2]);
      expect(inferFieldType(recs, 'm')).toBe('string');
    });

    it('falls back to string when date and number mix', () => {
      const recs = recordsFor('m', ['2023-01-15', 42]);
      expect(inferFieldType(recs, 'm')).toBe('string');
    });

    it('infers string for plain text values', () => {
      const recs = recordsFor('s', ['USA', 'Canada', 'Germany']);
      expect(inferFieldType(recs, 's')).toBe('string');
    });
  });

  describe('blanks and empty handling', () => {
    it('ignores null/undefined/empty-string blanks when inferring number', () => {
      const recs = recordsFor('n', [null, '', undefined, 1, 2, '']);
      expect(inferFieldType(recs, 'n')).toBe('number');
    });

    it('ignores blanks when inferring date', () => {
      const recs = recordsFor('d', ['', '2023-01-15', null, '2024-06-01']);
      expect(inferFieldType(recs, 'd')).toBe('date');
    });

    it('returns string when all values are blank', () => {
      const recs = recordsFor('x', [null, '', undefined, '']);
      expect(inferFieldType(recs, 'x')).toBe('string');
    });

    it('returns string for an empty records array', () => {
      expect(inferFieldType([], 'anything')).toBe('string');
    });

    it('returns string when the field is absent from every record', () => {
      const recs: DataRecord[] = [{ other: 1 }, { other: 2 }];
      expect(inferFieldType(recs, 'missing')).toBe('string');
    });
  });

  describe('single-value fields', () => {
    it('infers number for a single numeric value', () => {
      expect(inferFieldType(recordsFor('n', [42]), 'n')).toBe('number');
    });

    it('infers boolean for a single boolean value', () => {
      expect(inferFieldType(recordsFor('b', [true]), 'b')).toBe('boolean');
    });

    it('infers date for a single ISO date string', () => {
      expect(inferFieldType(recordsFor('d', ['2023-01-15']), 'd')).toBe('date');
    });
  });

  describe('sampleSize behavior', () => {
    it('only samples the first N non-blank values', () => {
      // First two values are numbers; the disagreeing string sits beyond the
      // sample window, so the field still reads as number.
      const recs = recordsFor('n', [1, 2, 'abc', 'def']);
      expect(inferFieldType(recs, 'n', 2)).toBe('number');
    });

    it('does count beyond the window when sampleSize is large enough', () => {
      const recs = recordsFor('n', [1, 2, 'abc', 'def']);
      expect(inferFieldType(recs, 'n', 200)).toBe('string');
    });

    it('skips blanks without consuming the sample budget', () => {
      // sampleSize 2 but the first slots are blank; the two real numbers are
      // still reached because blanks do not increment the sample counter.
      const recs = recordsFor('n', [null, '', 1, 2]);
      expect(inferFieldType(recs, 'n', 2)).toBe('number');
    });
  });

  describe('fixture-derived inference', () => {
    it('classifies fixture fields correctly via discovered field names', async () => {
      const { SALES } = await import('../__fixtures__/sales');
      expect(inferFieldType(SALES, 'country')).toBe('string');
      expect(inferFieldType(SALES, 'category')).toBe('string');
      expect(inferFieldType(SALES, 'revenue')).toBe('number');
      expect(inferFieldType(SALES, 'units')).toBe('number');
      expect(inferFieldType(SALES, 'date')).toBe('date');
    });
  });
});

describe('normalizeValue', () => {
  describe('blanks', () => {
    it('maps null to null regardless of declared type', () => {
      expect(normalizeValue(null, 'number')).toBeNull();
      expect(normalizeValue(null, 'string')).toBeNull();
      expect(normalizeValue(null, 'date')).toBeNull();
    });

    it('maps undefined to null', () => {
      expect(normalizeValue(undefined, 'number')).toBeNull();
    });

    it('maps empty string to null (even for string type)', () => {
      expect(normalizeValue('', 'string')).toBeNull();
      expect(normalizeValue('', 'number')).toBeNull();
    });
  });

  describe('number type', () => {
    it('passes a native number through unchanged', () => {
      expect(normalizeValue(42, 'number')).toBe(42);
      expect(normalizeValue(-3.5, 'number')).toBe(-3.5);
      expect(normalizeValue(0, 'number')).toBe(0);
    });

    it('parses a numeric string into a number', () => {
      expect(normalizeValue('42', 'number')).toBe(42);
      expect(normalizeValue('3.14', 'number')).toBe(3.14);
      expect(normalizeValue('-7', 'number')).toBe(-7);
    });

    it('returns null for a non-numeric / non-finite string', () => {
      expect(normalizeValue('abc', 'number')).toBeNull();
      expect(normalizeValue('Infinity', 'number')).toBeNull();
      expect(normalizeValue('NaN', 'number')).toBeNull();
    });
  });

  describe('boolean type', () => {
    it('passes a native boolean through unchanged', () => {
      expect(normalizeValue(true, 'boolean')).toBe(true);
      expect(normalizeValue(false, 'boolean')).toBe(false);
    });

    it('parses "true"/"false" strings (case-insensitive) into booleans', () => {
      expect(normalizeValue('true', 'boolean')).toBe(true);
      expect(normalizeValue('TRUE', 'boolean')).toBe(true);
      expect(normalizeValue('false', 'boolean')).toBe(false);
      expect(normalizeValue('False', 'boolean')).toBe(false);
    });

    it('returns null for non-boolean strings', () => {
      expect(normalizeValue('yes', 'boolean')).toBeNull();
      expect(normalizeValue('1', 'boolean')).toBeNull();
    });
  });

  describe('date / datetime type', () => {
    it('parses an ISO date string into a Date', () => {
      const result = normalizeValue('2023-01-15', 'date');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(new Date('2023-01-15').getTime());
    });

    it('parses a datetime string into a Date for datetime type', () => {
      const result = normalizeValue('2023-01-15T10:30', 'datetime');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(new Date('2023-01-15T10:30').getTime());
    });

    it('passes a native Date through (returned as a valid Date)', () => {
      const d = new Date('2024-06-01');
      const result = normalizeValue(d, 'date');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(d.getTime());
    });

    it('returns null for an unparseable date string', () => {
      expect(normalizeValue('not-a-date', 'date')).toBeNull();
      expect(normalizeValue('2023-13-45', 'datetime')).toBeNull();
    });
  });

  describe('string type', () => {
    it('returns the value unchanged for string type', () => {
      expect(normalizeValue('hello', 'string')).toBe('hello');
    });

    it('does not coerce numbers/booleans when declared string', () => {
      expect(normalizeValue(42, 'string')).toBe(42);
      expect(normalizeValue(true, 'string')).toBe(true);
    });
  });
});

describe('discoverFields', () => {
  it('returns field names in first-seen order for uniform records', () => {
    const recs: DataRecord[] = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ];
    expect(discoverFields(recs)).toEqual(['a', 'b', 'c']);
  });

  it('unions keys across records, preserving first-seen order', () => {
    const recs: DataRecord[] = [
      { a: 1, b: 2 },
      { b: 3, c: 4 },
      { d: 5, a: 6 },
    ];
    // a,b from first record; c new from second; d new from third (a already seen).
    expect(discoverFields(recs)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not duplicate keys that recur across records', () => {
    const recs: DataRecord[] = [{ x: 1 }, { x: 2 }, { x: 3, y: 4 }, { y: 5 }];
    expect(discoverFields(recs)).toEqual(['x', 'y']);
  });

  it('uses the key order of each record as encountered', () => {
    // First record establishes b before a; subsequent reorders do not change it.
    const recs: DataRecord[] = [
      { b: 1, a: 2 },
      { a: 3, b: 4, c: 5 },
    ];
    expect(discoverFields(recs)).toEqual(['b', 'a', 'c']);
  });

  it('includes keys whose values are null/undefined (presence-based)', () => {
    const recs: DataRecord[] = [{ a: null, b: undefined }];
    expect(discoverFields(recs)).toEqual(['a', 'b']);
  });

  it('returns an empty array for no records', () => {
    expect(discoverFields([])).toEqual([]);
  });

  it('handles records with no own keys', () => {
    const recs: DataRecord[] = [{}, { a: 1 }, {}];
    expect(discoverFields(recs)).toEqual(['a']);
  });

  it('matches the fixture field set in declared order', async () => {
    const { SALES } = await import('../__fixtures__/sales');
    expect(discoverFields(SALES)).toEqual(['country', 'category', 'revenue', 'units', 'date']);
  });
});
