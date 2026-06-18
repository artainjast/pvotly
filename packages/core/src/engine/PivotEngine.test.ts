import { describe, expect, it, vi } from 'vitest';
import { PivotEngine } from './PivotEngine';
import { SALES } from '../__fixtures__/sales';
import type { FieldFilter, MemberPath, PivotConfiguration } from '../types';

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function makeEngine(slice: PivotConfiguration['slice'] = {}): PivotEngine {
  return new PivotEngine({ dataSource: { data: SALES }, slice });
}

/** A MemberPath tuple segment list, as getRecords / expand expect. */
function tuple(...segs: Array<{ uniqueName: string; value: unknown }>): MemberPath['tuple'] {
  return segs as MemberPath['tuple'];
}

function path(...segs: Array<{ uniqueName: string; value: unknown }>): MemberPath {
  return { tuple: segs as MemberPath['tuple'] };
}

/* -------------------------------------------------------------------------- */
/* drag-drop axis mutations                                                   */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: drag-drop axis mutations', () => {
  it('addToRows / addToColumns / addToValues / addToFilters reflect in getSlice', () => {
    const engine = makeEngine();
    engine.addToRows('country');
    engine.addToColumns('category');
    engine.addToValues('revenue');
    engine.addToFilters('units');

    const slice = engine.getSlice();
    expect(slice.rows).toEqual([{ uniqueName: 'country' }]);
    expect(slice.columns).toEqual([{ uniqueName: 'category' }]);
    expect(slice.reportFilters).toEqual([{ uniqueName: 'units' }]);
    // addToValues builds a MeasureConfig; revenue is numeric -> isMeasure -> 'sum'.
    expect(slice.measures).toHaveLength(1);
    expect(slice.measures![0]).toMatchObject({ uniqueName: 'revenue', aggregation: 'sum' });
  });

  it('addToValues defaults aggregation to count for a non-measure (string) field', () => {
    const engine = makeEngine();
    engine.addToValues('country');
    expect(engine.getSlice().measures![0]).toMatchObject({
      uniqueName: 'country',
      aggregation: 'count',
    });
  });

  it('addToValues honors options.defaultAggregation for a non-measure field', () => {
    const engine = new PivotEngine({
      dataSource: { data: SALES },
      options: { defaultAggregation: 'distinctCount' },
      slice: {},
    });
    engine.addToValues('country');
    expect(engine.getSlice().measures![0]).toMatchObject({
      uniqueName: 'country',
      aggregation: 'distinctCount',
    });
  });

  it('respects the insertion index (and appends when out of range)', () => {
    const engine = makeEngine();
    engine.addToRows('country');
    engine.addToRows('category');
    engine.addToRows('units', 0); // insert at front

    expect(engine.getSlice().rows!.map((f) => f.uniqueName)).toEqual([
      'units',
      'country',
      'category',
    ]);

    // Out-of-range index appends to the end.
    engine.addToRows('revenue', 99);
    expect(engine.getSlice().rows!.map((f) => f.uniqueName)).toEqual([
      'units',
      'country',
      'category',
      'revenue',
    ]);
  });

  it('getSlice returns a deep clone (mutating the result does not affect the engine)', () => {
    const engine = makeEngine({ rows: [{ uniqueName: 'country' }] });
    const a = engine.getSlice();
    const b = engine.getSlice();
    expect(a).not.toBe(b);
    expect(a.rows).not.toBe(b.rows);
    a.rows!.push({ uniqueName: 'hacked' });
    expect(engine.getSlice().rows!.map((f) => f.uniqueName)).toEqual(['country']);
  });
});

/* -------------------------------------------------------------------------- */
/* setFieldAxis moves between axes                                            */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: setFieldAxis', () => {
  it('moves a field off every other axis when placing it', () => {
    const engine = makeEngine();
    engine.addToRows('country');
    expect(engine.getSlice().rows!.map((f) => f.uniqueName)).toEqual(['country']);

    // Move the same field to columns: should leave rows.
    engine.setFieldAxis('country', 'columns');
    const slice = engine.getSlice();
    expect(slice.rows ?? []).toEqual([]);
    expect(slice.columns!.map((f) => f.uniqueName)).toEqual(['country']);
  });

  it('moving a measure field off the values axis removes it from measures', () => {
    const engine = makeEngine();
    engine.addToValues('revenue');
    expect(engine.getSlice().measures!.map((m) => m.uniqueName)).toEqual(['revenue']);

    engine.setFieldAxis('revenue', 'rows');
    const slice = engine.getSlice();
    expect(slice.measures ?? []).toEqual([]);
    expect(slice.rows!.map((f) => f.uniqueName)).toEqual(['revenue']);
  });

  it('removeField removes a field from all axes', () => {
    const engine = makeEngine();
    engine.addToRows('country');
    engine.addToValues('revenue');
    engine.removeField('country');
    engine.removeField('revenue');
    const slice = engine.getSlice();
    expect(slice.rows ?? []).toEqual([]);
    expect(slice.measures ?? []).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* aggregation / measure config                                               */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: setAggregation', () => {
  it('changes the aggregation of an existing measure and the computed grid', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });

    // USA sum of revenue = 100+200+50 = 350.
    const sumGrid = engine.getGrid();
    const usa = sumGrid.rowLeaves.find((l) => l.caption === 'USA')!;
    expect(sumGrid.getCell(usa, sumGrid.columnLeaves[0]!, sumGrid.measures[0]!).value).toBe(350);

    engine.setAggregation('revenue', 'count');
    expect(engine.getSlice().measures![0]!.aggregation).toBe('count');

    // USA has 3 records.
    const countGrid = engine.getGrid();
    const usa2 = countGrid.rowLeaves.find((l) => l.caption === 'USA')!;
    expect(countGrid.getCell(usa2, countGrid.columnLeaves[0]!, countGrid.measures[0]!).value).toBe(3);
  });

  it('is a no-op when the measure does not exist', () => {
    const engine = makeEngine({ measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] });
    engine.setAggregation('nope', 'count');
    expect(engine.getSlice().measures![0]!.aggregation).toBe('sum');
  });
});

/* -------------------------------------------------------------------------- */
/* sorting                                                                    */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: sortField', () => {
  it('sets the sort direction on a row field and emits sortChange', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const spy = vi.fn();
    engine.on('sortChange', spy);

    engine.sortField('country', 'desc');
    expect(engine.getSlice().rows![0]!.sort).toBe('desc');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ field: 'country', direction: 'desc' });

    // Descending: USA (350) should appear before Canada (500)? No — sort is by
    // member value, not by measure. compareValues('USA','Canada') desc => USA first.
    const grid = engine.getGrid();
    const dataLeaves = grid.rowLeaves.filter((l) => !l.isGrandTotal);
    expect(dataLeaves.map((l) => l.caption)).toEqual(['USA', 'Canada']);
  });

  it('default ascending sort orders members ascending by value', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const grid = engine.getGrid();
    const dataLeaves = grid.rowLeaves.filter((l) => !l.isGrandTotal);
    expect(dataLeaves.map((l) => l.caption)).toEqual(['Canada', 'USA']);
  });
});

/* -------------------------------------------------------------------------- */
/* filtering                                                                  */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: setFilter / clearFilter', () => {
  it('setFilter attaches a filter and emits filterChange', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const spy = vi.fn();
    engine.on('filterChange', spy);

    const filter: FieldFilter = { type: 'members', include: ['USA'] };
    engine.setFilter('country', filter);

    expect(engine.getSlice().rows![0]!.filter).toEqual(filter);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ field: 'country', filter });

    // Only USA should survive the member filter.
    const grid = engine.getGrid();
    const dataLeaves = grid.rowLeaves.filter((l) => !l.isGrandTotal);
    expect(dataLeaves.map((l) => l.caption)).toEqual(['USA']);
    // Grand total now equals USA's revenue.
    const grand = grid.rowLeaves.find((l) => l.isGrandTotal)!;
    expect(grid.getCell(grand, grid.columnLeaves[0]!, grid.measures[0]!).value).toBe(350);
  });

  it('clearFilter removes the filter and emits filterChange with undefined', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country', filter: { type: 'members', include: ['USA'] } }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const spy = vi.fn();
    engine.on('filterChange', spy);

    engine.clearFilter('country');
    expect(engine.getSlice().rows![0]!.filter).toBeUndefined();
    expect(spy).toHaveBeenCalledWith({ field: 'country', filter: undefined });

    // Both countries return.
    const grid = engine.getGrid();
    const dataLeaves = grid.rowLeaves.filter((l) => !l.isGrandTotal);
    expect(dataLeaves.map((l) => l.caption).sort()).toEqual(['Canada', 'USA']);
  });
});

/* -------------------------------------------------------------------------- */
/* expand / collapse                                                          */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: expand / collapse / expandAll / collapseAll', () => {
  function twoLevelEngine() {
    return makeEngine({
      rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
  }

  it('compact grid defaults to fully expanded (parents shown as subtotal lines)', () => {
    const engine = twoLevelEngine();
    const grid = engine.getGrid();
    // Canada(subtotal), Canada/Bikes, Canada/Cars, USA(subtotal), USA/Bikes, USA/Cars, Grand Total.
    const captions = grid.rowLeaves.map((l) => l.caption);
    expect(captions).toEqual([
      'Canada',
      'Bikes',
      'Cars',
      'USA',
      'Bikes',
      'Cars',
      'Grand Total',
    ]);
    expect(grid.rowLeaves).toHaveLength(7);
  });

  it('collapseAll collapses every parent so only top-level + grand total remain', () => {
    const engine = twoLevelEngine();
    engine.collapseAll();
    const grid = engine.getGrid();
    const captions = grid.rowLeaves.map((l) => l.caption);
    expect(captions).toEqual(['Canada', 'USA', 'Grand Total']);
    // The collapsed parent leaf shows the aggregate over all descendants.
    const canada = grid.rowLeaves.find((l) => l.caption === 'Canada')!;
    expect(grid.getCell(canada, grid.columnLeaves[0]!, grid.measures[0]!).value).toBe(500);
  });

  it('collapse a single member path hides only that subtree', () => {
    const engine = twoLevelEngine();
    engine.collapse('rows', path({ uniqueName: 'country', value: 'USA' }));
    const grid = engine.getGrid();
    const captions = grid.rowLeaves.map((l) => l.caption);
    // Canada stays expanded; USA collapses to a single leaf.
    expect(captions).toEqual(['Canada', 'Bikes', 'Cars', 'USA', 'Grand Total']);
  });

  it('expandAll then expand/collapse a path round-trips visible leaf count', () => {
    const engine = twoLevelEngine();
    engine.collapseAll();
    expect(engine.getGrid().rowLeaves).toHaveLength(3);

    engine.expandAll();
    expect(engine.getGrid().rowLeaves).toHaveLength(7);

    // Collapse USA again from the fully expanded state.
    engine.collapse('rows', path({ uniqueName: 'country', value: 'USA' }));
    expect(engine.getGrid().rowLeaves).toHaveLength(5);

    // Re-expand USA -> back to full.
    engine.expand('rows', path({ uniqueName: 'country', value: 'USA' }));
    expect(engine.getGrid().rowLeaves).toHaveLength(7);
  });
});

/* -------------------------------------------------------------------------- */
/* drill-through                                                              */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: getRecords drill-through', () => {
  it('returns all records for an empty path', () => {
    const engine = makeEngine();
    expect(engine.getRecords()).toHaveLength(SALES.length);
  });

  it('returns records matching the row path', () => {
    const engine = makeEngine();
    const recs = engine.getRecords(tuple({ uniqueName: 'country', value: 'USA' }));
    expect(recs).toHaveLength(3);
    expect(recs.every((r) => r.country === 'USA')).toBe(true);
  });

  it('intersects row and column paths', () => {
    const engine = makeEngine();
    const recs = engine.getRecords(
      tuple({ uniqueName: 'country', value: 'USA' }),
      tuple({ uniqueName: 'category', value: 'Cars' }),
    );
    expect(recs).toHaveLength(2);
    const total = recs.reduce((s, r) => s + (r.revenue as number), 0);
    expect(total).toBe(300); // 100 + 200
  });

  it('returns an empty array when nothing matches', () => {
    const engine = makeEngine();
    expect(
      engine.getRecords(tuple({ uniqueName: 'country', value: 'Atlantis' })),
    ).toHaveLength(0);
  });

  it('matches a multi-segment row path', () => {
    const engine = makeEngine();
    const recs = engine.getRecords(
      tuple(
        { uniqueName: 'country', value: 'Canada' },
        { uniqueName: 'category', value: 'Bikes' },
      ),
    );
    expect(recs).toHaveLength(2);
    expect(recs.reduce((s, r) => s + (r.revenue as number), 0)).toBe(200); // 80 + 120
  });
});

/* -------------------------------------------------------------------------- */
/* report round-trip                                                          */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: getReport / setReport round-trip', () => {
  it('getReport returns a deep clone (not the same reference)', () => {
    const config: PivotConfiguration = {
      dataSource: { data: SALES },
      slice: { rows: [{ uniqueName: 'country' }] },
    };
    const engine = new PivotEngine(config);
    const report = engine.getReport();
    expect(report).not.toBe(config);
    expect(report.slice).not.toBe(config.slice);
    expect(report.slice!.rows).toEqual([{ uniqueName: 'country' }]);

    // Mutating the returned report does not leak back into the engine.
    report.slice!.rows!.push({ uniqueName: 'leak' });
    expect(engine.getReport().slice!.rows!.map((f) => f.uniqueName)).toEqual(['country']);
  });

  it('setReport replaces config, deep-clones, and emits reportChange', () => {
    const engine = makeEngine({ rows: [{ uniqueName: 'country' }] });
    const spy = vi.fn();
    engine.on('reportChange', spy);

    const next: PivotConfiguration = {
      dataSource: { data: SALES },
      slice: {
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'units', aggregation: 'sum' }],
      },
    };
    engine.setReport(next);
    expect(spy).toHaveBeenCalledTimes(1);

    const report = engine.getReport();
    expect(report.slice!.rows ?? []).toEqual([]);
    expect(report.slice!.columns).toEqual([{ uniqueName: 'category' }]);
    // Deep clone: the stored slice is not the passed-in object.
    expect(report.slice).not.toBe(next.slice);
  });

  it('round-trips a report through getReport -> setReport on a fresh engine', () => {
    const source = makeEngine({
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const exported = source.getReport();

    const restored = new PivotEngine({ dataSource: { data: [] } });
    restored.setReport(exported);

    const a = source.getGrid();
    const b = restored.getGrid();
    expect(b.meta.totalRows).toBe(a.meta.totalRows);
    expect(b.meta.totalColumns).toBe(a.meta.totalColumns);
    expect(b.measures.map((m) => m.uniqueName)).toEqual(a.measures.map((m) => m.uniqueName));
  });
});

/* -------------------------------------------------------------------------- */
/* updateData                                                                 */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: updateData', () => {
  it('swaps the dataset and emits dataChange with the new record count', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const spy = vi.fn();
    engine.on('dataChange', spy);

    const newData = [
      { country: 'Japan', category: 'Cars', revenue: 1000, units: 1, date: '2025-01-01' },
      { country: 'Japan', category: 'Bikes', revenue: 500, units: 2, date: '2025-02-01' },
    ];
    engine.updateData({ data: newData });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ records: 2 });
    expect(engine.getDataset().records).toHaveLength(2);

    const grid = engine.getGrid();
    const japan = grid.rowLeaves.find((l) => l.caption === 'Japan')!;
    expect(japan).toBeTruthy();
    expect(grid.getCell(japan, grid.columnLeaves[0]!, grid.measures[0]!).value).toBe(1500);
  });

  it('reports zero records for empty data', () => {
    const engine = makeEngine();
    const spy = vi.fn();
    engine.on('dataChange', spy);
    engine.updateData({ data: [] });
    expect(spy).toHaveBeenCalledWith({ records: 0 });
    expect(engine.getRecords()).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* grid caching / invalidation                                                */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: getGrid caching + invalidation', () => {
  it('returns the same grid object until a mutation invalidates it', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const g1 = engine.getGrid();
    const g2 = engine.getGrid();
    expect(g2).toBe(g1); // cached

    engine.setAggregation('revenue', 'count'); // mutation -> invalidate
    const g3 = engine.getGrid();
    expect(g3).not.toBe(g1);

    // Stable again until the next mutation.
    expect(engine.getGrid()).toBe(g3);
  });

  it('every mutating entry point invalidates the cache', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });

    const mutations: Array<[string, () => void]> = [
      ['addToColumns', () => engine.addToColumns('category')],
      ['sortField', () => engine.sortField('country', 'desc')],
      ['setFilter', () => engine.setFilter('country', { type: 'members', include: ['USA', 'Canada'] })],
      ['collapseAll', () => engine.collapseAll()],
      ['expandAll', () => engine.expandAll()],
      ['setSlice', () => engine.setSlice(engine.getSlice())],
      ['updateData', () => engine.updateData({ data: SALES })],
    ];

    for (const [, mutate] of mutations) {
      const before = engine.getGrid();
      mutate();
      expect(engine.getGrid()).not.toBe(before);
    }
  });

  it('non-mutating reads do not invalidate the cache', () => {
    const engine = makeEngine({
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    });
    const g1 = engine.getGrid();
    engine.getSlice();
    engine.getReport();
    engine.getFields();
    engine.getMembers('country');
    engine.getRecords(tuple({ uniqueName: 'country', value: 'USA' }));
    expect(engine.getGrid()).toBe(g1);
  });
});

/* -------------------------------------------------------------------------- */
/* events: ready (async) + emitter basics                                     */
/* -------------------------------------------------------------------------- */

describe('PivotEngine: events', () => {
  it('emits ready asynchronously (via microtask) after construction', async () => {
    const engine = makeEngine();
    const spy = vi.fn();
    engine.on('ready', spy);
    // ready is queued on a microtask in the constructor; not fired synchronously.
    expect(spy).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('off() unsubscribes a handler; the returned disposer also works', () => {
    const engine = makeEngine({ rows: [{ uniqueName: 'country' }] });
    const spy = vi.fn();
    const dispose = engine.on('reportChange', spy);
    engine.addToColumns('category');
    expect(spy).toHaveBeenCalledTimes(1);

    dispose();
    engine.addToColumns('category');
    expect(spy).toHaveBeenCalledTimes(1); // no further calls
  });

  it('reportChange payload is a fresh clone of the configuration', () => {
    const engine = makeEngine({ rows: [{ uniqueName: 'country' }] });
    let payloadA: PivotConfiguration | undefined;
    let payloadB: PivotConfiguration | undefined;
    engine.on('reportChange', (p) => {
      if (!payloadA) payloadA = p;
      else payloadB = p;
    });
    engine.addToColumns('category');
    engine.addToValues('revenue');
    expect(payloadA).toBeDefined();
    expect(payloadB).toBeDefined();
    expect(payloadA).not.toBe(payloadB);
  });
});
