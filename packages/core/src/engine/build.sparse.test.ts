import { describe, expect, it } from 'vitest';
import { Dataset } from '../data/dataset';
import { buildGrid } from './build';
import type { PivotConfiguration } from '../types';

// Two row dims + two col dims -> many empty leaf x leaf intersections.
const DATA = [
  { region: 'W', country: 'USA', year: 2023, q: 'Q1', sales: 10 },
  { region: 'W', country: 'USA', year: 2023, q: 'Q2', sales: 20 },
  { region: 'W', country: 'MEX', year: 2024, q: 'Q1', sales: 5 },
  { region: 'E', country: 'UK', year: 2023, q: 'Q1', sales: 30 },
  { region: 'E', country: 'FR', year: 2024, q: 'Q2', sales: 7 },
  { region: 'E', country: 'FR', year: 2024, q: 'Q1', sales: 3 },
];

function build(extra: Partial<PivotConfiguration> = {}, measure: Record<string, unknown> = {}) {
  const config: PivotConfiguration = {
    dataSource: { data: DATA },
    slice: {
      rows: [{ uniqueName: 'region' }, { uniqueName: 'country' }],
      columns: [{ uniqueName: 'year' }, { uniqueName: 'q' }],
      measures: [{ uniqueName: 'sales', aggregation: 'sum', ...measure }],
    },
    options: { grid: { showTotals: 'on', showGrandTotals: 'on' } },
    ...extra,
  };
  return buildGrid(new Dataset({ data: DATA }), config);
}

describe('sparse body (empty cells share a frozen singleton)', () => {
  it('keeps the full dense body shape', () => {
    const g = build();
    expect(g.body.length).toBe(g.rowLeaves.length);
    for (const row of g.body) expect(row.length).toBe(g.columnLeaves.length);
  });

  it('shares one frozen EMPTY_CELL for every empty cell; real values get their own', () => {
    const g = build();
    const empties = g.body.flat().filter((c) => c.value == null);
    const filled = g.body.flat().filter((c) => c.value != null);

    expect(empties.length).toBeGreaterThan(1);
    expect(filled.length).toBeGreaterThan(0);

    // All empties are the same frozen object.
    const singleton = empties[0]!;
    expect(Object.isFrozen(singleton)).toBe(true);
    for (const c of empties) expect(c).toBe(singleton);
    // Filled cells are each distinct.
    expect(new Set(filled).size).toBe(filled.length);
  });

  it('getCell returns correct values for filled and empty cells', () => {
    const g = build();
    const gtRow = g.rowLeaves.find((n) => n.isGrandTotal)!;
    const gtCol = g.columnLeaves.find((n) => n.isGrandTotal)!;
    // Grand total = sum of all sales.
    expect(g.getCell(gtRow, gtCol, g.measures[0]!).value).toBe(75);

    // An empty leaf x leaf cell reads back as a path-correct blank.
    let sawEmpty = false;
    for (const r of g.rowLeaves) {
      for (const c of g.columnLeaves) {
        const cell = g.getCell(r, c, g.measures[0]!);
        if (cell.value == null) {
          sawEmpty = true;
          expect(cell.formatted).toBe('');
          expect(cell.rowPath).toEqual(r.path);
          expect(cell.columnPath).toEqual(c.path);
        }
      }
    }
    expect(sawEmpty).toBe(true);
  });

  it('materializes empty cells (not the singleton) for a nullValue format, and renders it', () => {
    const g = build(
      { formats: [{ name: 'dash', nullValue: '-' }] },
      { format: 'dash' },
    );
    const empties = g.body.flat().filter((c) => c.value == null);
    expect(empties.length).toBeGreaterThan(1);
    // Not collapsed to one shared object -> each is a real cell.
    expect(new Set(empties).size).toBe(empties.length);
    // getCell renders the nullValue for a blank cell.
    const blank = empties[0]!;
    expect(blank.formatted).toBe('-');
  });

  it('materializes empty cells for sequence show-as so carried values survive', () => {
    const g = build({}, { showDataAs: 'runningTotalInColumn' });
    const empties = g.body.flat().filter((c) => c.value == null);
    expect(empties.length).toBeGreaterThan(1);
    // Real cells (not the shared singleton) so the running-total pass can fill them.
    expect(new Set(empties).size).toBe(empties.length);
  });
});
