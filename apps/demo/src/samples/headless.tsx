import { useState } from 'react';
import { usePivotEngine } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'headless',
  title: 'Headless engine',
  description:
    'Drive the engine with usePivotEngine and render your OWN HTML table from grid.rowLeaves / grid.columnLeaves / grid.getCell — no bundled UI. Switch the row field to see the grid recompute.',
  group: 'Frameworks',
  code: `import { usePivotEngine } from '@pvotly/react';

function CustomTable() {
  const { grid } = usePivotEngine({
    dataSource: { data: SALES },
    slice: {
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
  });

  return (
    <table>
      <thead>
        <tr>
          <th />
          {grid.columnLeaves.map((col, i) =>
            grid.measures.map((m) => (
              <th key={i + m.uniqueName}>{m.caption ?? m.uniqueName}</th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {grid.rowLeaves.map((row, r) => (
          <tr key={r}>
            <th>{row.caption}</th>
            {grid.columnLeaves.map((col, c) =>
              grid.measures.map((m) => (
                <td key={c + m.uniqueName}>
                  {grid.getCell(row, col, m).formatted}
                </td>
              )),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}`,
};

type RowField = 'country' | 'category' | 'channel';

export default function Headless() {
  const [field, setField] = useState<RowField>('country');

  const { grid } = usePivotEngine({
    dataSource: { data: SALES },
    slice: {
      rows: [{ uniqueName: field }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
  });

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
    <div style={{ height: 460, overflow: 'auto' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="headless-field" style={{ fontSize: 14 }}>
          Group rows by:
        </label>
        <select
          id="headless-field"
          value={field}
          onChange={(e) => setField(e.target.value as RowField)}
          style={{ padding: '4px 8px' }}
        >
          <option value="country">Country</option>
          <option value="category">Category</option>
          <option value="channel">Channel</option>
        </select>
      </div>

      <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={headStyle}>{field}</th>
            {grid.columnLeaves.flatMap((col, c) =>
              grid.measures.map((m) => (
                <th key={`h-${c}-${m.uniqueName}`} style={{ ...headStyle, textAlign: 'right' }}>
                  {m.caption ?? m.uniqueName}
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
    </div>
  );
}
