import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { DataRecord, PivotCell } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'drillthrough',
  title: 'Drill-through',
  description:
    'Double-click any revenue value cell to drill through to the underlying source records. The matching rows are listed in the table below the pivot.',
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
  // \`records\` holds every source row behind the cell.
  onCellDoubleClick={({ cell, records }) => {
    console.log(cell.formatted, records);
  }}
/>`,
};

const COLUMNS: Array<keyof DataRecord> = [
  'country',
  'category',
  'channel',
  'date',
  'units',
  'price',
  'revenue',
];

export default function DrillThrough() {
  const [drill, setDrill] = useState<{ cell: PivotCell; records: DataRecord[] } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
        Double-click a value cell to inspect the rows behind it.
      </p>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
        }}
        onCellDoubleClick={({ cell, records }) => setDrill({ cell, records })}
      />

      {drill ? (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 12px',
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <strong style={{ fontSize: 14 }}>
              {drill.records.length} record{drill.records.length === 1 ? '' : 's'} behind{' '}
              {drill.cell.formatted}
            </strong>
            <button
              type="button"
              onClick={() => setDrill(null)}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                padding: '4px 10px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '6px 12px',
                        position: 'sticky',
                        top: 0,
                        background: '#fff',
                        borderBottom: '1px solid #e5e7eb',
                        textTransform: 'capitalize',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drill.records.map((record, i) => (
                  <tr key={i}>
                    {COLUMNS.map((col) => (
                      <td
                        key={col}
                        style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6' }}
                      >
                        {String(record[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
