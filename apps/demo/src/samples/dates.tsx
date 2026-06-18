import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'dates',
  title: 'Date grouping',
  description:
    'A single ISO date field becomes a multi-level hierarchy. Declaring dateParts: ["year","quarter","month"] in the mapping lets you reference date.year / date.quarter / date.month as separate fields in the slice.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  // One source "date" field, expanded into Year/Quarter/Month levels.
  dataSource={{
    data: SALES,
    mapping: { date: { type: 'date', dateParts: ['year', 'quarter', 'month'] } },
  }}
  slice={{
    rows: [{ uniqueName: 'date.year' }, { uniqueName: 'date.quarter' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
/>`,
};

type Depth = 'year' | 'quarter' | 'month';

const ROWS: Record<Depth, { uniqueName: string }[]> = {
  year: [{ uniqueName: 'date.year' }],
  quarter: [{ uniqueName: 'date.year' }, { uniqueName: 'date.quarter' }],
  month: [
    { uniqueName: 'date.year' },
    { uniqueName: 'date.quarter' },
    { uniqueName: 'date.month' },
  ],
};

const DEPTHS: { value: Depth; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Year › Quarter' },
  { value: 'month', label: 'Year › Quarter › Month' },
];

export default function Dates() {
  const [depth, setDepth] = useState<Depth>('quarter');

  const slice = useMemo(
    () => ({
      rows: ROWS[depth],
      columns: [{ uniqueName: 'category' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' as const }],
    }),
    [depth],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="date-depth" style={{ fontSize: 14, fontWeight: 600 }}>
          Row hierarchy depth
        </label>
        <select
          id="date-depth"
          value={depth}
          onChange={(e) => setDepth(e.target.value as Depth)}
          style={{ padding: '6px 8px', borderRadius: 6 }}
        >
          {DEPTHS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          The same source field — <code>date</code> — drives every level.
        </span>
      </div>

      <PivotTable
        height={460}
        dataSource={{
          data: SALES,
          mapping: { date: { type: 'date', dateParts: ['year', 'quarter', 'month'] } },
        }}
        slice={slice}
      />
    </div>
  );
}
