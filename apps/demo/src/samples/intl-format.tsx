import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { NumberFormat } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'intl-format',
  title: 'Intl formatting',
  description:
    'Opt into Intl.NumberFormat by setting a format style ("currency" / "percent" / "decimal"). The grid-wide options.locale drives grouping, decimal symbols and currency rendering; switch the locale/currency below and every number reflows live. Revenue is a localized currency, Discount is a percent, and Units is a plain grouped decimal.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import type { NumberFormat } from '@pvotly/core';
import '@pvotly/web/styles.css';

const formats: NumberFormat[] = [
  // Setting \`style\` enables the Intl path; \`currency\` is required for currency.
  { name: 'money', style: 'currency', currency: 'USD' },
  { name: 'pct', style: 'percent', maximumFractionDigits: 1 },
  { name: 'num', style: 'decimal', maximumFractionDigits: 0 },
];

<PivotTable
  dataSource={{ data: SALES }}
  formats={formats}
  options={{ locale: 'de-DE' }} // grid-wide BCP-47 locale
  slice={{
    rows: [{ uniqueName: 'country' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum', format: 'money' },
      { uniqueName: 'discount', aggregation: 'average', format: 'pct' },
      { uniqueName: 'units', aggregation: 'sum', format: 'num' },
    ],
  }}
/>`,
};

const LOCALES: Array<{ locale: string; currency: string; label: string }> = [
  { locale: 'en-US', currency: 'USD', label: 'English (US) · $' },
  { locale: 'de-DE', currency: 'EUR', label: 'German · €' },
  { locale: 'fr-FR', currency: 'EUR', label: 'French · €' },
  { locale: 'ja-JP', currency: 'JPY', label: 'Japanese · ¥' },
  { locale: 'ar-EG', currency: 'EGP', label: 'Arabic (Egypt) · ج.م' },
];

export default function IntlFormat() {
  const [idx, setIdx] = useState(1);
  const { locale, currency } = LOCALES[idx]!;

  // The discount column is already a 0–100 number; divide by 100 so the
  // Intl percent style (which multiplies by 100) shows a sensible value.
  const formats = useMemo<NumberFormat[]>(
    () => [
      { name: 'money', style: 'currency', currency, maximumFractionDigits: 0 },
      { name: 'pct', style: 'percent', maximumFractionDigits: 1 },
      { name: 'num', style: 'decimal', maximumFractionDigits: 0 },
    ],
    [currency],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        <span style={{ fontWeight: 600 }}>Locale &amp; currency</span>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ padding: '4px 8px' }}>
          {LOCALES.map((l, i) => (
            <option key={l.locale} value={i}>
              {l.label}
            </option>
          ))}
        </select>
        <code style={{ fontSize: 12, opacity: 0.7 }}>locale={locale}</code>
      </label>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        formats={formats}
        options={{ locale }}
        slice={{
          rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
          columns: [{ uniqueName: 'channel' }],
          measures: [
            { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue', format: 'money' },
            { uniqueName: 'units', aggregation: 'sum', caption: 'Units', format: 'num' },
          ],
        }}
      />
    </div>
  );
}
