import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { ShowDataAs } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'showas',
  title: 'Show value as',
  description:
    'Country on rows, Category on columns, summed Revenue. Pick a "Show value as" mode to re-display the same aggregation as a percentage, running total, or rank — no data change required.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      {
        uniqueName: 'revenue',
        aggregation: 'sum',
        // swap this to recolor the same numbers as a share / running total / rank
        showDataAs: 'percentOfColumnTotal',
      },
    ],
  }}
/>`,
};

/** The "Show value as" modes exercised by this sample. */
const SHOW_AS_OPTIONS: Array<{ value: ShowDataAs; label: string }> = [
  { value: 'raw', label: 'Raw (no transform)' },
  { value: 'percentOfGrandTotal', label: '% of grand total' },
  { value: 'percentOfRowTotal', label: '% of row total' },
  { value: 'percentOfColumnTotal', label: '% of column total' },
  { value: 'runningTotalInRow', label: 'Running total in row' },
  { value: 'rankInColumn', label: 'Rank in column' },
];

export default function ShowAs() {
  const [showAs, setShowAs] = useState<ShowDataAs>('percentOfColumnTotal');

  return (
    <div>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12,
          fontSize: 14,
        }}
      >
        <span style={{ fontWeight: 600 }}>Show value as</span>
        <select
          value={showAs}
          onChange={(e) => setShowAs(e.target.value as ShowDataAs)}
          style={{ padding: '4px 8px' }}
        >
          {SHOW_AS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [
            {
              uniqueName: 'revenue',
              caption: 'Revenue',
              aggregation: 'sum',
              showDataAs: showAs,
            },
          ],
        }}
      />
    </div>
  );
}
