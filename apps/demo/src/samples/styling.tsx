import { useState, type CSSProperties } from 'react';
import { PivotTable } from '@pvotly/react';
import type { ThemeName, ThemeTokens } from '@pvotly/web';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'styling',
  title: 'Custom styling',
  description:
    'Style the widget entirely through props — pass a typed `tokens` object and/or a `theme` name. No CSS, no refs. Change the controls below and the grid restyles live as the props update.',
  group: 'Features',
  code: `import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { ThemeTokens } from '@pvotly/web';
import '@pvotly/web/styles.css';

export function StyledPivot({ data }) {
  const [tokens, setTokens] = useState<ThemeTokens>({
    accent: '#e11d48',
    headerBackground: '#fff1f2',
    grandTotalBackground: '#ffe4e6',
    radius: 12,
    // Filter bar / chips styled the same way — no CSS overrides:
    filters: {
      chipBackground: '#fff1f2',
      chipBorder: '#fecdd3',
      chipForeground: '#e11d48',
      chipRadius: 8,
    },
  });

  return (
    <>
      <input
        type="color"
        value={tokens.accent}
        onChange={(e) => setTokens({ ...tokens, accent: e.target.value })}
      />

      {/* Everything is styled via props — no CSS required. */}
      <PivotTable
        theme="light"        // "light" | "dark" | "minimal"
        tokens={tokens}      // typed ThemeTokens object (incl. tokens.filters)
        options={{ grid: { width: 'content' } }} // 'fill' (default) | 'content'
        dataSource={{ data }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
          reportFilters: [{ uniqueName: 'channel' }],
        }}
      />
    </>
  );
}`,
};

const PRESETS: Record<string, ThemeTokens> = {
  Indigo: { accent: '#2563eb', headerBackground: '#eef1f5', grandTotalBackground: '#e2e8f8' },
  Rose: { accent: '#e11d48', headerBackground: '#fff1f2', grandTotalBackground: '#ffe4e6' },
  Emerald: { accent: '#059669', headerBackground: '#ecfdf5', grandTotalBackground: '#d1fae5' },
  Amber: { accent: '#d97706', headerBackground: '#fffbeb', grandTotalBackground: '#fef3c7' },
};

export default function Styling() {
  const [theme, setTheme] = useState<ThemeName>('light');
  const [width, setWidth] = useState<'fill' | 'content'>('fill');
  const [tokens, setTokens] = useState<ThemeTokens>({
    accent: '#2563eb',
    headerBackground: '#eef1f5',
    grandTotalBackground: '#e2e8f8',
    radius: 6,
  });
  const set = (patch: ThemeTokens) => setTokens((t) => ({ ...t, ...patch }));

  return (
    <div>
      <div style={controls}>
        <label style={ctl}>
          Theme
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
            <option value="light">light</option>
            <option value="dark">dark</option>
            <option value="minimal">minimal</option>
          </select>
        </label>
        <label style={ctl}>
          Width
          <select value={width} onChange={(e) => setWidth(e.target.value as 'fill' | 'content')}>
            <option value="fill">fill (stretch)</option>
            <option value="content">content (natural)</option>
          </select>
        </label>
        <label style={ctl}>
          Accent
          <input
            type="color"
            value={tokens.accent ?? '#2563eb'}
            onChange={(e) => set({ accent: e.target.value })}
          />
        </label>
        <label style={ctl}>
          Header
          <input
            type="color"
            value={tokens.headerBackground ?? '#eef1f5'}
            onChange={(e) => set({ headerBackground: e.target.value })}
          />
        </label>
        <label style={ctl}>
          Totals
          <input
            type="color"
            value={tokens.grandTotalBackground ?? '#e2e8f8'}
            onChange={(e) =>
              set({ grandTotalBackground: e.target.value, subtotalBackground: e.target.value })
            }
          />
        </label>
        <label style={ctl}>
          Radius
          <input
            type="range"
            min={0}
            max={16}
            value={Number(tokens.radius ?? 6)}
            onChange={(e) => set({ radius: Number(e.target.value) })}
          />
        </label>
        <label style={ctl}>
          Filter chip
          <input
            type="color"
            value={tokens.filters?.chipBackground ?? '#eef2ff'}
            onChange={(e) =>
              set({
                filters: {
                  ...tokens.filters,
                  chipBackground: e.target.value,
                  chipBorder: e.target.value,
                  chipForeground: tokens.accent,
                },
              })
            }
          />
        </label>
        <label style={ctl}>
          Chip radius
          <input
            type="range"
            min={0}
            max={20}
            value={Number(tokens.filters?.chipRadius ?? 9)}
            onChange={(e) =>
              set({ filters: { ...tokens.filters, chipRadius: Number(e.target.value) } })
            }
          />
        </label>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {Object.keys(PRESETS).map((name) => (
            <button key={name} onClick={() => set({ ...PRESETS[name] })} style={presetBtn}>
              {name}
            </button>
          ))}
        </span>
      </div>

      <PivotTable
        height={420}
        theme={theme}
        tokens={tokens}
        options={{ grid: { width } }}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
          reportFilters: [{ uniqueName: 'channel' }],
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
const presetBtn: CSSProperties = {
  border: '1px solid #d8dde6',
  background: '#fff',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
};
