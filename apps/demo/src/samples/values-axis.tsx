import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { ValuesAxis } from '@pvotly/web';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'values-axis',
  title: 'Values axis',
  description:
    'Move the Values (measures) between the column axis and the row axis. With "columns" (the default) each measure is an innermost column under every column leaf; with "rows" each row leaf expands into one body row per measure. Toggle the buttons to flip the layout live — the engine rebuilds the grid for the new axis.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

// 'columns' (default) or 'rows' — measures laid out along the row axis.
<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  }}
  // valuesAxis flows through the renderer's grid option, which the
  // core build honors (top-level valuesAxis takes precedence when set).
  options={{ grid: { measurePosition: 'rows' } }}
/>`,
};

const AXES: Array<{ value: ValuesAxis; label: string }> = [
  { value: 'columns', label: 'Values on columns' },
  { value: 'rows', label: 'Values on rows' },
];

export default function ValuesAxisSample() {
  const [axis, setAxis] = useState<ValuesAxis>('columns');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Measure layout</span>
        {AXES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAxis(a.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: axis === a.value ? 'var(--ph-accent, #4f7cff)' : '#fff',
              color: axis === a.value ? '#fff' : 'inherit',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [
            { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
            { uniqueName: 'units', aggregation: 'sum', caption: 'Units' },
          ],
        }}
        options={{ grid: { measurePosition: axis } }}
      />
    </div>
  );
}
