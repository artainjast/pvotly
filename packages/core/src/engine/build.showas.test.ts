import { describe, expect, it } from 'vitest';
import { Dataset } from '../data/dataset';
import { buildGrid } from './build';
import { SALES } from '../__fixtures__/sales';
import type { HeaderNode, MeasureConfig, PivotConfiguration, ShowDataAs } from '../types';

/* -------------------------------------------------------------------------- *
 * SALES fixture, rows[country] x cols[category], measure = sum(revenue).
 *
 * Base (raw) revenue cells:
 *                Bikes   Cars   (Grand)
 *   Canada        200     300     500
 *   USA            50     300     350
 *   (Grand)       250     600     850
 *
 *   Canada/Bikes = 80 + 120 = 200
 *   Canada/Cars  = 300
 *   USA/Bikes    = 50
 *   USA/Cars     = 100 + 200 = 300
 *
 * Members sort ascending by default => row order Canada, USA, Grand Total;
 * column order Bikes, Cars, Grand Total. (Single-level axes carry no subtotals.)
 * -------------------------------------------------------------------------- */

const RAW = {
  canadaBikes: 200,
  canadaCars: 300,
  canadaTotal: 500,
  usaBikes: 50,
  usaCars: 300,
  usaTotal: 350,
  bikesTotal: 250,
  carsTotal: 600,
  grand: 850,
};

function gridFor(showDataAs: ShowDataAs) {
  const dataset = new Dataset({ data: SALES });
  const measure: MeasureConfig = { uniqueName: 'revenue', aggregation: 'sum', showDataAs };
  const config: PivotConfiguration = {
    dataSource: { data: SALES },
    slice: {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [measure],
    },
  };
  return buildGrid(dataset, config);
}

function leaf(leaves: HeaderNode[], caption: string): HeaderNode {
  const found = leaves.find((l) => l.caption === caption);
  if (!found) throw new Error(`leaf not found: ${caption}`);
  return found;
}

describe('buildGrid showDataAs (rows[country] x cols[category], sum revenue)', () => {
  /* ------------------------------------------------------------------ */
  /* Sanity: the raw grid we base every transform on                     */
  /* ------------------------------------------------------------------ */
  it('raw grid has the expected layout and base values', () => {
    const grid = gridFor('raw');
    expect(grid.rowLeaves.map((l) => l.caption)).toEqual(['Canada', 'USA', 'Grand Total']);
    expect(grid.columnLeaves.map((l) => l.caption)).toEqual(['Bikes', 'Cars', 'Grand Total']);

    const m = grid.measures[0]!;
    const canada = leaf(grid.rowLeaves, 'Canada');
    const usa = leaf(grid.rowLeaves, 'USA');
    const rGrand = leaf(grid.rowLeaves, 'Grand Total');
    const bikes = leaf(grid.columnLeaves, 'Bikes');
    const cars = leaf(grid.columnLeaves, 'Cars');
    const cGrand = leaf(grid.columnLeaves, 'Grand Total');

    expect(grid.getCell(canada, bikes, m).value).toBe(RAW.canadaBikes);
    expect(grid.getCell(canada, cars, m).value).toBe(RAW.canadaCars);
    expect(grid.getCell(usa, bikes, m).value).toBe(RAW.usaBikes);
    expect(grid.getCell(usa, cars, m).value).toBe(RAW.usaCars);
    expect(grid.getCell(canada, cGrand, m).value).toBe(RAW.canadaTotal);
    expect(grid.getCell(usa, cGrand, m).value).toBe(RAW.usaTotal);
    expect(grid.getCell(rGrand, bikes, m).value).toBe(RAW.bikesTotal);
    expect(grid.getCell(rGrand, cars, m).value).toBe(RAW.carsTotal);
    expect(grid.getCell(rGrand, cGrand, m).value).toBe(RAW.grand);
    // raw keeps displayValue == value
    expect(grid.getCell(canada, bikes, m).displayValue).toBe(RAW.canadaBikes);
  });

  /* ------------------------------------------------------------------ */
  /* percentOfGrandTotal                                                 */
  /* ------------------------------------------------------------------ */
  describe('percentOfGrandTotal', () => {
    it('divides every cell by the overall grand total', () => {
      const grid = gridFor('percentOfGrandTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');

      // value is untouched; displayValue is the ratio.
      const cb = grid.getCell(canada, bikes, m);
      expect(cb.value).toBe(RAW.canadaBikes);
      expect(cb.displayValue).toBeCloseTo(RAW.canadaBikes / RAW.grand, 10); // 200/850
      expect(grid.getCell(canada, cars, m).displayValue).toBeCloseTo(RAW.canadaCars / RAW.grand, 10);
      expect(grid.getCell(usa, bikes, m).displayValue).toBeCloseTo(RAW.usaBikes / RAW.grand, 10);
      expect(grid.getCell(usa, cars, m).displayValue).toBeCloseTo(RAW.usaCars / RAW.grand, 10);
    });

    it('the four body leaf cells sum to ~1 (the whole grand total)', () => {
      const grid = gridFor('percentOfGrandTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');
      const sum =
        (grid.getCell(canada, bikes, m).displayValue as number) +
        (grid.getCell(canada, cars, m).displayValue as number) +
        (grid.getCell(usa, bikes, m).displayValue as number) +
        (grid.getCell(usa, cars, m).displayValue as number);
      expect(sum).toBeCloseTo(1, 10);
    });

    it('grand x grand cell is exactly 1 and formatted as a percentage', () => {
      const grid = gridFor('percentOfGrandTotal');
      const m = grid.measures[0]!;
      const rGrand = leaf(grid.rowLeaves, 'Grand Total');
      const cGrand = leaf(grid.columnLeaves, 'Grand Total');
      const cell = grid.getCell(rGrand, cGrand, m);
      expect(cell.displayValue).toBeCloseTo(1, 10);
      // PERCENT_FORMAT => multiply by 100, 2 decimals, trailing %.
      expect(cell.formatted).toBe('100.00%');
      expect(cell.formatted).toContain('%');
    });

    it('a typical cell is formatted as a percentage string', () => {
      const grid = gridFor('percentOfGrandTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      // 200/850 = 0.235294... -> 23.53%
      expect(grid.getCell(canada, bikes, m).formatted).toBe('23.53%');
      expect(grid.getCell(canada, bikes, m).formatted).toContain('%');
    });
  });

  /* ------------------------------------------------------------------ */
  /* percentOfRowTotal                                                   */
  /* ------------------------------------------------------------------ */
  describe('percentOfRowTotal', () => {
    it('divides each cell by its own row total', () => {
      const grid = gridFor('percentOfRowTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');

      expect(grid.getCell(canada, bikes, m).displayValue).toBeCloseTo(RAW.canadaBikes / RAW.canadaTotal, 10); // 200/500
      expect(grid.getCell(canada, cars, m).displayValue).toBeCloseTo(RAW.canadaCars / RAW.canadaTotal, 10); // 300/500
      expect(grid.getCell(usa, bikes, m).displayValue).toBeCloseTo(RAW.usaBikes / RAW.usaTotal, 10); // 50/350
      expect(grid.getCell(usa, cars, m).displayValue).toBeCloseTo(RAW.usaCars / RAW.usaTotal, 10); // 300/350
    });

    it('the two category leaf cells of each row sum to ~1 across the column axis', () => {
      const grid = gridFor('percentOfRowTotal');
      const m = grid.measures[0]!;
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');
      for (const country of ['Canada', 'USA']) {
        const row = leaf(grid.rowLeaves, country);
        const sum =
          (grid.getCell(row, bikes, m).displayValue as number) +
          (grid.getCell(row, cars, m).displayValue as number);
        expect(sum).toBeCloseTo(1, 10);
      }
    });

    it('formats as a percentage', () => {
      const grid = gridFor('percentOfRowTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      // 200/500 = 0.4 -> 40.00%
      expect(grid.getCell(canada, bikes, m).formatted).toBe('40.00%');
      expect(grid.getCell(canada, bikes, m).formatted).toContain('%');
    });
  });

  /* ------------------------------------------------------------------ */
  /* percentOfColumnTotal                                                */
  /* ------------------------------------------------------------------ */
  describe('percentOfColumnTotal', () => {
    it('divides each cell by its own column total', () => {
      const grid = gridFor('percentOfColumnTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');

      expect(grid.getCell(canada, bikes, m).displayValue).toBeCloseTo(RAW.canadaBikes / RAW.bikesTotal, 10); // 200/250
      expect(grid.getCell(usa, bikes, m).displayValue).toBeCloseTo(RAW.usaBikes / RAW.bikesTotal, 10); // 50/250
      expect(grid.getCell(canada, cars, m).displayValue).toBeCloseTo(RAW.canadaCars / RAW.carsTotal, 10); // 300/600
      expect(grid.getCell(usa, cars, m).displayValue).toBeCloseTo(RAW.usaCars / RAW.carsTotal, 10); // 300/600
    });

    it('the two country leaf cells of each column sum to ~1 across the row axis', () => {
      const grid = gridFor('percentOfColumnTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      for (const category of ['Bikes', 'Cars']) {
        const col = leaf(grid.columnLeaves, category);
        const sum =
          (grid.getCell(canada, col, m).displayValue as number) +
          (grid.getCell(usa, col, m).displayValue as number);
        expect(sum).toBeCloseTo(1, 10);
      }
    });

    it('formats as a percentage', () => {
      const grid = gridFor('percentOfColumnTotal');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      // 200/250 = 0.8 -> 80.00%
      expect(grid.getCell(canada, bikes, m).formatted).toBe('80.00%');
      expect(grid.getCell(canada, bikes, m).formatted).toContain('%');
    });
  });

  /* ------------------------------------------------------------------ */
  /* runningTotalInColumn (cumulative down each column, top->bottom)     */
  /* ------------------------------------------------------------------ */
  describe('runningTotalInColumn', () => {
    it('accumulates down each column in row order (Canada, USA, Grand)', () => {
      const grid = gridFor('runningTotalInColumn');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const rGrand = leaf(grid.rowLeaves, 'Grand Total');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');

      // Bikes column: 200, 200+50=250, 250+250(col grand)=500.
      expect(grid.getCell(canada, bikes, m).displayValue).toBe(RAW.canadaBikes); // 200
      expect(grid.getCell(usa, bikes, m).displayValue).toBe(RAW.canadaBikes + RAW.usaBikes); // 250
      expect(grid.getCell(rGrand, bikes, m).displayValue).toBe(
        RAW.canadaBikes + RAW.usaBikes + RAW.bikesTotal,
      ); // 500

      // Cars column: 300, 300+300=600, 600+600(col grand)=1200.
      expect(grid.getCell(canada, cars, m).displayValue).toBe(RAW.canadaCars); // 300
      expect(grid.getCell(usa, cars, m).displayValue).toBe(RAW.canadaCars + RAW.usaCars); // 600
      expect(grid.getCell(rGrand, cars, m).displayValue).toBe(
        RAW.canadaCars + RAW.usaCars + RAW.carsTotal,
      ); // 1200
    });

    it('the running total is monotonically non-decreasing down the column', () => {
      const grid = gridFor('runningTotalInColumn');
      const m = grid.measures[0]!;
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const seq = grid.rowLeaves.map((r) => grid.getCell(r, bikes, m).displayValue as number);
      for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThanOrEqual(seq[i - 1]!);
    });

    it('skips subtotal lines in a multi-level axis (no double-count)', () => {
      // rows[country > category], classic layout with row subtotals on. A
      // subtotal is the aggregate of its leaves, so it must NOT be folded into
      // the running total — otherwise its children get counted twice.
      const dataset = new Dataset({ data: SALES });
      const grid = buildGrid(dataset, {
        dataSource: { data: SALES },
        slice: {
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'runningTotalInColumn' }],
        },
        options: { grid: { type: 'classic', showTotals: 'rows' } },
      });
      const m = grid.measures[0]!;
      const col = grid.columnLeaves[0]!; // implicit single "all" column

      // Leaf order (asc): Canada/Bikes 200, Canada/Cars 300, USA/Bikes 50, USA/Cars 300.
      // Running total over leaves only: 200, 500, 550, 850 — the Canada subtotal
      // (500) sitting between them is NOT added.
      const leaves = grid.rowLeaves.filter((l) => !l.isTotal && !l.isGrandTotal);
      const seq = leaves.map((l) => grid.getCell(l, col, m).displayValue as number);
      expect(seq).toEqual([200, 500, 550, 850]);

      // Subtotal lines keep their own raw aggregate (untouched by the running pass).
      const canadaSub = grid.rowLeaves.find((l) => l.caption === 'Canada' && l.isTotal);
      expect(canadaSub).toBeDefined();
      expect(grid.getCell(canadaSub!, col, m).displayValue).toBe(RAW.canadaTotal); // 500
    });
  });

  /* ------------------------------------------------------------------ */
  /* runningTotalInRow (cumulative across each row, left->right)         */
  /* ------------------------------------------------------------------ */
  describe('runningTotalInRow', () => {
    it('accumulates across each row in column order (Bikes, Cars, Grand)', () => {
      const grid = gridFor('runningTotalInRow');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');
      const cGrand = leaf(grid.columnLeaves, 'Grand Total');

      // Canada row: 200, 200+300=500, 500+500(row grand)=1000.
      expect(grid.getCell(canada, bikes, m).displayValue).toBe(RAW.canadaBikes); // 200
      expect(grid.getCell(canada, cars, m).displayValue).toBe(RAW.canadaBikes + RAW.canadaCars); // 500
      expect(grid.getCell(canada, cGrand, m).displayValue).toBe(
        RAW.canadaBikes + RAW.canadaCars + RAW.canadaTotal,
      ); // 1000

      // USA row: 50, 50+300=350, 350+350(row grand)=700.
      expect(grid.getCell(usa, bikes, m).displayValue).toBe(RAW.usaBikes); // 50
      expect(grid.getCell(usa, cars, m).displayValue).toBe(RAW.usaBikes + RAW.usaCars); // 350
      expect(grid.getCell(usa, cGrand, m).displayValue).toBe(
        RAW.usaBikes + RAW.usaCars + RAW.usaTotal,
      ); // 700
    });
  });

  /* ------------------------------------------------------------------ */
  /* rankInColumn (1-based, by value desc, within each column)           */
  /* ------------------------------------------------------------------ */
  describe('rankInColumn', () => {
    it('ranks rows 1-based by descending value within each column', () => {
      const grid = gridFor('rankInColumn');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const rGrand = leaf(grid.rowLeaves, 'Grand Total');
      const bikes = leaf(grid.columnLeaves, 'Bikes');

      // Bikes column raw values: Canada 200, USA 50, Grand 250.
      // Desc order: Grand(250) -> 1, Canada(200) -> 2, USA(50) -> 3.
      expect(grid.getCell(rGrand, bikes, m).displayValue).toBe(1);
      expect(grid.getCell(canada, bikes, m).displayValue).toBe(2);
      expect(grid.getCell(usa, bikes, m).displayValue).toBe(3);
    });

    it('handles ties by assigning sequential distinct ranks (Cars column)', () => {
      const grid = gridFor('rankInColumn');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const rGrand = leaf(grid.rowLeaves, 'Grand Total');
      const cars = leaf(grid.columnLeaves, 'Cars');

      // Cars column raw values: Canada 300, USA 300 (tie), Grand 600.
      // Grand(600) -> 1. The two 300s get ranks 2 and 3 (distinct, stable sort).
      expect(grid.getCell(rGrand, cars, m).displayValue).toBe(1);
      const ranks = [
        grid.getCell(canada, cars, m).displayValue as number,
        grid.getCell(usa, cars, m).displayValue as number,
      ].sort((a, b) => a - b);
      expect(ranks).toEqual([2, 3]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* rankInRow (1-based, by value desc, within each row)                 */
  /* ------------------------------------------------------------------ */
  describe('rankInRow', () => {
    it('ranks columns 1-based by descending value within each row', () => {
      const grid = gridFor('rankInRow');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');
      const cGrand = leaf(grid.columnLeaves, 'Grand Total');

      // Canada row: Bikes 200, Cars 300, Grand 500.
      // Desc: Grand(500)->1, Cars(300)->2, Bikes(200)->3.
      expect(grid.getCell(canada, cGrand, m).displayValue).toBe(1);
      expect(grid.getCell(canada, cars, m).displayValue).toBe(2);
      expect(grid.getCell(canada, bikes, m).displayValue).toBe(3);

      // USA row: Bikes 50, Cars 300, Grand 350.
      // Desc: Grand(350)->1, Cars(300)->2, Bikes(50)->3.
      expect(grid.getCell(usa, cGrand, m).displayValue).toBe(1);
      expect(grid.getCell(usa, cars, m).displayValue).toBe(2);
      expect(grid.getCell(usa, bikes, m).displayValue).toBe(3);
    });
  });

  /* ------------------------------------------------------------------ *
   * differenceFromPrevRow — null in the FIRST ROW, delta stepping down rows
   * (computed independently per column).
   * ------------------------------------------------------------------ */
  describe('differenceFromPrevRow', () => {
    it('is null for the first row and the delta from the previous row (per column)', () => {
      const grid = gridFor('differenceFromPrevRow');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada'); // first row (asc)
      const usa = leaf(grid.rowLeaves, 'USA');
      const rGrand = leaf(grid.rowLeaves, 'Grand Total');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');

      // Bikes column: Canada(first row)=null, USA=50-200=-150, Grand=250-50=200.
      expect(grid.getCell(canada, bikes, m).displayValue).toBeNull();
      expect(grid.getCell(usa, bikes, m).displayValue).toBeCloseTo(RAW.usaBikes - RAW.canadaBikes, 10);
      expect(grid.getCell(rGrand, bikes, m).displayValue).toBeCloseTo(RAW.bikesTotal - RAW.usaBikes, 10);

      // Cars column: Canada(first row)=null, USA=300-300=0, Grand=600-300=300.
      expect(grid.getCell(canada, cars, m).displayValue).toBeNull();
      expect(grid.getCell(usa, cars, m).displayValue).toBeCloseTo(RAW.usaCars - RAW.canadaCars, 10);
      expect(grid.getCell(rGrand, cars, m).displayValue).toBeCloseTo(RAW.carsTotal - RAW.usaCars, 10);
    });
  });

  /* ------------------------------------------------------------------ *
   * differenceFromPrevColumn — null in the FIRST COLUMN, delta stepping
   * right (computed independently per row).
   * ------------------------------------------------------------------ */
  describe('differenceFromPrevColumn', () => {
    it('is null for the first column and the delta from the previous column (per row)', () => {
      const grid = gridFor('differenceFromPrevColumn');
      const m = grid.measures[0]!;
      const canada = leaf(grid.rowLeaves, 'Canada');
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes'); // first column (asc)
      const cars = leaf(grid.columnLeaves, 'Cars');
      const cGrand = leaf(grid.columnLeaves, 'Grand Total');

      // Canada row: Bikes(first col)=null, Cars=300-200=100, Grand=500-300=200.
      expect(grid.getCell(canada, bikes, m).displayValue).toBeNull();
      expect(grid.getCell(canada, cars, m).displayValue).toBeCloseTo(RAW.canadaCars - RAW.canadaBikes, 10);
      expect(grid.getCell(canada, cGrand, m).displayValue).toBeCloseTo(RAW.canadaTotal - RAW.canadaCars, 10);

      // USA row: Bikes(first col)=null, Cars=300-50=250, Grand=350-300=50.
      expect(grid.getCell(usa, bikes, m).displayValue).toBeNull();
      expect(grid.getCell(usa, cars, m).displayValue).toBeCloseTo(RAW.usaCars - RAW.usaBikes, 10);
      expect(grid.getCell(usa, cGrand, m).displayValue).toBeCloseTo(RAW.usaTotal - RAW.usaCars, 10);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Edge cases                                                          */
  /* ------------------------------------------------------------------ */
  describe('edge cases', () => {
    it('percentOfGrandTotal over empty data yields null display values', () => {
      const dataset = new Dataset({ data: [] });
      const grid = buildGrid(dataset, {
        dataSource: { data: [] },
        slice: {
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'percentOfGrandTotal' }],
        },
      });
      // Only grand-total leaves remain; grand total is null so ratio() returns null.
      const cell = grid.getCell(grid.rowLeaves[0]!, grid.columnLeaves[0]!, grid.measures[0]!);
      expect(cell.displayValue).toBeNull();
    });

    it('rankInColumn with a single row assigns rank 1', () => {
      const dataset = new Dataset({ data: SALES });
      const grid = buildGrid(dataset, {
        dataSource: { data: SALES },
        slice: {
          rows: [{ uniqueName: 'country', filter: { type: 'members', include: ['USA'] } }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'rankInColumn' }],
          // Drop grand totals so each column has exactly one data row (USA).
        },
        options: { grid: { showGrandTotals: 'off' } },
      });
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes');
      const cars = leaf(grid.columnLeaves, 'Cars');
      expect(grid.getCell(usa, bikes, m_unused(grid)).displayValue).toBe(1);
      expect(grid.getCell(usa, cars, m_unused(grid)).displayValue).toBe(1);
    });

    it('differenceFromPrevRow with a single row is null everywhere (no previous row)', () => {
      const dataset = new Dataset({ data: SALES });
      const grid = buildGrid(dataset, {
        dataSource: { data: SALES },
        slice: {
          rows: [{ uniqueName: 'country', filter: { type: 'members', include: ['USA'] } }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'differenceFromPrevRow' }],
        },
        options: { grid: { showGrandTotals: 'off' } },
      });
      const usa = leaf(grid.rowLeaves, 'USA');
      for (const col of grid.columnLeaves) {
        expect(grid.getCell(usa, col, grid.measures[0]!).displayValue).toBeNull();
      }
    });

    it('differenceFromPrevColumn with a single row still steps across columns', () => {
      const dataset = new Dataset({ data: SALES });
      const grid = buildGrid(dataset, {
        dataSource: { data: SALES },
        slice: {
          rows: [{ uniqueName: 'country', filter: { type: 'members', include: ['USA'] } }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'differenceFromPrevColumn' }],
        },
        options: { grid: { showGrandTotals: 'off' } },
      });
      const usa = leaf(grid.rowLeaves, 'USA');
      const bikes = leaf(grid.columnLeaves, 'Bikes'); // first column -> null
      const cars = leaf(grid.columnLeaves, 'Cars');
      expect(grid.getCell(usa, bikes, grid.measures[0]!).displayValue).toBeNull();
      expect(grid.getCell(usa, cars, grid.measures[0]!).displayValue).toBeCloseTo(
        RAW.usaCars - RAW.usaBikes,
        10,
      );
    });
  });
});

// Helper so the single-row rank test reads naturally.
function m_unused(grid: ReturnType<typeof buildGrid>): MeasureConfig {
  return grid.measures[0]!;
}
