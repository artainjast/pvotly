import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { DataRecord } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'performance',
  title: 'Large dataset',
  description:
    'A ~20,000-row dataset is generated in the browser and aggregated into a compact pivot. Country › Channel on rows, Category on columns, summing Revenue and Units — proving the engine scales well beyond the demo data.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

// 20k rows generated up front (deterministic loop).
const data = useMemo(() => {
  const rows = [];
  const countries = ['USA', 'Canada', 'Germany', 'France', 'Japan'];
  const categories = ['Cars', 'Bikes', 'Accessories', 'Parts'];
  const channels = ['Online', 'Retail', 'Wholesale'];
  for (let i = 0; i < 20000; i++) {
    rows.push({
      country: countries[i % countries.length],
      category: categories[i % categories.length],
      channel: channels[i % channels.length],
      units: (i % 40) + 1,
      revenue: (((i * 7919) % 5000) + 100),
    });
  }
  return rows;
}, []);

<PivotTable
  dataSource={{ data }}
  slice={{
    rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  }}
  options={{ grid: { type: 'compact' } }}
/>`,
};

const COUNTRIES = ['USA', 'Canada', 'Germany', 'France', 'Japan'];
const CATEGORIES = ['Cars', 'Bikes', 'Accessories', 'Parts'];
const CHANNELS = ['Online', 'Retail', 'Wholesale'];

const SIZES = [5_000, 20_000, 50_000];

function generate(rowCount: number): DataRecord[] {
  const rows: DataRecord[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    // Deterministic, fully data-driven — no Math.random, so reloads are stable.
    const units = (i % 40) + 1;
    const price = ((i * 7919) % 900) + 100;
    rows[i] = {
      country: COUNTRIES[i % COUNTRIES.length]!,
      category: CATEGORIES[(i >> 1) % CATEGORIES.length]!,
      channel: CHANNELS[(i >> 2) % CHANNELS.length]!,
      units,
      price,
      revenue: units * price,
    };
  }
  return rows;
}

export default function Performance() {
  const [rowCount, setRowCount] = useState(20_000);

  const data = useMemo(() => generate(rowCount), [rowCount]);

  const slice = useMemo(
    () => ({
      rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
      columns: [{ uniqueName: 'category' }],
      measures: [
        { uniqueName: 'revenue', aggregation: 'sum' as const },
        { uniqueName: 'units', aggregation: 'sum' as const },
      ],
    }),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="perf-size" style={{ fontSize: 14, fontWeight: 600 }}>
          Row count
        </label>
        <select
          id="perf-size"
          value={rowCount}
          onChange={(e) => setRowCount(Number(e.target.value))}
          style={{ padding: '6px 8px', borderRadius: 6 }}
        >
          {SIZES.map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString()} rows
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          Aggregating <strong>{data.length.toLocaleString()}</strong> source rows into{' '}
          {COUNTRIES.length * CHANNELS.length} row groups × {CATEGORIES.length} columns.
        </span>
      </div>

      <PivotTable
        height={460}
        dataSource={{ data }}
        slice={slice}
        options={{ grid: { type: 'compact' } }}
      />
    </div>
  );
}
