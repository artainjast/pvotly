import { useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'interactions',
  title: 'Select, sort & copy',
  description:
    'The grid is a fully interactive, accessible ARIA grid. Click a column header to sort; drag across cells (or Shift+Arrow) to select a range; press Ctrl/Cmd+C — or use the button — to copy the selection as TSV ready to paste into Excel/Sheets; drag a column border to resize. Arrow keys move the focused cell for keyboard navigation.',
  group: 'Features',
  code: `import { useRef } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import '@pvotly/web/styles.css';

const ref = useRef<PivotTableHandle>(null);

// Copy the current range selection (or focused cell) to the clipboard as TSV.
<button onClick={() => ref.current?.instance.copySelection()}>Copy selection</button>

<PivotTable
  ref={ref}
  freezeColumns={1}
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  }}
/>`,
};

export default function Interactions() {
  const ref = useRef<PivotTableHandle>(null);
  const [status, setStatus] = useState('');

  const copy = async () => {
    const ok = await ref.current?.instance.copySelection();
    setStatus(ok ? 'Selection copied to clipboard (TSV)' : 'Nothing selected — drag across some cells first');
    window.setTimeout(() => setStatus(''), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <button
          type="button"
          onClick={copy}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer' }}
        >
          Copy selection
        </button>
        <span style={{ opacity: 0.7 }}>
          Try: click a header to sort · drag to select · resize a column border
        </span>
        {status && <span style={{ color: 'var(--ph-accent, #4f7cff)', fontWeight: 600 }}>{status}</span>}
      </div>

      <PivotTable
        ref={ref}
        height={460}
        freezeColumns={1}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
          columns: [{ uniqueName: 'category' }],
          measures: [
            { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
            { uniqueName: 'units', aggregation: 'sum', caption: 'Units' },
          ],
        }}
      />
    </div>
  );
}
