import { useMemo, useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import type { DataRecord, Slice } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'virtualization',
  title: 'Virtualization (100k rows)',
  description:
    'Set options.virtualization to render only the visible slice of very large grids. Here up to 100,000 source rows aggregate into thousands of expanded row leaves across many columns, yet scrolling stays smooth because off-screen rows/columns are not in the DOM. Freeze the first N value columns to keep them pinned while you scroll horizontally. Toggle virtualization off to feel the difference.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: rows }}   // 100k rows
  freezeColumns={1}             // pin the first value column(s)
  options={{ virtualization: true }}
  slice={{
    rows: [{ uniqueName: 'region' }, { uniqueName: 'customer' }],
    columns: [{ uniqueName: 'product' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    expands: { expandAll: true }, // expand every region -> thousands of rows
  }}
/>`,
};

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const PRODUCTS = ['Widgets', 'Gadgets', 'Gizmos', 'Sprockets', 'Cogs', 'Bolts', 'Nuts', 'Washers'];
const SIZES = [10_000, 50_000, 100_000];

function generate(rowCount: number): DataRecord[] {
  const customers = Math.max(200, Math.floor(rowCount / 12));
  const rows: DataRecord[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const units = (i % 40) + 1;
    const price = ((i * 7919) % 900) + 100;
    rows[i] = {
      region: REGIONS[i % REGIONS.length]!,
      customer: `C${(i * 2654435761) % customers}`,
      product: PRODUCTS[(i >> 1) % PRODUCTS.length]!,
      units,
      revenue: units * price,
    };
  }
  return rows;
}

export default function Virtualization() {
  const ref = useRef<PivotTableHandle>(null);
  const [rowCount, setRowCount] = useState(100_000);
  const [virtualized, setVirtualized] = useState(true);
  const [freeze, setFreeze] = useState(1);

  const data = useMemo(() => generate(rowCount), [rowCount]);

  const slice = useMemo<Slice>(
    () => ({
      rows: [{ uniqueName: 'region' }, { uniqueName: 'customer' }],
      columns: [{ uniqueName: 'product' }],
      measures: [
        { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
        { uniqueName: 'units', aggregation: 'sum', caption: 'Units' },
      ],
      expands: { expandAll: true, rows: [], columns: [] },
    }),
    [],
  );

  const setFreezeCols = (n: number) => {
    setFreeze(n);
    ref.current?.instance.freezeColumns(n);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Rows</span>
          <select value={rowCount} onChange={(e) => setRowCount(Number(e.target.value))} style={{ padding: '4px 8px' }}>
            {SIZES.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={virtualized} onChange={(e) => setVirtualized(e.target.checked)} />
          Virtualization
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Freeze columns</span>
          <select value={freeze} onChange={(e) => setFreezeCols(Number(e.target.value))} style={{ padding: '4px 8px' }}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span style={{ opacity: 0.7 }}>{data.length.toLocaleString()} source rows</span>
      </div>

      <PivotTable
        ref={ref}
        height={460}
        freezeColumns={freeze}
        dataSource={{ data }}
        slice={slice}
        options={{ virtualization: virtualized, grid: { type: 'compact' } }}
      />
    </div>
  );
}
