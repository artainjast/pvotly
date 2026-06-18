import { describe, expect, it } from 'vitest';
import { deserializeGrid, serializeGrid } from './serialize';
import { buildGrid } from './build';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type { PivotConfiguration } from '../types';

function makeGrid() {
  const config: PivotConfiguration = {
    dataSource: { data: SALES },
    slice: {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
  };
  return buildGrid(new Dataset(config.dataSource), config);
}

describe('serializeGrid / deserializeGrid', () => {
  it('drops getCell on serialize', () => {
    const s = serializeGrid(makeGrid());
    expect((s as { getCell?: unknown }).getCell).toBeUndefined();
    expect(s.body.length).toBeGreaterThan(0);
  });

  it('round-trips through structuredClone and rebuilds a working getCell', () => {
    const grid = makeGrid();
    const transferred = structuredClone(serializeGrid(grid));
    const restored = deserializeGrid(transferred);

    const usa = restored.rowLeaves.find((n) => n.value === 'USA')!;
    const cars = restored.columnLeaves.find((n) => n.value === 'Cars')!;
    const cell = restored.getCell(usa, cars, { uniqueName: 'revenue', aggregation: 'sum' });
    expect(cell.value).toBe(300);
  });

  it('returns an empty cell for an unknown coordinate', () => {
    const restored = deserializeGrid(serializeGrid(makeGrid()));
    const cell = restored.getCell(
      { path: [{ uniqueName: 'country', value: 'Nowhere' }] } as never,
      restored.columnLeaves[0]!,
      { uniqueName: 'revenue', aggregation: 'sum' },
    );
    expect(cell.value).toBeNull();
  });
});
