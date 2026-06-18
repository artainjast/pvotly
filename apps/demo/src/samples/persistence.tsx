import { useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

const HASH_KEY = 'demoState';
const STORAGE_KEY = 'pvotly:demo';

export const meta: SampleMeta = {
  id: 'persistence',
  title: 'Save / restore & undo',
  description:
    'The widget can serialize its whole report + UI state (column sizes, freeze) to localStorage or a compact base64url URL hash, and restore it later — the bulk dataset is stripped so snapshots stay tiny. Every report change is also pushed onto an undo/redo stack. Rearrange fields, sort, or resize, then Save, reload-and-Restore, or Undo/Redo.',
  group: 'Features',
  code: `import { useRef } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import '@pvotly/web/styles.css';

const ref = useRef<PivotTableHandle>(null);
const t = () => ref.current!.instance;

<button onClick={() => t().saveToLocalStorage({ key: 'pvotly:demo' })}>Save</button>
<button onClick={() => t().loadFromLocalStorage('pvotly:demo')}>Restore</button>
<button onClick={() => t().saveToUrlHash({ key: 'demoState' })}>Save to URL</button>
<button onClick={() => t().loadFromUrlHash('demoState')}>Load from URL</button>
<button onClick={() => t().undo()}>Undo</button>
<button onClick={() => t().redo()}>Redo</button>

<PivotTable ref={ref} dataSource={{ data: SALES }} slice={slice} />`,
};

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};

export default function Persistence() {
  const ref = useRef<PivotTableHandle>(null);
  const [status, setStatus] = useState('');

  const t = () => ref.current?.instance;
  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(''), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btn} onClick={() => flash(t()?.saveToLocalStorage({ key: STORAGE_KEY }) ? 'Saved to localStorage' : 'Save failed')}>
          Save (localStorage)
        </button>
        <button style={btn} onClick={() => flash(t()?.loadFromLocalStorage(STORAGE_KEY) ? 'Restored from localStorage' : 'Nothing saved yet')}>
          Restore
        </button>
        <button style={btn} onClick={() => flash(t()?.saveToUrlHash({ key: HASH_KEY }) ? 'Saved to URL hash' : 'Save failed')}>
          Save to URL
        </button>
        <button style={btn} onClick={() => flash(t()?.loadFromUrlHash(HASH_KEY) ? 'Loaded from URL hash' : 'No URL state')}>
          Load from URL
        </button>
        <span style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <button style={btn} onClick={() => flash(t()?.undo() ? 'Undid last change' : 'Nothing to undo')}>
          ↶ Undo
        </button>
        <button style={btn} onClick={() => flash(t()?.redo() ? 'Redid change' : 'Nothing to redo')}>
          ↷ Redo
        </button>
        {status && <span style={{ color: 'var(--ph-accent, #4f7cff)', fontWeight: 600, fontSize: 14 }}>{status}</span>}
      </div>

      <PivotTable
        ref={ref}
        height={440}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
        }}
      />
    </div>
  );
}
