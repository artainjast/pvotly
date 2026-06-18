import { useEffect, useRef, useState } from 'react';
import {
  PivotEngine,
  Dataset,
  buildGrid,
  type PivotGrid,
  type ServerSidePivotRequest,
  type ServerSideGridResponse,
  type Slice,
} from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'server-side',
  title: 'Server-side mode',
  description:
    'Delegate aggregation to a backend for huge datasets. Provide serverSide.query on the configuration and call engine.getGridAsync() — the engine routes the slice/options to your query instead of building locally, and renders the PivotGrid the server returns. Here a mock "server" runs buildGrid over the data with simulated latency (and logs every request it receives). Change the grouping to fire a new server round-trip.',
  group: 'Data sources',
  code: `import { PivotEngine, Dataset, buildGrid } from '@pvotly/core';

const engine = new PivotEngine({
  dataSource: { data: [] }, // client holds no data in server-side mode
  slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
  serverSide: {
    // Your backend computes the grid. Here we simulate it client-side.
    query: async (request) => {
      const res = await fetch('/api/pivot', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return res.json(); // a serialized PivotGrid
    },
  },
});

const grid = await engine.getGridAsync(); // -> serverSide.query`,
};

type RowField = 'country' | 'category' | 'channel';

// The "server": holds the data and answers pivot requests with a computed grid.
let serverHits = 0;
function makeServerQuery(onHit: (n: number) => void) {
  return async (request: ServerSidePivotRequest): Promise<ServerSideGridResponse> => {
    serverHits += 1;
    onHit(serverHits);
    // Simulate network + compute latency.
    await new Promise((r) => setTimeout(r, 350));
    const dataset = new Dataset(request.dataSource ?? { data: SALES });
    return buildGrid(dataset, {
      dataSource: request.dataSource ?? { data: SALES },
      slice: request.slice,
      options: request.options,
      formats: request.formats,
      conditions: request.conditions,
      valuesAxis: request.valuesAxis,
    });
  };
}

export default function ServerSide() {
  const engineRef = useRef<PivotEngine | null>(null);
  const [field, setField] = useState<RowField>('country');
  const [grid, setGrid] = useState<PivotGrid | null>(null);
  const [hits, setHits] = useState(0);
  const [busy, setBusy] = useState(false);

  if (engineRef.current === null) {
    engineRef.current = new PivotEngine({
      dataSource: { data: SALES },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
      },
      serverSide: { query: makeServerQuery(setHits) },
    });
  }

  useEffect(() => {
    const engine = engineRef.current!;
    const slice: Slice = {
      rows: [{ uniqueName: field }],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
    };
    engine.setSlice(slice);
    let cancelled = false;
    setBusy(true);
    engine.getGridAsync().then((g) => {
      if (!cancelled) {
        setGrid(g);
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [field]);

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
          <span style={{ fontWeight: 600 }}>Group rows by</span>
          <select value={field} onChange={(e) => setField(e.target.value as RowField)} style={{ padding: '4px 8px' }}>
            <option value="country">Country</option>
            <option value="category">Category</option>
            <option value="channel">Channel</option>
          </select>
        </label>
        <span style={{ opacity: 0.7 }}>
          Server requests: <strong>{hits}</strong>
          {busy ? ' · querying…' : ''}
        </span>
      </div>

      <div style={{ height: 420, overflow: 'auto' }}>
        {grid && (
          <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={headStyle}>{field}</th>
                {grid.columnLeaves.flatMap((_col, c) =>
                  grid.measures.map((m) => (
                    <th key={`h-${c}-${m.uniqueName}`} style={{ ...headStyle, textAlign: 'right' }}>
                      {grid.columnLeaves[c]?.caption} · {m.caption ?? m.uniqueName}
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
        )}
      </div>
    </div>
  );
}
