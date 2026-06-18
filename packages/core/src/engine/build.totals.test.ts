import { describe, expect, it } from 'vitest';
import { Dataset } from '../data/dataset';
import { buildGrid } from './build';
import { SALES } from '../__fixtures__/sales';
import type { GridType, MeasureConfig, PivotConfiguration, SliceField } from '../types';

/* -------------------------------------------------------------------------- *
 * SALES fixture reference values (computed by hand):
 *   USA/Cars   revenue 100 + 200 = 300  (count 2, units 2 + 3 = 5)
 *   USA/Bikes  revenue 50            = 50   (count 1, units 5)
 *   Canada/Cars  revenue 300         = 300  (count 1, units 4)
 *   Canada/Bikes revenue 80 + 120    = 200  (count 2, units 8 + 10 = 18)
 *
 *   Country totals: USA = 350, Canada = 500
 *   Grand total revenue = 850, total records = 6
 * -------------------------------------------------------------------------- */

const GRAND_REVENUE = 850;
const USA_REVENUE = 350;
const CANADA_REVENUE = 500;

function gridFor(config: Partial<PivotConfiguration>) {
  const dataset = new Dataset({ data: SALES });
  return buildGrid(dataset, { dataSource: { data: SALES }, ...config });
}

const revenueSum: MeasureConfig = { uniqueName: 'revenue', aggregation: 'sum' };
const unitsSum: MeasureConfig = { uniqueName: 'units', aggregation: 'sum' };

describe('buildGrid totals', () => {
  /* ------------------------------------------------------------------ */
  /* Compact: parent rows carry subtotals                                */
  /* ------------------------------------------------------------------ */
  describe('compact grid subtotals', () => {
    it('emits a subtotal line at each expanded parent (pre-order) with the parent aggregate', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [revenueSum],
        },
      });

      // Members sort ascending by default: Canada < USA, Bikes < Cars.
      // Pre-order: Canada (subtotal), Canada/Bikes, Canada/Cars, USA (subtotal),
      // USA/Bikes, USA/Cars, Grand Total.
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

      // The leading "USA" line (index 3) is the parent subtotal (level 0, isTotal).
      const usaParent = grid.rowLeaves[3]!;
      expect(usaParent.caption).toBe('USA');
      expect(usaParent.level).toBe(0);
      expect(usaParent.isTotal).toBe(true);
      expect(usaParent.isGrandTotal).toBeFalsy();

      const col0 = grid.columnLeaves[0]!;
      const usaCell = grid.getCell(usaParent, col0, grid.measures[0]!);
      expect(usaCell.value).toBe(USA_REVENUE);
      expect(usaCell.isTotal).toBe(true);
      expect(usaCell.isGrandTotal).toBe(false);

      // Leaf children sum to the parent subtotal: USA/Bikes 50, USA/Cars 300.
      const usaBikes = grid.rowLeaves[4]!;
      const usaCars = grid.rowLeaves[5]!;
      expect(usaCars.isTotal).toBeFalsy();
      expect(grid.getCell(usaBikes, col0, grid.measures[0]!).value).toBe(50);
      expect(grid.getCell(usaCars, col0, grid.measures[0]!).value).toBe(300);
    });

    it('single-level rows still attach a grand-total subtotal-free leaf set', () => {
      const grid = gridFor({
        slice: { rows: [{ uniqueName: 'country' }], measures: [revenueSum] },
      });
      // No nested children -> no parent subtotal lines, just the two members + grand total.
      const captions = grid.rowLeaves.map((l) => l.caption);
      expect(captions).toEqual(['Canada', 'USA', 'Grand Total']);
      // Top-level members are leaves here, not subtotals.
      expect(grid.rowLeaves[0]!.isTotal).toBeFalsy();
      expect(grid.rowLeaves[1]!.isTotal).toBeFalsy();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Grand total row                                                     */
  /* ------------------------------------------------------------------ */
  describe('grand-total row', () => {
    it('appends a single grand-total leaf flagged isGrandTotal equal to the overall sum', () => {
      const grid = gridFor({
        slice: { rows: [{ uniqueName: 'country' }], measures: [revenueSum] },
      });
      const grandLeaves = grid.rowLeaves.filter((l) => l.isGrandTotal);
      expect(grandLeaves).toHaveLength(1);
      const grand = grandLeaves[0]!;
      expect(grand.caption).toBe('Grand Total');
      // Grand total is the last row.
      expect(grid.rowLeaves[grid.rowLeaves.length - 1]).toBe(grand);

      const cell = grid.getCell(grand, grid.columnLeaves[0]!, grid.measures[0]!);
      expect(cell.value).toBe(GRAND_REVENUE);
      expect(cell.isGrandTotal).toBe(true);
    });

    it('honors a localized grand-total caption', () => {
      const grid = gridFor({
        slice: { rows: [{ uniqueName: 'country' }], measures: [revenueSum] },
        localization: { grandTotal: 'TOTAL' },
      });
      const grand = grid.rowLeaves.find((l) => l.isGrandTotal)!;
      expect(grand.caption).toBe('TOTAL');
    });

    it('places grand totals on both axes by default and equals the overall sum', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [revenueSum],
        },
      });
      const rowGrand = grid.rowLeaves.find((l) => l.isGrandTotal)!;
      const colGrand = grid.columnLeaves.find((l) => l.isGrandTotal)!;
      expect(rowGrand).toBeTruthy();
      expect(colGrand).toBeTruthy();
      // The grand x grand cell is the overall sum.
      const cell = grid.getCell(rowGrand, colGrand, grid.measures[0]!);
      expect(cell.value).toBe(GRAND_REVENUE);
      expect(cell.isGrandTotal).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /* showGrandTotals gating                                              */
  /* ------------------------------------------------------------------ */
  describe('showGrandTotals gating', () => {
    const baseSlice = {
      rows: [{ uniqueName: 'country' }] as SliceField[],
      columns: [{ uniqueName: 'category' }] as SliceField[],
      measures: [revenueSum],
    };

    it("'off' removes grand totals from both axes", () => {
      const grid = gridFor({
        slice: baseSlice,
        options: { grid: { showGrandTotals: 'off' } },
      });
      expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(false);
      expect(grid.columnLeaves.some((l) => l.isGrandTotal)).toBe(false);
    });

    it("'rows' keeps only the row grand total", () => {
      const grid = gridFor({
        slice: baseSlice,
        options: { grid: { showGrandTotals: 'rows' } },
      });
      expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(true);
      expect(grid.columnLeaves.some((l) => l.isGrandTotal)).toBe(false);
    });

    it("'columns' keeps only the column grand total", () => {
      const grid = gridFor({
        slice: baseSlice,
        options: { grid: { showGrandTotals: 'columns' } },
      });
      expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(false);
      expect(grid.columnLeaves.some((l) => l.isGrandTotal)).toBe(true);
    });

    it("default ('on') keeps both grand totals", () => {
      const grid = gridFor({ slice: baseSlice });
      expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(true);
      expect(grid.columnLeaves.some((l) => l.isGrandTotal)).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Classic grid type: trailing subtotal lines                          */
  /* ------------------------------------------------------------------ */
  describe('classic grid subtotals', () => {
    it('emits children first then a trailing subtotal per expanded group', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [revenueSum],
        },
        options: { grid: { type: 'classic' } },
      });
      // Canada then USA (alphabetical). Within each: leaves then a trailing subtotal.
      // Canada/Bikes, Canada/Cars, Canada(subtotal), USA/Bikes, USA/Cars, USA(subtotal), Grand Total.
      const captions = grid.rowLeaves.map((l) => l.caption);
      expect(captions).toEqual([
        'Bikes',
        'Cars',
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Grand Total',
      ]);

      // The "Canada" entry (index 2) is the trailing subtotal.
      const canadaSub = grid.rowLeaves[2]!;
      expect(canadaSub.caption).toBe('Canada');
      expect(canadaSub.isTotal).toBe(true);
      expect(canadaSub.isGrandTotal).toBeFalsy();
      const col0 = grid.columnLeaves[0]!;
      expect(grid.getCell(canadaSub, col0, grid.measures[0]!).value).toBe(CANADA_REVENUE);

      // Leaf lines come before the subtotal and are not totals.
      expect(grid.rowLeaves[0]!.isTotal).toBeFalsy();
      expect(grid.rowLeaves[1]!.isTotal).toBeFalsy();
    });

    it("showTotals 'off' suppresses classic subtotal lines but keeps the grand total", () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [revenueSum],
        },
        options: { grid: { type: 'classic', showTotals: 'off' } },
      });
      const captions = grid.rowLeaves.map((l) => l.caption);
      // Only leaves + grand total, no per-group subtotal rows.
      expect(captions).toEqual(['Bikes', 'Cars', 'Bikes', 'Cars', 'Grand Total']);
      expect(grid.rowLeaves.some((l) => l.isTotal)).toBe(false);
      expect(grid.rowLeaves.filter((l) => l.isGrandTotal)).toHaveLength(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Flat grid type: only leaves, no subtotals                           */
  /* ------------------------------------------------------------------ */
  describe('flat grid', () => {
    it('emits only the deepest leaves with no subtotal lines', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [revenueSum],
        },
        options: { grid: { type: 'flat' } },
      });
      // No subtotal rows at all.
      expect(grid.rowLeaves.some((l) => l.isTotal)).toBe(false);
      // The four leaf combinations + the appended grand total row.
      const nonGrand = grid.rowLeaves.filter((l) => !l.isGrandTotal);
      expect(nonGrand).toHaveLength(4);
      // Every leaf is at the deepest level (level 1 for a 2-field axis).
      for (const leaf of nonGrand) expect(leaf.level).toBe(1);
    });

    it('flat leaves carry the full deepest-level value (no parent aggregation)', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [revenueSum],
        },
        options: { grid: { type: 'flat', showGrandTotals: 'off' } },
      });
      const col0 = grid.columnLeaves[0]!;
      const values = grid.rowLeaves.map((l) => grid.getCell(l, col0, grid.measures[0]!).value);
      // Canada/Bikes 200, Canada/Cars 300, USA/Bikes 50, USA/Cars 300.
      expect(values.sort((a, b) => (a as number) - (b as number))).toEqual([50, 200, 300, 300]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* meta counts                                                         */
  /* ------------------------------------------------------------------ */
  describe('meta counts', () => {
    it('reports type, field counts, measure count and total rows/cols (compact, with grand totals)', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          columns: [{ uniqueName: 'category' }],
          measures: [revenueSum, unitsSum],
        },
      });
      expect(grid.meta.type).toBe<GridType>('compact');
      expect(grid.meta.rowFieldCount).toBe(2);
      expect(grid.meta.columnFieldCount).toBe(1);
      expect(grid.meta.measureCount).toBe(2);
      // totalRows == number of visible row leaves.
      expect(grid.meta.totalRows).toBe(grid.rowLeaves.length);
      // totalColumns == columnLeaves * max(1, measures).
      expect(grid.meta.totalColumns).toBe(grid.columnLeaves.length * 2);
    });

    it('uses max(1, measures) for totalColumns when there are no measures', () => {
      const grid = gridFor({
        slice: { rows: [{ uniqueName: 'country' }], columns: [{ uniqueName: 'category' }] },
      });
      expect(grid.meta.measureCount).toBe(0);
      expect(grid.meta.totalColumns).toBe(grid.columnLeaves.length * 1);
    });

    it('counts an implicit single line when an axis has no fields', () => {
      const grid = gridFor({ slice: { measures: [revenueSum] } });
      expect(grid.meta.rowFieldCount).toBe(0);
      expect(grid.meta.columnFieldCount).toBe(0);
      expect(grid.meta.totalRows).toBe(1);
      expect(grid.rowLeaves).toHaveLength(1);
      // No grand-total entries when an axis has no fields.
      expect(grid.rowLeaves.some((l) => l.isGrandTotal)).toBe(false);
      expect(grid.columnLeaves.some((l) => l.isGrandTotal)).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Multiple measures: body width = rows * cols * measures              */
  /* ------------------------------------------------------------------ */
  describe('multiple measures body shape', () => {
    it('produces a body of rowLeaves rows, each cols*measures wide', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [revenueSum, unitsSum],
        },
      });
      const rows = grid.rowLeaves.length;
      const cols = grid.columnLeaves.length;
      const measures = grid.measures.length;
      expect(measures).toBe(2);
      expect(grid.body).toHaveLength(rows);
      for (const rowArr of grid.body) {
        expect(rowArr).toHaveLength(cols * measures);
      }
    });

    it('interleaves measures per column in body order', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }],
          measures: [revenueSum, unitsSum],
        },
        options: { grid: { showGrandTotals: 'off' } },
      });
      // rows: Canada, USA. one column (grand). 2 measures.
      const canadaIdx = grid.rowLeaves.findIndex((l) => l.caption === 'Canada');
      const rowArr = grid.body[canadaIdx]!;
      expect(rowArr).toHaveLength(2);
      // Order matches the measures order: revenue then units.
      expect(rowArr[0]!.measure).toBe('revenue');
      expect(rowArr[1]!.measure).toBe('units');
      expect(rowArr[0]!.value).toBe(CANADA_REVENUE); // 300+80+120
      expect(rowArr[1]!.value).toBe(4 + 8 + 10); // Canada units = 22
    });

    it('an inactive measure is excluded from the measure count and body width', () => {
      const grid = gridFor({
        slice: {
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [revenueSum, { uniqueName: 'units', aggregation: 'sum', active: false }],
        },
      });
      expect(grid.measures).toHaveLength(1);
      expect(grid.meta.measureCount).toBe(1);
      expect(grid.body[0]!).toHaveLength(grid.columnLeaves.length * 1);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Edge cases: empty data                                              */
  /* ------------------------------------------------------------------ */
  describe('empty data', () => {
    it('produces an empty member tree but still appends grand totals', () => {
      const dataset = new Dataset({ data: [] });
      const grid = buildGrid(dataset, {
        dataSource: { data: [] },
        slice: {
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [revenueSum],
        },
      });
      // No members exist, so only the appended grand-total entries remain.
      expect(grid.rowLeaves.every((l) => l.isGrandTotal)).toBe(true);
      expect(grid.rowLeaves).toHaveLength(1);
      expect(grid.columnLeaves).toHaveLength(1);
      // Grand total over no records is null for a sum.
      const cell = grid.getCell(grid.rowLeaves[0]!, grid.columnLeaves[0]!, grid.measures[0]!);
      expect(cell.value).toBeNull();
    });
  });
});
