import { describe, it, expect } from 'vitest';

import { buildRecordPredicate, combinePredicates } from './filter';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type {
  DataRecord,
  FieldFilter,
  LabelFilter,
  MemberFilter,
  QueryFilter,
  ValueFilter,
} from '../types';

/** Build a Dataset over the shared SALES fixture. */
function salesDataset(): Dataset {
  return new Dataset({ data: SALES });
}

/** Apply a predicate to a dataset's records and return them. */
function applyFilter(dataset: Dataset, uniqueName: string, filter: FieldFilter): DataRecord[] {
  const predicate = buildRecordPredicate(dataset, uniqueName, filter);
  return dataset.records.filter(predicate);
}

describe('buildRecordPredicate — member filters', () => {
  it('include keeps only listed members (string field)', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', include: ['USA'] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(3);
    expect(kept.every((r) => r.country === 'USA')).toBe(true);
  });

  it('include with multiple members keeps all listed (and drops the rest)', () => {
    const ds = salesDataset();
    // Keep only the Bikes rows by category.
    const filter: MemberFilter = { type: 'members', include: ['Bikes'] };
    const kept = applyFilter(ds, 'category', filter);

    expect(kept).toHaveLength(3);
    expect(kept.every((r) => r.category === 'Bikes')).toBe(true);
  });

  it('include with both countries keeps every record', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', include: ['USA', 'Canada'] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('include for a member that does not exist keeps nothing', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', include: ['Mexico'] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(0);
  });

  it('exclude drops listed members and keeps the rest', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', exclude: ['USA'] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(3);
    expect(kept.every((r) => r.country === 'Canada')).toBe(true);
  });

  it('exclude with multiple members removes all of them', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', exclude: ['Cars', 'Bikes'] };
    const kept = applyFilter(ds, 'category', filter);

    expect(kept).toHaveLength(0);
  });

  it('include takes precedence over exclude when both are present', () => {
    const ds = salesDataset();
    // include is non-empty so exclude is ignored entirely.
    const filter: MemberFilter = { type: 'members', include: ['USA'], exclude: ['USA'] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(3);
    expect(kept.every((r) => r.country === 'USA')).toBe(true);
  });

  it('empty include array falls through to pass-through (keeps everything)', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', include: [] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('empty exclude array (with no include) keeps everything', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members', exclude: [] };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('no include and no exclude keeps everything', () => {
    const ds = salesDataset();
    const filter: MemberFilter = { type: 'members' };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('member keys are type-aware: a numeric field matches numeric include values', () => {
    const ds = salesDataset();
    // units field is numeric; include numbers, not strings.
    const filter: MemberFilter = { type: 'members', include: [2, 5] };
    const kept = applyFilter(ds, 'units', filter);

    expect(kept.map((r) => r.units).sort()).toEqual([2, 5]);
  });

  it('member keys distinguish string from number: string include does NOT match numeric field', () => {
    const ds = salesDataset();
    // '2' (string) keyed as "string:2" never matches the number-keyed "number:2".
    const filter: MemberFilter = { type: 'members', include: ['2', '5'] };
    const kept = applyFilter(ds, 'units', filter);

    expect(kept).toHaveLength(0);
  });

  it('include of null keeps records whose resolved value is null/blank', () => {
    const ds = new Dataset({
      data: [
        { name: 'a', tag: 'x' },
        { name: 'b', tag: null },
        { name: 'c', tag: '' },
      ],
    });
    // '' normalizes to null for string fields, so two records have null tag.
    const filter: MemberFilter = { type: 'members', include: [null] };
    const kept = applyFilter(ds, 'tag', filter);

    expect(kept.map((r) => r.name).sort()).toEqual(['b', 'c']);
  });
});

describe('buildRecordPredicate — label filters', () => {
  it('contains matches captions containing the substring (case-insensitive)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'contains', value: 'car' } };
    const kept = applyFilter(ds, 'category', filter);

    expect(kept.every((r) => r.category === 'Cars')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('notContains keeps captions that do NOT contain the substring', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'notContains', value: 'car' } };
    const kept = applyFilter(ds, 'category', filter);

    expect(kept.every((r) => r.category === 'Bikes')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('beginsWith matches captions starting with the value (case-insensitive)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'beginsWith', value: 'US' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept.every((r) => r.country === 'USA')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('beginsWith is case-insensitive (lowercase query matches uppercase caption)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'beginsWith', value: 'can' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept.every((r) => r.country === 'Canada')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('endsWith matches captions ending with the value (case-insensitive)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'endsWith', value: 'DA' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept.every((r) => r.country === 'Canada')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('equal matches captions equal to the value (case-insensitive)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'equal', value: 'usa' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept.every((r) => r.country === 'USA')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('equal does not match a substring (must be the whole caption)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'equal', value: 'US' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(0);
  });

  it('notEqual keeps captions not equal to the value (case-insensitive)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'notEqual', value: 'USA' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept.every((r) => r.country === 'Canada')).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it('regex matches captions against the pattern (case-sensitive by default)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'regex', value: '^Ca' } };
    // Matches "Cars" and "Canada".
    const kept = applyFilter(ds, 'category', filter);
    expect(kept.every((r) => r.category === 'Cars')).toBe(true);
    expect(kept).toHaveLength(3);

    const keptCountry = applyFilter(ds, 'country', filter);
    expect(keptCountry.every((r) => r.country === 'Canada')).toBe(true);
    expect(keptCountry).toHaveLength(3);
  });

  it('regex is case-sensitive: lowercase pattern does not match uppercase caption', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'regex', value: '^ca' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(0);
  });

  it('invalid regex matches nothing (falls back to an impossible pattern)', () => {
    const ds = salesDataset();
    const filter: LabelFilter = { type: 'label', query: { op: 'regex', value: '[' } };
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(0);
  });

  it('label filter on a null/blank member uses the "(blank)" caption', () => {
    const ds = new Dataset({
      data: [
        { name: 'a', tag: 'x' },
        { name: 'b', tag: null },
      ],
    });
    const filter: LabelFilter = { type: 'label', query: { op: 'contains', value: 'blank' } };
    const kept = applyFilter(ds, 'tag', filter);

    expect(kept.map((r) => r.name)).toEqual(['b']);
  });
});

describe('buildRecordPredicate — query filters', () => {
  it('min keeps records with value >= target (inclusive)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { min: 100 } };
    const kept = applyFilter(ds, 'revenue', filter);

    // revenue >= 100: 100, 200, 300, 120
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([
      100, 120, 200, 300,
    ]);
  });

  it('max keeps records with value <= target (inclusive)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { max: 100 } };
    const kept = applyFilter(ds, 'revenue', filter);

    // revenue <= 100: 100, 50, 80
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([50, 80, 100]);
  });

  it('greater keeps records strictly greater than target', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { greater: 100 } };
    const kept = applyFilter(ds, 'revenue', filter);

    // revenue > 100: 200, 300, 120
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([120, 200, 300]);
  });

  it('less keeps records strictly less than target', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { less: 100 } };
    const kept = applyFilter(ds, 'revenue', filter);

    // revenue < 100: 50, 80
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([50, 80]);
  });

  it('equal keeps records whose value strictly equals the target', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { equal: 200 } };
    const kept = applyFilter(ds, 'revenue', filter);

    expect(kept).toHaveLength(1);
    expect(kept[0]!.revenue).toBe(200);
  });

  it('greaterEqual behaves like min (inclusive lower bound)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { greaterEqual: 200 } };
    const kept = applyFilter(ds, 'revenue', filter);

    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([200, 300]);
  });

  it('lessEqual behaves like max (inclusive upper bound)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { lessEqual: 80 } };
    const kept = applyFilter(ds, 'revenue', filter);

    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([50, 80]);
  });

  it('combines min and max into a range (both must hold)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { min: 80, max: 200 } };
    const kept = applyFilter(ds, 'revenue', filter);

    // 80 <= revenue <= 200: 100, 200, 80, 120
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([
      80, 100, 120, 200,
    ]);
  });

  it('unknown query op is ignored (treated as always true)', () => {
    const ds = salesDataset();
    // bogusOp is not handled -> default branch returns true for every record.
    const filter = { type: 'query', query: { bogusOp: 5 } } as unknown as QueryFilter;
    const kept = applyFilter(ds, 'revenue', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('empty query object keeps everything', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: {} };
    const kept = applyFilter(ds, 'revenue', filter);

    expect(kept).toHaveLength(SALES.length);
  });

  it('after keeps records on/after the target date (inclusive)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { after: '2024-01-01' } };
    const kept = applyFilter(ds, 'date', filter);

    // dates in 2024: 2024-01-12, 2024-02-18
    expect(kept).toHaveLength(2);
    expect(kept.every((r) => (r.date as Date).getFullYear() === 2024)).toBe(true);
  });

  it('before keeps records on/before the target date (inclusive)', () => {
    const ds = salesDataset();
    const filter: QueryFilter = { type: 'query', query: { before: '2023-12-31' } };
    const kept = applyFilter(ds, 'date', filter);

    // dates in 2023: 4 of them
    expect(kept).toHaveLength(4);
    expect(kept.every((r) => (r.date as Date).getFullYear() === 2023)).toBe(true);
  });
});

describe('buildRecordPredicate — value filters (pass-through)', () => {
  it('value-type filter does not filter at the record level', () => {
    const ds = salesDataset();
    const filter: ValueFilter = {
      type: 'value',
      measure: 'revenue',
      query: { op: 'top', count: 1 },
    };
    const kept = applyFilter(ds, 'country', filter);

    // Top/bottom-N is resolved on the axis after aggregation, not here.
    expect(kept).toHaveLength(SALES.length);
  });

  it('unknown filter type defaults to pass-through', () => {
    const ds = salesDataset();
    const filter = { type: 'mystery' } as unknown as FieldFilter;
    const kept = applyFilter(ds, 'country', filter);

    expect(kept).toHaveLength(SALES.length);
  });
});

describe('combinePredicates', () => {
  it('with no predicates returns a pass-through (true for any record)', () => {
    const combined = combinePredicates([]);
    expect(combined({ country: 'USA' })).toBe(true);
    expect(combined({})).toBe(true);
  });

  it('with a single predicate returns that predicate', () => {
    const ds = salesDataset();
    const single = buildRecordPredicate(ds, 'country', {
      type: 'members',
      include: ['USA'],
    });
    const combined = combinePredicates([single]);

    expect(ds.records.filter(combined).every((r) => r.country === 'USA')).toBe(true);
    expect(ds.records.filter(combined)).toHaveLength(3);
  });

  it('ANDs multiple predicates across different fields', () => {
    const ds = salesDataset();
    const byCountry = buildRecordPredicate(ds, 'country', {
      type: 'members',
      include: ['USA'],
    });
    const byCategory = buildRecordPredicate(ds, 'category', {
      type: 'members',
      include: ['Cars'],
    });
    const combined = combinePredicates([byCountry, byCategory]);
    const kept = ds.records.filter(combined);

    // USA + Cars: revenue 100 and 200
    expect(kept).toHaveLength(2);
    expect(kept.every((r) => r.country === 'USA' && r.category === 'Cars')).toBe(true);
  });

  it('ANDs a member filter with a query filter', () => {
    const ds = salesDataset();
    const byCountry = buildRecordPredicate(ds, 'country', {
      type: 'members',
      include: ['Canada'],
    });
    const byRevenue = buildRecordPredicate(ds, 'revenue', {
      type: 'query',
      query: { greater: 100 },
    });
    const combined = combinePredicates([byCountry, byRevenue]);
    const kept = ds.records.filter(combined);

    // Canada records with revenue > 100: 300 and 120
    expect(kept.map((r) => r.revenue).sort((a, b) => Number(a) - Number(b))).toEqual([120, 300]);
  });

  it('returns no records when AND-ed predicates are mutually exclusive', () => {
    const ds = salesDataset();
    const includeUsa = buildRecordPredicate(ds, 'country', {
      type: 'members',
      include: ['USA'],
    });
    const excludeUsa = buildRecordPredicate(ds, 'country', {
      type: 'members',
      exclude: ['USA'],
    });
    const combined = combinePredicates([includeUsa, excludeUsa]);

    expect(ds.records.filter(combined)).toHaveLength(0);
  });
});

describe('buildRecordPredicate — empty dataset', () => {
  it('returns an empty result for any filter on an empty dataset', () => {
    const ds = new Dataset({ data: [] });
    const filter: MemberFilter = { type: 'members', include: ['USA'] };
    const predicate = buildRecordPredicate(ds, 'country', filter);

    expect(ds.records.filter(predicate)).toHaveLength(0);
  });
});

describe('buildRecordPredicate — date-part derived fields', () => {
  it('member include works against a derived date-part value (numeric year)', () => {
    const ds = salesDataset();
    // date.year resolves to a numeric year; include 2024 (number).
    const filter: MemberFilter = { type: 'members', include: [2024] };
    const kept = applyFilter(ds, 'date.year', filter);

    expect(kept).toHaveLength(2);
    expect(kept.every((r) => (r.date as Date).getFullYear() === 2024)).toBe(true);
  });

  it('query on a derived numeric date-part filters correctly', () => {
    const ds = salesDataset();
    // date.month >= 2 keeps Feb and March records.
    const filter: QueryFilter = { type: 'query', query: { min: 2 } };
    const kept = applyFilter(ds, 'date.month', filter);

    // months: Jan, Feb, Jan, Mar, Jan, Feb -> month >= 2: Feb(2), Mar(3), Feb(18) => 3 records
    expect(kept).toHaveLength(3);
    expect(kept.every((r) => (r.date as Date).getMonth() + 1 >= 2)).toBe(true);
  });
});
