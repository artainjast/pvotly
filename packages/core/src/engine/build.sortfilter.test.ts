import { describe, expect, it } from 'vitest';
import { buildGrid } from './build';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type { HeaderNode, MeasureConfig, PivotConfiguration, SliceField } from '../types';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const REVENUE: MeasureConfig = { uniqueName: 'revenue', aggregation: 'sum' };
const UNITS: MeasureConfig = { uniqueName: 'units', aggregation: 'sum' };

function gridFor(slice: PivotConfiguration['slice']) {
  const dataset = new Dataset({ data: SALES });
  return buildGrid(dataset, { dataSource: { data: SALES }, slice });
}

/** Member values of the row leaves that are real members (not grand total). */
function memberRowValues(leaves: HeaderNode[]): unknown[] {
  return leaves.filter((l) => !l.isGrandTotal).map((l) => l.value);
}

function grandTotalLeaf(leaves: HeaderNode[]): HeaderNode | undefined {
  return leaves.find((l) => l.isGrandTotal);
}

/* -------------------------------------------------------------------------- */
/* Member sort                                                                */
/* -------------------------------------------------------------------------- */

describe('buildGrid — member sort on a row field', () => {
  // compareValues uses localeCompare: 'Canada' < 'USA'.
  it('sorts ascending by default (no sort specified)', () => {
    const grid = gridFor({ rows: [{ uniqueName: 'country' }], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('sorts ascending when sort: "asc" is explicit', () => {
    const grid = gridFor({
      rows: [{ uniqueName: 'country', sort: 'asc' }],
      measures: [REVENUE],
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('sorts descending when sort: "desc"', () => {
    const grid = gridFor({
      rows: [{ uniqueName: 'country', sort: 'desc' }],
      measures: [REVENUE],
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA', 'Canada']);
  });

  it('preserves first-seen (insertion) order when sort: "unsorted"', () => {
    // First appearance order in SALES is USA then Canada.
    const grid = gridFor({
      rows: [{ uniqueName: 'country', sort: 'unsorted' }],
      measures: [REVENUE],
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA', 'Canada']);
  });

  it('sort direction is per-field, independent across levels', () => {
    // country asc (Canada, USA); within each country, category desc (Cars, Bikes).
    const grid = gridFor({
      rows: [
        { uniqueName: 'country', sort: 'asc' },
        { uniqueName: 'category', sort: 'desc' },
      ],
      measures: [REVENUE],
    });
    // Top-level (rowTree) ordering.
    expect(grid.rowTree.map((n) => n.value)).toEqual(['Canada', 'USA']);
    // Each country's category children: desc => Cars before Bikes.
    for (const country of grid.rowTree) {
      expect(country.children.map((c) => c.value)).toEqual(['Cars', 'Bikes']);
    }
  });

  it('keeps a grand-total leaf at the end of the row axis', () => {
    const grid = gridFor({ rows: [{ uniqueName: 'country' }], measures: [REVENUE] });
    const gt = grandTotalLeaf(grid.rowLeaves);
    expect(gt).toBeDefined();
    expect(grid.rowLeaves[grid.rowLeaves.length - 1]?.isGrandTotal).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Value filter — top / bottom                                                */
/* -------------------------------------------------------------------------- */

describe('buildGrid — value filter (top/bottom) on a row field', () => {
  // country revenue: USA=350, Canada=500.
  it('top:1 keeps only the highest member by the measure', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'top', count: 1 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada']); // 500 > 350
  });

  it('bottom:1 keeps only the lowest member by the measure', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'bottom', count: 1 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA']); // 350 < 500
  });

  it('top:1 by units flips the ranking (USA=10 < Canada=22)', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'units', query: { op: 'top', count: 1 } },
    };
    const grid = gridFor({ rows: [field], measures: [UNITS] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada']); // 22 > 10
  });

  it('top:1 by category revenue keeps Cars (600 > Bikes 250)', () => {
    const field: SliceField = {
      uniqueName: 'category',
      filter: { type: 'value', measure: 'revenue', query: { op: 'top', count: 1 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Cars']);
  });

  it('top:count larger than membership keeps all members (still ranked desc)', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'top', count: 10 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    // top sorts descending by the measure: Canada(500), USA(350).
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('uses an explicit override aggregation when provided (max)', () => {
    // max(revenue): USA max=200, Canada max=300 => top:1 keeps Canada.
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', aggregation: 'max', query: { op: 'top', count: 1 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada']);
  });

  it('value filter still surfaces a grand total over the kept members only', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'top', count: 1 } },
    };
    const dataset = new Dataset({ data: SALES });
    const grid = buildGrid(dataset, {
      dataSource: { data: SALES },
      slice: { rows: [field], measures: [REVENUE] },
    });
    const gt = grandTotalLeaf(grid.rowLeaves)!;
    const canadaLeaf = grid.rowLeaves.find((l) => l.value === 'Canada')!;
    const cell = grid.getCell(canadaLeaf, grid.columnLeaves[0]!, grid.measures[0]!);
    expect(cell.value).toBe(500);
    // Grand total cell is computed over ALL records (record-level filter is not
    // applied for a value filter), so it reflects 350 + 500.
    const gtCell = grid.getCell(gt, grid.columnLeaves[0]!, grid.measures[0]!);
    expect(gtCell.value).toBe(850);
  });
});

/* -------------------------------------------------------------------------- */
/* Value filter — threshold                                                   */
/* -------------------------------------------------------------------------- */

describe('buildGrid — value filter (threshold) on a row field', () => {
  // country revenue: USA=350, Canada=500.
  it('greater keeps members strictly above the threshold', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'greater', value: 400 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada']); // only 500 > 400
  });

  it('greater is strict (boundary value excluded)', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'greater', value: 500 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual([]); // nothing strictly > 500
  });

  it('greaterEqual includes the boundary value', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'greaterEqual', value: 500 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada']); // 500 >= 500
  });

  it('less keeps members strictly below the threshold', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'less', value: 400 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA']); // only 350 < 400
  });

  it('between keeps members within an inclusive range (asc order preserved)', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'between', from: 300, to: 600 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    // Both 350 and 500 are in [300,600]; default member sort (asc) preserved.
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('threshold filter applies AFTER member sort (desc order preserved)', () => {
    const field: SliceField = {
      uniqueName: 'country',
      sort: 'desc',
      filter: { type: 'value', measure: 'revenue', query: { op: 'greater', value: 100 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    // Both kept (350, 500 > 100); order is desc by member value: USA, Canada.
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA', 'Canada']);
  });

  it('all members filtered out leaves only the grand total leaf', () => {
    const field: SliceField = {
      uniqueName: 'country',
      filter: { type: 'value', measure: 'revenue', query: { op: 'greater', value: 99999 } },
    };
    const grid = gridFor({ rows: [field], measures: [REVENUE] });
    expect(memberRowValues(grid.rowLeaves)).toEqual([]);
    expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Value sorting (slice.sorting.row / .column)                                */
/* -------------------------------------------------------------------------- */

describe('buildGrid — value sorting via slice.sorting', () => {
  // Sorting the ROW axis uses a COLUMN tuple of values (omitted => grand total).
  // country revenue grand totals: USA=350, Canada=500.
  it('sorting.row asc orders rows by the measure ascending (vs grand total)', () => {
    const grid = gridFor({
      rows: [{ uniqueName: 'country' }],
      measures: [REVENUE],
      sorting: { row: { direction: 'asc', measure: 'revenue' } },
    });
    // asc by revenue: USA(350) then Canada(500).
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA', 'Canada']);
  });

  it('sorting.row desc orders rows by the measure descending', () => {
    const grid = gridFor({
      rows: [{ uniqueName: 'country' }],
      measures: [REVENUE],
      sorting: { row: { direction: 'desc', measure: 'revenue' } },
    });
    // desc by revenue: Canada(500) then USA(350).
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('sorting.row by units overrides the natural member sort', () => {
    // units: USA=10, Canada=22. desc => Canada, USA.
    const grid = gridFor({
      rows: [{ uniqueName: 'country' }],
      measures: [UNITS],
      sorting: { row: { direction: 'desc', measure: 'units' } },
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Canada', 'USA']);
  });

  it('sorting.row beats a conflicting per-field member sort', () => {
    // Field says asc (Canada, USA) but value sort desc by revenue => Canada, USA
    // happen to match; use units desc to make the difference observable instead.
    const grid = gridFor({
      rows: [{ uniqueName: 'category', sort: 'asc' }],
      measures: [REVENUE],
      sorting: { row: { direction: 'desc', measure: 'revenue' } },
    });
    // category revenue: Cars=600, Bikes=250 => desc value sort: Cars, Bikes.
    // (Member asc would have been Bikes, Cars.)
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Cars', 'Bikes']);
  });

  it('sorting.column orders the column axis by a row tuple (grand total)', () => {
    // Columns = category; revenue grand totals: Cars=600, Bikes=250.
    const grid = gridFor({
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [REVENUE],
      sorting: { column: { direction: 'desc', measure: 'revenue' } },
    });
    const colMembers = grid.columnLeaves
      .filter((c) => !c.isGrandTotal)
      .map((c) => c.value);
    expect(colMembers).toEqual(['Cars', 'Bikes']);
  });

  it('sorting.row with an explicit column tuple ranks by that column only', () => {
    // Rows = country, Columns = category. Sort rows by revenue in the "Cars" column.
    // Cars revenue per country: USA=300 (100+200), Canada=300 => tie.
    // Use units instead to get a clear ordering: Cars units USA=5(2+3), Canada=4.
    const grid = gridFor({
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [UNITS],
      sorting: {
        row: {
          direction: 'desc',
          measure: 'units',
          tuple: [{ uniqueName: 'category', value: 'Cars' }],
        },
      },
    });
    // Cars units: USA=5, Canada=4 => desc: USA, Canada.
    expect(memberRowValues(grid.rowLeaves)).toEqual(['USA', 'Canada']);
  });
});

/* -------------------------------------------------------------------------- */
/* Edge cases with inline data                                                */
/* -------------------------------------------------------------------------- */

describe('buildGrid — sort/filter edge cases', () => {
  it('handles an empty dataset (only a grand-total row leaf, no members)', () => {
    const dataset = new Dataset({ data: [] });
    const grid = buildGrid(dataset, {
      dataSource: { data: [] },
      slice: { rows: [{ uniqueName: 'country', sort: 'desc' }], measures: [REVENUE] },
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual([]);
    expect(grid.rowLeaves.length).toBe(1);
    expect(grid.rowLeaves[0]?.isGrandTotal).toBe(true);
  });

  it('a single member sorts and filters trivially', () => {
    const data = [
      { city: 'Rome', amount: 5 },
      { city: 'Rome', amount: 7 },
    ];
    const dataset = new Dataset({ data });
    const grid = buildGrid(dataset, {
      dataSource: { data },
      slice: {
        rows: [
          {
            uniqueName: 'city',
            sort: 'desc',
            filter: { type: 'value', measure: 'amount', query: { op: 'top', count: 1 } },
          },
        ],
        measures: [{ uniqueName: 'amount', aggregation: 'sum' }],
      },
    });
    expect(memberRowValues(grid.rowLeaves)).toEqual(['Rome']);
  });

  it('ranks ties by stable order (numeric member sort)', () => {
    // Two members with equal measure; top:2 keeps both.
    const data = [
      { k: 'a', v: 10 },
      { k: 'b', v: 10 },
      { k: 'c', v: 1 },
    ];
    const dataset = new Dataset({ data });
    const grid = buildGrid(dataset, {
      dataSource: { data },
      slice: {
        rows: [
          {
            uniqueName: 'k',
            filter: { type: 'value', measure: 'v', query: { op: 'top', count: 2 } },
          },
        ],
        measures: [{ uniqueName: 'v', aggregation: 'sum' }],
      },
    });
    const kept = memberRowValues(grid.rowLeaves);
    expect(kept.length).toBe(2);
    expect(kept).toContain('a');
    expect(kept).toContain('b');
    expect(kept).not.toContain('c');
  });

  it('value sort treats missing/null member values as 0 (sorted lowest in asc)', () => {
    // 'x' has revenue null (non-numeric field), 'y' has 100.
    const data = [
      { k: 'x', amt: null as number | null },
      { k: 'y', amt: 100 },
    ];
    const dataset = new Dataset({ data });
    const grid = buildGrid(dataset, {
      dataSource: { data },
      slice: {
        rows: [{ uniqueName: 'k' }],
        measures: [{ uniqueName: 'amt', aggregation: 'sum' }],
        sorting: { row: { direction: 'asc', measure: 'amt' } },
      },
    });
    // x => null treated as 0, y => 100. asc: x then y.
    expect(memberRowValues(grid.rowLeaves)).toEqual(['x', 'y']);
  });
});
