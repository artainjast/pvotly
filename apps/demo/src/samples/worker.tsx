import { useMemo, useRef, useState } from 'react';
import { PivotEngine } from '@pvotly/core';
import type { DataRecord, PivotGrid } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'worker',
  title: 'Web Worker aggregation',
  description:
    'For heavy datasets, engine.getGridAsync() can build the grid off the main thread. Set options.useWorker and wire options.worker.factory to a Worker; the engine ships the ingested records to the worker, runs the same buildGrid there, and re-hydrates the result — gracefully falling back to an on-thread build when workers are unavailable. Toggle the worker on/off and rebuild to compare timings. The engine reuses the ingested dataset across rebuilds (incremental), so only the aggregation re-runs.',
  group: 'Features',
  code: `import { PivotEngine } from '@pvotly/core';

const engine = new PivotEngine({
  dataSource: { data: rows }, // 100k rows
  slice: { rows: [{ uniqueName: 'country' }], columns: [{ uniqueName: 'category' }],
           measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
  options: {
    useWorker: true,
    worker: {
      // Bundler-aware factory (Vite shown). Or pass { url } to a built worker.
      factory: () => new Worker(new URL('../pivot.worker.ts', import.meta.url), { type: 'module' }),
    },
  },
});

const grid = await engine.getGridAsync(); // built in the worker, then re-hydrated`,
};

const COUNTRIES = ['USA', 'Canada', 'Germany', 'France', 'Japan'];
const CATEGORIES = ['Cars', 'Bikes', 'Accessories', 'Parts'];

function generate(rowCount: number): DataRecord[] {
  const rows: DataRecord[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const units = (i % 40) + 1;
    const price = ((i * 7919) % 900) + 100;
    rows[i] = {
      country: COUNTRIES[i % COUNTRIES.length]!,
      category: CATEGORIES[(i >> 1) % CATEGORIES.length]!,
      units,
      revenue: units * price,
    };
  }
  return rows;
}

export default function Worker_() {
  const [rowCount] = useState(100_000);
  const [useWorker, setUseWorker] = useState(true);
  const [grid, setGrid] = useState<PivotGrid | null>(null);
  const [timing, setTiming] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const engineRef = useRef<PivotEngine | null>(null);

  const data = useMemo(() => generate(rowCount), [rowCount]);

  const run = async (worker: boolean) => {
    setBusy(true);
    engineRef.current?.dispose();
    const engine = new PivotEngine({
      dataSource: { data },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [
          { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
          { uniqueName: 'units', aggregation: 'sum', caption: 'Units' },
        ],
      },
      options: worker
        ? {
            useWorker: true,
            worker: {
              factory: () => new Worker(new URL('../pivot.worker.ts', import.meta.url), { type: 'module' }),
            },
          }
        : {},
    });
    engineRef.current = engine;
    const start = performance.now();
    const result = await engine.getGridAsync();
    const ms = performance.now() - start;
    setGrid(result);
    setTiming(
      `${data.length.toLocaleString()} rows aggregated ${worker ? 'in a Web Worker' : 'on the main thread'} in ${ms.toFixed(0)} ms`,
    );
    setBusy(false);
  };

  const cellStyle: React.CSSProperties = {
    border: '1px solid var(--ph-border, #e2e8f0)',
    padding: '6px 12px',
    textAlign: 'right',
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left',
    fontWeight: 600,
    background: 'var(--ph-head-bg, #f8fafc)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} />
          Use Web Worker
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(useWorker)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          {busy ? 'Building…' : `Build grid from ${rowCount.toLocaleString()} rows`}
        </button>
        {timing && <span style={{ opacity: 0.75 }}>{timing}</span>}
      </div>

      {grid ? (
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={headStyle}>country</th>
              {grid.columnLeaves.flatMap((col, c) =>
                grid.measures.map((m) => (
                  <th key={`h-${c}-${m.uniqueName}`} style={{ ...headStyle, textAlign: 'right' }}>
                    {col.caption} · {m.caption ?? m.uniqueName}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {grid.rowLeaves.map((row, r) => (
              <tr key={`r-${r}`}>
                <th style={headStyle}>{row.caption}</th>
                {grid.columnLeaves.flatMap((col, c) =>
                  grid.measures.map((m) => (
                    <td key={`c-${r}-${c}-${m.uniqueName}`} style={cellStyle}>
                      {grid.getCell(row, col, m).formatted}
                    </td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          style={{
            padding: '40px 16px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
            borderRadius: 8,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          Click “Build grid” to aggregate {rowCount.toLocaleString()} rows{' '}
          {useWorker ? 'in a background thread' : 'on the main thread'}.
        </div>
      )}
    </div>
  );
}
