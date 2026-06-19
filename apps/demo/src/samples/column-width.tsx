import { useState, type CSSProperties } from 'react';
import { PivotTable } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'column-width',
  title: 'Column width mode',
  description:
    'Control how the table sizes itself horizontally. `fill` (default) stretches the table to its container; `content` sizes it to the sum of its column widths, leaving any slack empty. Drag a column edge to resize, double-click an edge to reset.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  // 'fill' (default) -> table stretches to fill the container
  // 'content'        -> table is exactly as wide as its columns
  options={{ grid: { width: 'content' } }}
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
/>`,
};

export default function ColumnWidth() {
  const [width, setWidth] = useState<'fill' | 'content'>('fill');

  return (
    <div>
      <div style={controls}>
        <label style={ctl}>
          Width mode
          <select value={width} onChange={(e) => setWidth(e.target.value as 'fill' | 'content')}>
            <option value="fill">fill — stretch to container</option>
            <option value="content">content — size to columns</option>
          </select>
        </label>
        <span style={hint}>
          {width === 'fill'
            ? 'Table fills the full width; columns stretch to absorb spare space.'
            : 'Table stops at its columns’ total width — empty space is left on the right.'}
        </span>
      </div>

      {/* The container is wide; with few columns the two modes look different. */}
      <PivotTable
        height={420}
        options={{ grid: { width } }}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
        }}
      />
    </div>
  );
}

const controls: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 14,
  alignItems: 'center',
  marginBottom: 14,
  fontSize: 13,
};
const ctl: CSSProperties = { display: 'inline-flex', gap: 6, alignItems: 'center' };
const hint: CSSProperties = { color: 'var(--ph-fg-muted, #64748b)', fontSize: 12 };
