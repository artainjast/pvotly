import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { ConditionalFormat } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'conditional',
  title: 'Conditional formatting',
  description:
    'Color cells by value: high revenue turns green, low revenue turns red. Conditions are scoped to the Revenue measure so totals stay readable. Open the "Conditional" toolbar button to add or edit rules live.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
  conditions={[
    {
      measure: 'revenue',
      condition: { op: '>', value: 25000 },
      format: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 },
    },
    {
      measure: 'revenue',
      condition: { op: 'between', from: 0, to: 8000 },
      format: { backgroundColor: '#fee2e2', color: '#991b1b' },
    },
  ]}
/>`,
};

// Two thresholds drive both swatches: cells above `high` go green,
// cells below `low` go red, everything in between is left untouched.
const PRESETS = {
  balanced: { low: 8000, high: 25000 },
  strict: { low: 4000, high: 32000 },
  lenient: { low: 12000, high: 18000 },
} as const;

type PresetId = keyof typeof PRESETS;

export default function Conditional() {
  const [preset, setPreset] = useState<PresetId>('balanced');
  const { low, high } = PRESETS[preset];

  const conditions = useMemo<ConditionalFormat[]>(
    () => [
      {
        measure: 'revenue',
        condition: { op: '>', value: high },
        format: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 },
      },
      {
        measure: 'revenue',
        condition: { op: 'between', from: 0, to: low },
        format: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 },
      },
    ],
    [low, high],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="cf-preset" style={{ fontSize: 14, fontWeight: 600 }}>
          Thresholds
        </label>
        <select
          id="cf-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value as PresetId)}
          style={{ padding: '4px 8px', borderRadius: 6 }}
        >
          <option value="balanced">Balanced</option>
          <option value="strict">Strict (wider gap)</option>
          <option value="lenient">Lenient (narrow gap)</option>
        </select>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          <span style={{ color: '#991b1b' }}>red ≤ {low.toLocaleString()}</span>
          {'  ·  '}
          <span style={{ color: '#166534' }}>green &gt; {high.toLocaleString()}</span>
        </span>
      </div>
      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
        }}
        conditions={conditions}
      />
    </div>
  );
}
