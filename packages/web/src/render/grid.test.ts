import { describe, expect, it } from 'vitest';
import { PivotEngine } from '@pvotly/core';
import { buildGridModel } from './model';
import { buildTSV, cellText, normalizeRange, rangeContains } from './selection';

const DATA = [
  { country: 'USA', category: 'Cars', revenue: 100 },
  { country: 'USA', category: 'Bikes', revenue: 50 },
  { country: 'Canada', category: 'Cars', revenue: 300 },
  { country: 'Canada', category: 'Bikes', revenue: 80 },
];

function model() {
  const engine = new PivotEngine({
    dataSource: { data: DATA },
    slice: {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
  });
  return buildGridModel(engine.getGrid(), engine.getConfiguration());
}

describe('buildGridModel', () => {
  it('produces value columns, body rows and stable ids', () => {
    const m = model();
    expect(m.valueColumns.length).toBeGreaterThan(0);
    expect(m.bodyRows.length).toBeGreaterThan(0);
    // ids are stable + unique
    const ids = new Set(m.valueColumns.map((c) => c.id));
    expect(ids.size).toBe(m.valueColumns.length);
    expect(m.bodyRows.every((r) => r.id.startsWith('r:'))).toBe(true);
  });
});

describe('selection helpers', () => {
  it('normalizes anchor/focus into an inclusive rectangle', () => {
    const r = normalizeRange({ r: 3, c: 5 }, { r: 1, c: 2 });
    expect(r).toEqual({ r0: 1, r1: 3, c0: 2, c1: 5 });
    expect(rangeContains(r, 2, 3)).toBe(true);
    expect(rangeContains(r, 0, 0)).toBe(false);
  });

  it('reads formatted cell text by logical coordinate', () => {
    const m = model();
    // every body cell has some formatted text
    expect(typeof cellText(m, 0, 0)).toBe('string');
  });

  it('builds TSV for a range (tab + newline separated)', () => {
    const m = model();
    const tsv = buildTSV(m, { r0: 0, r1: m.bodyRows.length - 1, c0: 0, c1: m.valueColumns.length - 1 });
    const lines = tsv.split('\n');
    expect(lines.length).toBe(m.bodyRows.length);
    expect(lines[0]!.split('\t').length).toBe(m.valueColumns.length);
  });

  it('includes headers when requested', () => {
    const m = model();
    const tsv = buildTSV(m, { r0: 0, r1: 0, c0: 0, c1: 0 }, { includeHeaders: true });
    const lines = tsv.split('\n');
    expect(lines.length).toBe(2); // header row + 1 body row
  });
});
