import { useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

type Theme = 'light' | 'dark' | 'minimal';

export const meta: SampleMeta = {
  id: 'theming',
  title: 'Theming',
  description:
    'Themes are CSS-variable based. Switch between the built-in light, dark, and minimal themes via the theme prop, or override individual design tokens (e.g. the accent color) at runtime with instance.setThemeTokens().',
  group: 'Features',
  code: `import { useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import '@pvotly/web/styles.css';

function Themed() {
  const ref = useRef<PivotTableHandle>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'minimal'>('light');

  return (
    <>
      <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="minimal">Minimal</option>
      </select>
      {/* Themes are driven by --ph-* CSS variables; override tokens at runtime. */}
      <button onClick={() => ref.current?.instance.setThemeTokens({ accent: '#e11d48' })}>
        Accent: rose
      </button>

      <PivotTable
        ref={ref}
        theme={theme}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
        }}
      />
    </>
  );
}`,
};

const THEMES: Theme[] = ['light', 'dark', 'minimal'];

const ACCENTS: Array<{ label: string; value: string }> = [
  { label: 'Rose', value: '#e11d48' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Violet', value: '#7c3aed' },
];

export default function Theming() {
  const ref = useRef<PivotTableHandle>(null);
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            style={{ padding: '4px 8px' }}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <span style={{ opacity: 0.6 }}>Accent token:</span>
        {ACCENTS.map((accent) => (
          <button
            key={accent.value}
            type="button"
            onClick={() => ref.current?.instance.setThemeTokens({ accent: accent.value })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: accent.value,
              }}
            />
            {accent.label}
          </button>
        ))}
      </div>

      <PivotTable
        ref={ref}
        height={460}
        theme={theme}
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
