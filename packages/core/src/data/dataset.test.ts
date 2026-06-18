import { describe, it, expect } from 'vitest';
import { Dataset, compareValues } from './dataset';
import { toDate, datePartValue } from '../engine/dateParts';
import { SALES } from '../__fixtures__/sales';
import type { DataValue } from '../types';

describe('Dataset construction & source extraction', () => {
  it('builds from in-memory {data} records', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.records).toHaveLength(SALES.length);
    expect(ds.fields).toEqual(['country', 'category', 'revenue', 'units', 'date']);
  });

  it('builds from {matrix} (first row = header)', () => {
    const ds = new Dataset({
      matrix: [
        ['country', 'revenue'],
        ['USA', 100],
        ['Canada', 300],
      ],
    });
    expect(ds.fields).toEqual(['country', 'revenue']);
    expect(ds.records).toHaveLength(2);
    expect(ds.records[0]).toEqual({ country: 'USA', revenue: 100 });
    expect(ds.records[1]).toEqual({ country: 'Canada', revenue: 300 });
  });

  it('fills missing matrix cells with null', () => {
    const ds = new Dataset({
      matrix: [
        ['a', 'b'],
        ['x'], // row shorter than header
      ],
    });
    // 'a' inferred as string ('x'); 'b' has no non-blank value -> string, null stays null.
    expect(ds.records[0]).toEqual({ a: 'x', b: null });
  });

  it('builds from {csv} text with dynamic typing', () => {
    const csv = 'country,revenue,active\nUSA,100,true\nCanada,300,false';
    const ds = new Dataset({ csv });
    expect(ds.fields).toEqual(['country', 'revenue', 'active']);
    expect(ds.fieldType('country')).toBe('string');
    expect(ds.fieldType('revenue')).toBe('number');
    expect(ds.fieldType('active')).toBe('boolean');
    expect(ds.records[0]).toEqual({ country: 'USA', revenue: 100, active: true });
    expect(ds.records[1]).toEqual({ country: 'Canada', revenue: 300, active: false });
  });

  it('returns an empty dataset when no source is given', () => {
    const ds = new Dataset({});
    expect(ds.records).toEqual([]);
    expect(ds.fields).toEqual([]);
    expect(ds.fieldType('anything')).toBe('string');
    expect(ds.getMembers('anything')).toEqual([]);
    expect(ds.listFields()).toEqual([]);
  });

  it('handles an empty matrix', () => {
    const ds = new Dataset({ matrix: [] });
    expect(ds.records).toEqual([]);
    expect(ds.fields).toEqual([]);
  });

  it('discovers fields across heterogeneous records preserving first-seen order', () => {
    const ds = new Dataset({
      data: [
        { a: 1, b: 2 },
        { c: 3, a: 4 },
      ],
    });
    expect(ds.fields).toEqual(['a', 'b', 'c']);
    // Missing keys normalize to null.
    expect(ds.records[0]).toEqual({ a: 1, b: 2, c: null });
    expect(ds.records[1]).toEqual({ a: 4, b: null, c: 3 });
  });
});

describe('Dataset type inference', () => {
  it('infers number / string / date from the SALES fixture', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.fieldType('country')).toBe('string');
    expect(ds.fieldType('category')).toBe('string');
    expect(ds.fieldType('revenue')).toBe('number');
    expect(ds.fieldType('units')).toBe('number');
    // 'date' strings are pure dates (no time) -> 'date'.
    expect(ds.fieldType('date')).toBe('date');
  });

  it('infers datetime when a time component is present', () => {
    const ds = new Dataset({
      data: [{ ts: '2023-01-15 10:30' }, { ts: '2023-02-20 08:00' }],
    });
    expect(ds.fieldType('ts')).toBe('datetime');
  });

  it('falls back to string when types are mixed', () => {
    const ds = new Dataset({ data: [{ v: 1 }, { v: 'hello' }, { v: 3 }] });
    expect(ds.fieldType('v')).toBe('string');
  });

  it('a field that is entirely blank/null infers as string', () => {
    const ds = new Dataset({ data: [{ x: null }, { x: '' }, { x: null }] });
    expect(ds.fieldType('x')).toBe('string');
  });

  it('infers boolean when every non-blank value is boolean-like', () => {
    const ds = new Dataset({ data: [{ b: true }, { b: false }, { b: null }] });
    expect(ds.fieldType('b')).toBe('boolean');
  });

  it('infers number from numeric strings', () => {
    const ds = new Dataset({ data: [{ n: '1.5' }, { n: '-2' }, { n: '3e2' }] });
    expect(ds.fieldType('n')).toBe('number');
  });
});

describe('Dataset value normalization', () => {
  it('normalizes numeric strings to numbers', () => {
    const ds = new Dataset({ data: [{ n: '42' }, { n: '3.5' }] });
    expect(ds.records[0]!.n).toBe(42);
    expect(ds.records[1]!.n).toBe(3.5);
  });

  it('normalizes date strings to Date instances', () => {
    const ds = new Dataset({ data: SALES });
    const first = ds.records[0]!.date;
    expect(first).toBeInstanceOf(Date);
    expect((first as Date).getTime()).toBe(toDate('2023-01-15')!.getTime());
  });

  it('normalizes boolean-like strings to booleans', () => {
    const ds = new Dataset({ data: [{ b: 'true' }, { b: 'false' }, { b: 'TRUE' }] });
    expect(ds.records[0]!.b).toBe(true);
    expect(ds.records[1]!.b).toBe(false);
    expect(ds.records[2]!.b).toBe(true);
  });

  it('coerces empty string and null to null', () => {
    const ds = new Dataset({ data: [{ s: '', n: null }] });
    expect(ds.records[0]!.s).toBeNull();
    expect(ds.records[0]!.n).toBeNull();
  });

  it('non-finite numeric values normalize to null under a number-typed field', () => {
    // Mapping forces type 'number'; 'abc' isn't finite -> null.
    const ds = new Dataset({
      data: [{ n: 10 }, { n: 'abc' }],
      mapping: { n: { type: 'number' } },
    });
    expect(ds.records[0]!.n).toBe(10);
    expect(ds.records[1]!.n).toBeNull();
  });

  it('invalid date string normalizes to null under a date-typed field', () => {
    const ds = new Dataset({
      data: [{ d: '2023-01-15' }, { d: 'not-a-date' }],
      mapping: { d: { type: 'date' } },
    });
    expect(ds.records[0]!.d).toBeInstanceOf(Date);
    expect(ds.records[1]!.d).toBeNull();
  });
});

describe('Dataset.getMembers — distinct, sorted, nulls last', () => {
  it('returns distinct members sorted ascending', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.getMembers('country')).toEqual(['Canada', 'USA']);
    expect(ds.getMembers('category')).toEqual(['Bikes', 'Cars']);
  });

  it('sorts numeric members numerically (not lexically)', () => {
    const ds = new Dataset({ data: [{ n: 10 }, { n: 2 }, { n: 100 }, { n: 9 }] });
    expect(ds.getMembers('n')).toEqual([2, 9, 10, 100]);
  });

  it('places null/blank members last', () => {
    const ds = new Dataset({
      data: [{ c: 'b' }, { c: null }, { c: 'a' }, { c: '' }],
    });
    // '' normalizes to null; both null entries collapse into a single member.
    expect(ds.getMembers('c')).toEqual(['a', 'b', null]);
  });

  it('deduplicates Date members by timestamp and orders chronologically', () => {
    const ds = new Dataset({ data: SALES });
    const members = ds.getMembers('date') as Date[];
    // Six rows, all distinct dates.
    expect(members).toHaveLength(6);
    expect(members.every((d) => d instanceof Date)).toBe(true);
    // Chronological order.
    const times = members.map((d) => d.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(members[0]!.getTime()).toBe(toDate('2023-01-15')!.getTime());
    expect(members[members.length - 1]!.getTime()).toBe(toDate('2024-02-18')!.getTime());
  });

  it('returns a single member for a single repeated value', () => {
    const ds = new Dataset({ data: [{ c: 'x' }, { c: 'x' }, { c: 'x' }] });
    expect(ds.getMembers('c')).toEqual(['x']);
  });

  it('caches members across repeated calls (identity stable)', () => {
    const ds = new Dataset({ data: SALES });
    const a = ds.getMembers('country');
    const b = ds.getMembers('country');
    expect(a).toBe(b);
  });

  it('returns date-part members for a derived field', () => {
    const ds = new Dataset({ data: SALES });
    // year part -> distinct sorted years.
    expect(ds.getMembers('date.year')).toEqual([2023, 2024]);
    // month part -> distinct sorted month numbers (compute from fixture dates).
    const expectedMonths = Array.from(
      new Set(SALES.map((r) => datePartValue(toDate(r.date as string)!, 'month') as number))
    ).sort((a, b) => a - b);
    expect(ds.getMembers('date.month')).toEqual(expectedMonths);
  });
});

describe('Dataset.resolveValue', () => {
  it('resolves a base field value', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.resolveValue(ds.records[0]!, 'country')).toBe('USA');
    expect(ds.resolveValue(ds.records[0]!, 'revenue')).toBe(100);
  });

  it('resolves a date-part field (date.month / date.year)', () => {
    const ds = new Dataset({ data: SALES });
    const rec = ds.records[0]!;
    const d = rec.date as Date;
    expect(ds.resolveValue(rec, 'date.year')).toBe(d.getFullYear());
    expect(ds.resolveValue(rec, 'date.month')).toBe(d.getMonth() + 1);
    expect(ds.resolveValue(rec, 'date.quarter')).toBe(Math.floor(d.getMonth() / 3) + 1);
  });

  it('returns null when the underlying value is missing', () => {
    const ds = new Dataset({ data: [{ a: 1 }] });
    expect(ds.resolveValue(ds.records[0]!, 'missing')).toBeNull();
  });

  it('returns null for a date-part on a null/undated record', () => {
    const ds = new Dataset({
      data: [{ date: '2023-01-15' }, { date: null }],
      mapping: { date: { type: 'date' } },
    });
    expect(ds.resolveValue(ds.records[1]!, 'date.month')).toBeNull();
  });

  it('treats an unknown dotted name as a plain field, not a date part', () => {
    // 'a.b' where 'b' is not a valid part and 'a' isn't a known field.
    const ds = new Dataset({ data: [{ 'a.b': 7 }] });
    expect(ds.parseName('a.b')).toEqual({ field: 'a.b' });
    expect(ds.resolveValue(ds.records[0]!, 'a.b')).toBe(7);
  });
});

describe('Dataset.parseName', () => {
  it('splits a valid field.part', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.parseName('date.month')).toEqual({ field: 'date', part: 'month' });
  });

  it('does not split when the part token is not a known DatePart', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.parseName('date.bogus')).toEqual({ field: 'date.bogus' });
  });

  it('does not split when the base field is unknown', () => {
    const ds = new Dataset({ data: SALES });
    // 'month' is a valid part, but 'nope' isn't a known field.
    expect(ds.parseName('nope.month')).toEqual({ field: 'nope.month' });
  });

  it('treats a leading-dot name as a plain field (dot at index 0)', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.parseName('.month')).toEqual({ field: '.month' });
  });
});

describe('Dataset.memberCaption', () => {
  it('captions plain string members as themselves', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.memberCaption('country', 'USA')).toBe('USA');
  });

  it('captions numeric members via String()', () => {
    const ds = new Dataset({ data: [{ n: 42 }] });
    expect(ds.memberCaption('n', 42)).toBe('42');
  });

  it('captions a null member as "(blank)" when no caption mapping exists', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.memberCaption('country', null)).toBe('(blank)');
  });

  it('captions a Date member via toLocaleDateString', () => {
    const ds = new Dataset({ data: SALES });
    const d = ds.records[0]!.date as Date;
    expect(ds.memberCaption('date', d)).toBe(d.toLocaleDateString());
  });

  it('captions date-part members using datePartCaption (quarter/month/weekday)', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.memberCaption('date.quarter', 1)).toBe('Q1');
    expect(ds.memberCaption('date.month', 1)).toBe('January');
    expect(ds.memberCaption('date.month', 3)).toBe('March');
    // weekday 0 -> Sunday.
    expect(ds.memberCaption('date.weekday', 0)).toBe('Sunday');
  });

  it('renders a null member as "" when the field has a caption mapping', () => {
    // Documents the actual (quirky) behavior: a configured caption makes blanks empty.
    const ds = new Dataset({
      data: [{ country: 'USA' }, { country: null }],
      mapping: { country: { caption: 'Nation' } },
    });
    expect(ds.memberCaption('country', null)).toBe('');
  });
});

describe('Dataset.fieldCaption', () => {
  it('defaults to the field name', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.fieldCaption('country')).toBe('country');
  });

  it('uses an explicit caption override', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { country: { caption: 'Nation' } },
    });
    expect(ds.fieldCaption('country')).toBe('Nation');
  });

  it('builds a "(Part)" caption for a derived date-part field', () => {
    const ds = new Dataset({ data: SALES });
    expect(ds.fieldCaption('date.month')).toBe('date (Month)');
    expect(ds.fieldCaption('date.year')).toBe('date (Year)');
  });

  it('uses the base caption inside a date-part caption', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { date: { caption: 'Order Date' } },
    });
    expect(ds.fieldCaption('date.month')).toBe('Order Date (Month)');
  });

  it('an explicit caption on the dotted name itself wins outright', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { 'date.month': { caption: 'Sales Month' } },
    });
    expect(ds.fieldCaption('date.month')).toBe('Sales Month');
  });
});

describe('Dataset.listFields', () => {
  it('lists every field with inferred metadata', () => {
    const ds = new Dataset({ data: SALES });
    const fields = ds.listFields();
    const byName = Object.fromEntries(fields.map((f) => [f.uniqueName, f]));

    expect(fields.map((f) => f.uniqueName)).toEqual([
      'country',
      'category',
      'revenue',
      'units',
      'date',
    ]);

    // String dims are dimensions, not measures.
    expect(byName.country).toMatchObject({
      type: 'string',
      isMeasure: false,
      isDimension: true,
    });
    // Numbers default to measures (and are still dimensions).
    expect(byName.revenue).toMatchObject({
      type: 'number',
      isMeasure: true,
      isDimension: true,
    });
    // No dateParts mapping -> no derived fields, dateParts undefined.
    expect(byName.date!.dateParts).toBeUndefined();
  });

  it('emits derived date-part fields when mapping.dateParts is set', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { date: { dateParts: ['year', 'month', 'monthName'] } },
    });
    const names = ds.listFields().map((f) => f.uniqueName);
    expect(names).toEqual([
      'country',
      'category',
      'revenue',
      'units',
      'date',
      'date.year',
      'date.month',
      'date.monthName',
    ]);

    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    // Base date field advertises its parts.
    expect(byName.date!.dateParts).toEqual(['year', 'month', 'monthName']);

    // Numeric parts -> type 'number'; monthName -> type 'string'.
    expect(byName['date.year']).toMatchObject({
      field: 'date',
      part: 'year',
      type: 'number',
      isMeasure: false,
      isDimension: true,
    });
    expect(byName['date.month']!.type).toBe('number');
    expect(byName['date.monthName']!.type).toBe('string');
    // 'date' part (string token) would also be a string type.
  });

  it("treats the 'date' part token as a string-typed derived field", () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { date: { dateParts: ['date'] } },
    });
    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    expect(byName['date.date']!.type).toBe('string');
  });

  it('does not emit date parts for a non-date field even if dateParts is set', () => {
    const ds = new Dataset({
      data: SALES,
      // country is a string; dateParts should be ignored.
      mapping: { country: { dateParts: ['year'] } },
    });
    const names = ds.listFields().map((f) => f.uniqueName);
    expect(names).not.toContain('country.year');
  });

  it('hides a field with mapping.visible === false', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { units: { visible: false } },
    });
    const names = ds.listFields().map((f) => f.uniqueName);
    expect(names).not.toContain('units');
    expect(names).toEqual(['country', 'category', 'revenue', 'date']);
  });

  it('applies mapping.type override', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { units: { type: 'string' } },
    });
    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    expect(ds.fieldType('units')).toBe('string');
    // String type -> not a measure by default.
    expect(byName.units!.isMeasure).toBe(false);
    expect(byName.units!.isDimension).toBe(true);
  });

  it('mapping.isMeasure forces measure-only (not a dimension)', () => {
    const ds = new Dataset({
      data: SALES,
      // country is a string but forced to be a measure.
      mapping: { country: { isMeasure: true } },
    });
    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    expect(byName.country!.isMeasure).toBe(true);
    expect(byName.country!.isDimension).toBe(false);
  });

  it('mapping.isMeasure:false demotes a numeric field to a pure dimension', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { revenue: { isMeasure: false } },
    });
    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    expect(byName.revenue!.isMeasure).toBe(false);
    expect(byName.revenue!.isDimension).toBe(true);
  });

  it('passes through caption / aggregation / format from mapping', () => {
    const ds = new Dataset({
      data: SALES,
      mapping: { revenue: { caption: 'Revenue $', aggregation: 'average', format: 'currency' } },
    });
    const byName = Object.fromEntries(ds.listFields().map((f) => [f.uniqueName, f]));
    expect(byName.revenue!.caption).toBe('Revenue $');
    expect(byName.revenue!.aggregation).toBe('average');
    expect(byName.revenue!.format).toBe('currency');
  });
});

describe('compareValues — total ordering with nulls last', () => {
  it('returns 0 for equal values', () => {
    expect(compareValues(5, 5)).toBe(0);
    expect(compareValues('a', 'a')).toBe(0);
    expect(compareValues(null, null)).toBe(0);
  });

  it('orders numbers numerically', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues(10, 2)).toBeGreaterThan(0);
  });

  it('places null after any non-null', () => {
    expect(compareValues(null, 1)).toBe(1);
    expect(compareValues(1, null)).toBe(-1);
    expect(compareValues(null, 'z')).toBe(1);
  });

  it('treats undefined like null (nulls/blanks last)', () => {
    expect(compareValues(undefined, 1)).toBe(1);
    expect(compareValues(1, undefined)).toBe(-1);
  });

  it('orders strings with natural numeric collation', () => {
    // 'item2' before 'item10' thanks to { numeric: true }.
    expect(compareValues('item2', 'item10')).toBeLessThan(0);
    expect(compareValues('item10', 'item2')).toBeGreaterThan(0);
  });

  it('orders booleans false < true', () => {
    expect(compareValues(false, true)).toBeLessThan(0);
    expect(compareValues(true, false)).toBeGreaterThan(0);
    expect(compareValues(true, true)).toBe(0);
  });

  it('orders Date values chronologically', () => {
    const a = new Date('2023-01-01');
    const b = new Date('2023-06-01');
    expect(compareValues(a, b)).toBeLessThan(0);
    expect(compareValues(b, a)).toBeGreaterThan(0);
  });

  it('produces a stable ascending sort with mixed nulls', () => {
    const arr: DataValue[] = [3, null, 1, 2, null];
    arr.sort(compareValues);
    expect(arr).toEqual([1, 2, 3, null, null]);
  });

  it('is case-insensitive for letters (sensitivity: base)', () => {
    // 'a' and 'A' compare equal under base sensitivity.
    expect(compareValues('a', 'A')).toBe(0);
  });
});
