import { useEffect, useRef, useState } from 'react';
import { PivotTable } from '@pvotly/web';
import type { DataRecord } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'remote',
  title: 'Async / remote data',
  description:
    'Feed the engine from an async source. dataSource.fetcher (or a declarative dataSource.remote with a URL) is resolved by engine.loadDataSource(); engine.refresh() re-fetches on demand. This sample uses a mock fetcher that simulates network latency and returns fresh randomized numbers each call — hit Refresh, or enable auto-refresh, to watch the pivot recompute. A real remote source can also auto-poll via remote.refreshInterval.',
  group: 'Data sources',
  code: `import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';

const pivot = new PivotTable('#app', {
  dataSource: {
    // A custom async fetcher (GraphQL, SDK, REST — anything returning records).
    fetcher: async () => {
      const res = await fetch('/api/sales');
      return res.json();
    },
    // Or declaratively:
    // remote: { type: 'remote', url: '/api/sales.csv', format: 'csv',
    //           refreshInterval: 5000 },
  },
  slice: {
    rows: [{ uniqueName: 'region' }],
    columns: [{ uniqueName: 'product' }],
    measures: [{ uniqueName: 'sales', aggregation: 'sum' }],
  },
});

await pivot.engine.loadDataSource(); // initial async load
pivot.refresh();                     // paint the freshly loaded data

// Later, re-fetch on demand:
await pivot.engine.refresh();
pivot.refresh();`,
};

const REGIONS = ['North', 'South', 'East', 'West'];
const PRODUCTS = ['Widgets', 'Gadgets', 'Gizmos'];

/** Pretend network call: resolves after a short delay with fresh numbers. */
function mockFetch(seed: number): Promise<DataRecord[]> {
  const rng = (() => {
    let s = (seed * 2654435761) >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
  })();
  const rows: DataRecord[] = [];
  for (const region of REGIONS) {
    for (const product of PRODUCTS) {
      rows.push({
        region,
        product,
        sales: Math.round(1000 + rng() * 9000),
        orders: Math.round(10 + rng() * 90),
      });
    }
  }
  return new Promise((resolve) => setTimeout(() => resolve(rows), 450));
}

export default function Remote() {
  const hostRef = useRef<HTMLDivElement>(null);
  const pivotRef = useRef<PivotTable | null>(null);
  const seedRef = useRef(1);
  const [status, setStatus] = useState('Loading…');
  const [auto, setAuto] = useState(false);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const pivot = new PivotTable(hostRef.current, {
      height: 380,
      dataSource: { fetcher: () => mockFetch(seedRef.current) },
      slice: {
        rows: [{ uniqueName: 'region' }],
        columns: [{ uniqueName: 'product' }],
        measures: [
          { uniqueName: 'sales', aggregation: 'sum', caption: 'Sales' },
          { uniqueName: 'orders', aggregation: 'sum', caption: 'Orders' },
        ],
      },
    });
    pivotRef.current = pivot;

    pivot.engine
      .loadDataSource()
      .then(() => {
        pivot.refresh();
        setStatus('Loaded');
        setLoads((n) => n + 1);
      })
      .catch((err) => setStatus(`Failed: ${String(err)}`));

    return () => pivot.destroy();
  }, []);

  const refresh = async () => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    setStatus('Refreshing…');
    seedRef.current += 1;
    await pivot.engine.refresh();
    pivot.refresh();
    setStatus(`Refreshed (#${seedRef.current})`);
    setLoads((n) => n + 1);
  };

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [auto]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <button
          type="button"
          onClick={refresh}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          ↻ Refresh
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto-refresh (2s)
        </label>
        <span style={{ opacity: 0.7 }}>
          Status: <strong>{status}</strong> · fetches: {loads}
        </span>
      </div>
      <div ref={hostRef} />
    </div>
  );
}
