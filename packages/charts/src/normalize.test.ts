import { describe, expect, it } from 'vitest';
import { PivotEngine } from '@pvotly/core';
import { engineToChartData, gridToChartData } from './normalize';

const DATA = [
  { Country: 'USA', Category: 'Cars', Sales: 100, Units: 4 },
  { Country: 'USA', Category: 'Bikes', Sales: 50, Units: 5 },
  { Country: 'Canada', Category: 'Cars', Sales: 300, Units: 6 },
  { Country: 'Canada', Category: 'Bikes', Sales: 80, Units: 2 },
];

function engine(slice: object): PivotEngine {
  return new PivotEngine({ dataSource: { data: DATA }, slice: slice as never });
}

describe('gridToChartData', () => {
  it('produces one category per row leaf and one series per column leaf', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      columns: [{ uniqueName: 'Category' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
    });
    const data = gridToChartData(e.getGrid(), { type: 'bar' });

    expect(data.type).toBe('bar');
    expect(data.categories.sort()).toEqual(['Canada', 'USA']);
    // Two column leaves (Bikes, Cars) => two series.
    expect(data.series.map((s) => s.name).sort()).toEqual(['Bikes', 'Cars']);
    for (const s of data.series) {
      expect(s.values).toHaveLength(data.categories.length);
      expect(s.measure).toBe('Sales');
    }
  });

  it('uses the measure name for a single series with no column dimension', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum', caption: 'Total Sales' }],
    });
    const data = gridToChartData(e.getGrid());

    expect(data.series).toHaveLength(1);
    expect(data.series[0]!.name).toBe('Total Sales');
    // USA = 150, Canada = 380 (order follows the grid)
    const total = data.series[0]!.values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
    expect(total).toBe(530);
  });

  it('emits one series per measure when multiple measures share a single column', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      measures: [
        { uniqueName: 'Sales', aggregation: 'sum' },
        { uniqueName: 'Units', aggregation: 'sum' },
      ],
    });
    const data = gridToChartData(e.getGrid());
    expect(data.series.map((s) => s.measure)).toEqual(['Sales', 'Units']);
  });

  it('can restrict to a subset of measures', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      measures: [
        { uniqueName: 'Sales', aggregation: 'sum' },
        { uniqueName: 'Units', aggregation: 'sum' },
      ],
    });
    const data = gridToChartData(e.getGrid(), { measures: ['Units'] });
    expect(data.series).toHaveLength(1);
    expect(data.series[0]!.measure).toBe('Units');
  });

  it('excludes total leaves by default and computes a non-negative value extent', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      columns: [{ uniqueName: 'Category' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
    });
    const data = gridToChartData(e.getGrid());
    expect(data.categories).not.toContain('Grand Total');
    expect(data.axes.value.min).toBeLessThanOrEqual(0);
    expect(data.axes.value.max).toBeGreaterThan(0);
  });

  it('engineToChartData matches gridToChartData on the live grid', () => {
    const e = engine({
      rows: [{ uniqueName: 'Country' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
    });
    expect(engineToChartData(e)).toEqual(gridToChartData(e.getGrid()));
  });
});
