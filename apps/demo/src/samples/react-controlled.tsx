import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PivotTable } from '@pvotly/react';
import type { Slice } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'react-controlled',
  title: 'Controlled (React)',
  description:
    'A fully controlled pivot: the slice lives in React useState and external buttons mutate it. The component is a pure function of state — toggle a field, swap the axes, or reset, and <PivotTable> re-renders from the new slice.',
  group: 'Frameworks',
  code: `import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { Slice } from '@pvotly/core';
import '@pvotly/web/styles.css';

const INITIAL: Slice = {
  rows: [{ uniqueName: 'country' }],
  columns: [{ uniqueName: 'category' }],
  measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
};

function Controlled() {
  const [slice, setSlice] = useState<Slice>(INITIAL);

  const hasChannel = (slice.rows ?? []).some((r) => r.uniqueName === 'channel');

  const toggleChannel = () =>
    setSlice((s) => ({
      ...s,
      rows: hasChannel
        ? (s.rows ?? []).filter((r) => r.uniqueName !== 'channel')
        : [...(s.rows ?? []), { uniqueName: 'channel' }],
    }));

  const swapAxes = () =>
    setSlice((s) => ({ ...s, rows: s.columns, columns: s.rows }));

  return (
    <>
      <button onClick={toggleChannel}>
        {hasChannel ? 'Remove Channel from rows' : 'Add Channel to rows'}
      </button>
      <button onClick={swapAxes}>Swap rows / columns</button>
      <button onClick={() => setSlice(INITIAL)}>Reset</button>

      <PivotTable dataSource={{ data: SALES }} slice={slice} />
    </>
  );
}`,
};

/** Starting report — the single source of truth this sample drives from state. */
const INITIAL: Slice = {
  rows: [{ uniqueName: 'country' }],
  columns: [{ uniqueName: 'category' }],
  measures: [{ uniqueName: 'revenue', caption: 'Revenue', aggregation: 'sum' }],
};

const btnStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: 14,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
};

export default function ReactControlled() {
  // The whole report definition is React state — the table renders from it.
  const [slice, setSlice] = useState<Slice>(INITIAL);

  const hasChannel = (slice.rows ?? []).some((r) => r.uniqueName === 'channel');

  const toggleChannel = () =>
    setSlice((s) => ({
      ...s,
      rows: hasChannel
        ? (s.rows ?? []).filter((r) => r.uniqueName !== 'channel')
        : [...(s.rows ?? []), { uniqueName: 'channel' }],
    }));

  const swapAxes = () =>
    setSlice((s) => ({ ...s, rows: s.columns, columns: s.rows }));

  const isPristine = JSON.stringify(slice) === JSON.stringify(INITIAL);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" style={btnStyle} onClick={toggleChannel}>
          {hasChannel ? 'Remove Channel from rows' : 'Add Channel to rows'}
        </button>
        <button type="button" style={btnStyle} onClick={swapAxes}>
          Swap rows / columns
        </button>
        <button
          type="button"
          style={{ ...btnStyle, opacity: isPristine ? 0.5 : 1 }}
          onClick={() => setSlice(INITIAL)}
          disabled={isPristine}
        >
          Reset
        </button>
      </div>

      <pre
        style={{
          margin: '0 0 12px',
          padding: '8px 12px',
          fontSize: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          overflowX: 'auto',
        }}
      >
        {`rows:    [${(slice.rows ?? []).map((r) => r.uniqueName).join(', ')}]
columns: [${(slice.columns ?? []).map((c) => c.uniqueName).join(', ')}]`}
      </pre>

      <PivotTable height={460} dataSource={{ data: SALES }} slice={slice} />
    </div>
  );
}
