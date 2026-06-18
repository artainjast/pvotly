import { describe, expect, it } from 'vitest';
import { Dataset } from '../data/dataset';
import { buildGrid } from './build';
import { SALES } from '../__fixtures__/sales';
import type { HeaderNode, PivotConfiguration } from '../types';

function gridFor(config: Partial<PivotConfiguration>) {
  const dataset = new Dataset({ data: SALES });
  return buildGrid(dataset, { dataSource: { data: SALES }, ...config });
}

function findLeaf(leaves: HeaderNode[], caption: string) {
  return leaves.find((l) => l.caption === caption);
}

describe('buildGrid smoke', () => {
  it('computes grand total sum with no row/col fields', () => {
    const grid = gridFor({
      slice: { measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
    });
    expect(grid.rowLeaves).toHaveLength(1);
    expect(grid.columnLeaves).toHaveLength(1);
    const cell = grid.body[0]![0]!;
    expect(cell.value).toBe(850); // 100+200+50+300+80+120
  });

  it('computes a rows x measures grid with grand total row', () => {
    const grid = gridFor({
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    const usa = findLeaf(grid.rowLeaves, 'USA');
    const canada = findLeaf(grid.rowLeaves, 'Canada');
    const grand = grid.rowLeaves.find((l) => l.isGrandTotal);
    expect(usa).toBeTruthy();
    expect(canada).toBeTruthy();
    expect(grand).toBeTruthy();

    const usaCell = grid.getCell(usa!, grid.columnLeaves[0]!, grid.measures[0]!);
    const grandCell = grid.getCell(grand!, grid.columnLeaves[0]!, grid.measures[0]!);
    expect(usaCell.value).toBe(350); // 100+200+50
    expect(grandCell.value).toBe(850);
  });

  it('cross-tabulates rows x columns', () => {
    const grid = gridFor({
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    const usa = findLeaf(grid.rowLeaves, 'USA')!;
    const cars = findLeaf(grid.columnLeaves, 'Cars')!;
    const bikes = findLeaf(grid.columnLeaves, 'Bikes')!;
    expect(grid.getCell(usa, cars, grid.measures[0]!).value).toBe(300); // 100+200
    expect(grid.getCell(usa, bikes, grid.measures[0]!).value).toBe(50);
  });

  it('supports calculated measures', () => {
    const grid = gridFor({
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [{ uniqueName: 'avgPrice', formula: "sum('revenue') / sum('units')" }],
      },
    });
    const canada = findLeaf(grid.rowLeaves, 'Canada')!;
    // Canada: revenue 300+80+120=500, units 4+8+10=22 -> 22.7272...
    const cell = grid.getCell(canada, grid.columnLeaves[0]!, grid.measures[0]!);
    expect(cell.value).toBeCloseTo(500 / 22, 5);
  });

  it('applies percentOfGrandTotal show-as', () => {
    const grid = gridFor({
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum', showDataAs: 'percentOfGrandTotal' }],
      },
    });
    const usa = findLeaf(grid.rowLeaves, 'USA')!;
    const cell = grid.getCell(usa, grid.columnLeaves[0]!, grid.measures[0]!);
    expect(cell.displayValue).toBeCloseTo(350 / 850, 5);
    expect(cell.formatted).toContain('%');
  });
});
