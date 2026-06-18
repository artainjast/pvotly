import { describe, expect, it } from 'vitest';
import { buildGrid } from './build';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type { PivotConfiguration } from '../types';

function grid(valuesAxis: 'columns' | 'rows') {
  const config: PivotConfiguration = {
    dataSource: { data: SALES },
    valuesAxis,
    slice: {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [
        { uniqueName: 'revenue', aggregation: 'sum' },
        { uniqueName: 'units', aggregation: 'sum' },
      ],
    },
  };
  return buildGrid(new Dataset(config.dataSource), config);
}

describe('buildGrid: valuesAxis', () => {
  it("defaults to 'columns' and folds measures into the column dimension", () => {
    const config: PivotConfiguration = {
      dataSource: { data: SALES },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [
          { uniqueName: 'revenue', aggregation: 'sum' },
          { uniqueName: 'units', aggregation: 'sum' },
        ],
      },
    };
    const g = buildGrid(new Dataset(config.dataSource), config);
    expect(g.meta.valuesAxis).toBe('columns');
    // One visual body row per row leaf.
    expect(g.body.length).toBe(g.rowLeaves.length);
    // Each visual row has columnLeaves * measures cells.
    expect(g.body[0]!.length).toBe(g.columnLeaves.length * 2);
  });

  it("'rows' expands each row leaf into one body row per measure", () => {
    const g = grid('rows');
    expect(g.meta.valuesAxis).toBe('rows');
    expect(g.body.length).toBe(g.rowLeaves.length * 2);
    // Each visual row holds exactly one cell per column leaf.
    expect(g.body[0]!.length).toBe(g.columnLeaves.length);
  });

  it('meta row/column counts reflect the axis multiplier', () => {
    const cols = grid('columns');
    const rows = grid('rows');
    expect(cols.meta.totalRows).toBe(cols.rowLeaves.length);
    expect(cols.meta.totalColumns).toBe(cols.columnLeaves.length * 2);
    expect(rows.meta.totalRows).toBe(rows.rowLeaves.length * 2);
    expect(rows.meta.totalColumns).toBe(rows.columnLeaves.length);
  });

  it('produces identical cell values regardless of layout (getCell is axis-agnostic)', () => {
    const cols = grid('columns');
    const rows = grid('rows');
    const rowNode = cols.rowLeaves.find((n) => n.value === 'USA')!;
    const colNode = cols.columnLeaves.find((n) => n.value === 'Cars')!;
    const rowNode2 = rows.rowLeaves.find((n) => n.value === 'USA')!;
    const colNode2 = rows.columnLeaves.find((n) => n.value === 'Cars')!;
    const measure = { uniqueName: 'revenue', aggregation: 'sum' as const };
    expect(cols.getCell(rowNode, colNode, measure).value).toBe(300);
    expect(rows.getCell(rowNode2, colNode2, measure).value).toBe(300);
  });

  it('honors options.grid.measurePosition as an alias when valuesAxis is unset', () => {
    const config: PivotConfiguration = {
      dataSource: { data: SALES },
      options: { grid: { measurePosition: 'rows' } },
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [
          { uniqueName: 'revenue', aggregation: 'sum' },
          { uniqueName: 'units', aggregation: 'sum' },
        ],
      },
    };
    const g = buildGrid(new Dataset(config.dataSource), config);
    expect(g.meta.valuesAxis).toBe('rows');
  });

  it('top-level valuesAxis wins over measurePosition', () => {
    const config: PivotConfiguration = {
      dataSource: { data: SALES },
      valuesAxis: 'columns',
      options: { grid: { measurePosition: 'rows' } },
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    };
    const g = buildGrid(new Dataset(config.dataSource), config);
    expect(g.meta.valuesAxis).toBe('columns');
  });
});
