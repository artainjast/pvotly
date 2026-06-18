import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { FieldFilter, Slice } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'filtering',
  title: 'Filtering',
  description:
    'Restrict which members appear with a member filter (keep only USA & Canada), or keep just the highest performers with a value (Top-N) filter — { type: "value", measure: "revenue", query: { op: "top", count: 2 } }. You can also click the filter icon on any field chip to edit filters interactively.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

// Member filter: keep only USA & Canada on the rows axis
<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [
      {
        uniqueName: 'country',
        filter: { type: 'members', include: ['USA', 'Canada'] },
      },
    ],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
/>

// Value (Top-N) filter: keep the 2 countries with the highest revenue
const valueSlice = {
  rows: [
    {
      uniqueName: 'country',
      filter: {
        type: 'value',
        measure: 'revenue',
        query: { op: 'top', count: 2 },
      },
    },
  ],
  columns: [{ uniqueName: 'category' }],
  measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
};`,
};

type Mode = 'members' | 'topN' | 'none';

const MEMBER_FILTER: FieldFilter = { type: 'members', include: ['USA', 'Canada'] };
const VALUE_FILTER: FieldFilter = {
  type: 'value',
  measure: 'revenue',
  query: { op: 'top', count: 2 },
};

function buildSlice(mode: Mode): Slice {
  return {
    rows: [
      {
        uniqueName: 'country',
        ...(mode === 'members'
          ? { filter: MEMBER_FILTER }
          : mode === 'topN'
            ? { filter: VALUE_FILTER }
            : {}),
      },
    ],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  };
}

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'none', label: 'No filter' },
  { value: 'members', label: 'Members: USA & Canada' },
  { value: 'topN', label: 'Value: Top 2 by revenue' },
];

export default function Filtering() {
  const [mode, setMode] = useState<Mode>('members');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              fontWeight: mode === m.value ? 700 : 400,
              background: mode === m.value ? '#2563eb' : '#fff',
              color: mode === m.value ? '#fff' : '#1e293b',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <PivotTable height={460} dataSource={{ data: SALES }} slice={buildSlice(mode)} />
    </div>
  );
}
