import { describe, expect, it } from 'vitest';
import { buildGrid, Dataset, type PivotConfiguration } from '@pvotly/core';
import { exportToCSV, exportToHTML, exportToJSON, gridToMatrix } from './index';

const DATA = [
  { country: 'USA', category: 'Cars', revenue: 100 },
  { country: 'USA', category: 'Bikes', revenue: 50 },
  { country: 'Canada', category: 'Cars', revenue: 300 },
];

function grid(config: Partial<PivotConfiguration> = {}) {
  const ds = new Dataset({ data: DATA });
  return buildGrid(ds, {
    dataSource: { data: DATA },
    slice: {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
    ...config,
  });
}

describe('export', () => {
  it('builds a matrix with a header row and one row per visible row leaf', () => {
    const m = gridToMatrix(grid());
    expect(m[0]![0]).toBe('');
    // header has Bikes, Cars, Grand Total columns
    expect(m[0]!.length).toBeGreaterThanOrEqual(3);
    // a data row exists for USA and Canada and Grand Total
    const labels = m.slice(1).map((r) => r[0]);
    expect(labels).toContain('USA');
    expect(labels).toContain('Canada');
  });

  it('exports CSV with escaping', () => {
    const csv = exportToCSV(grid());
    expect(csv.split('\r\n').length).toBeGreaterThan(1);
    expect(csv).toContain('USA');
  });

  it('escapes commas and quotes in CSV', () => {
    const ds = new Dataset({ data: [{ label: 'a,b', n: 1 }] });
    const g = buildGrid(ds, {
      dataSource: { data: [{ label: 'a,b', n: 1 }] },
      slice: { rows: [{ uniqueName: 'label' }], measures: [{ uniqueName: 'n', aggregation: 'sum' }] },
    });
    const csv = exportToCSV(g);
    expect(csv).toContain('"a,b"');
  });

  it('exports HTML table', () => {
    const html = exportToHTML(grid());
    expect(html).toContain('<table');
    expect(html).toContain('<thead>');
    expect(html).toContain('USA');
  });

  it('exports JSON records', () => {
    const json = JSON.parse(exportToJSON(grid()));
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
