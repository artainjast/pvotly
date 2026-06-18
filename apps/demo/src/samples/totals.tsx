import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { GridType } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'totals',
  title: 'Totals & layout',
  description:
    'Switch between compact / classic / flat layouts and toggle grand totals and subtotals. The grid re-renders with the new options object.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  }}
  options={{
    grid: {
      type: 'compact', // 'compact' | 'classic' | 'flat'
      showGrandTotals: 'on', // 'on' | 'off' | 'rows' | 'columns'
      showTotals: 'on', // subtotals — same value set
    },
  }}
/>`,
};

type TotalsMode = 'on' | 'off' | 'rows' | 'columns';

const GRID_TYPES: GridType[] = ['compact', 'classic', 'flat'];
const TOTALS_MODES: TotalsMode[] = ['on', 'off', 'rows', 'columns'];

const controlStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: 12,
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

export default function Totals() {
  const [gridType, setGridType] = useState<GridType>('compact');
  const [showGrandTotals, setShowGrandTotals] = useState<TotalsMode>('on');
  const [showTotals, setShowTotals] = useState<TotalsMode>('on');

  return (
    <div>
      <div style={controlStyle}>
        <label style={labelStyle}>
          <span>Layout</span>
          <select
            value={gridType}
            onChange={(e) => setGridType(e.target.value as GridType)}
          >
            {GRID_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          <span>Grand totals</span>
          <select
            value={showGrandTotals}
            onChange={(e) => setShowGrandTotals(e.target.value as TotalsMode)}
          >
            {TOTALS_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          <span>Subtotals</span>
          <select
            value={showTotals}
            onChange={(e) => setShowTotals(e.target.value as TotalsMode)}
          >
            {TOTALS_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
          columns: [{ uniqueName: 'category' }],
          measures: [
            { uniqueName: 'revenue', aggregation: 'sum' },
            { uniqueName: 'units', aggregation: 'sum' },
          ],
        }}
        options={{
          grid: {
            type: gridType,
            showGrandTotals,
            showTotals,
          },
        }}
      />
    </div>
  );
}
