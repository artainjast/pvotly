import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { Localization } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'localization-rtl',
  title: 'Localization & RTL',
  description:
    'Every toolbar / field-list / dialog string comes from the report.localization object, and the layout direction follows localization.rtl (or direction: "rtl"). Switch the language to translate the chrome live, and flip RTL to mirror the whole grid for right-to-left scripts like Arabic.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import type { Localization } from '@pvotly/core';
import '@pvotly/web/styles.css';

const arabic: Localization = {
  rtl: true,
  fields: 'الحقول', rows: 'الصفوف', columns: 'الأعمدة', values: 'القيم',
  grandTotal: 'الإجمالي الكلي',
};

<PivotTable
  localization={arabic}
  dataSource={{ data: SALES }}
  slice={{ rows: [{ uniqueName: 'country' }], columns: [{ uniqueName: 'category' }],
           measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] }}
/>`,
};

const STRINGS: Record<'en' | 'ar' | 'de', Localization> = {
  en: {},
  ar: {
    fields: 'الحقول',
    format: 'تنسيق',
    conditional: 'شرطي',
    rows: 'الصفوف',
    columns: 'الأعمدة',
    values: 'القيم',
    reportFilters: 'عوامل التصفية',
    grandTotal: 'الإجمالي الكلي',
    grandTotalLabel: 'الإجمالي الكلي',
    export: 'تصدير',
    noData: 'لا توجد بيانات',
  },
  de: {
    fields: 'Felder',
    format: 'Format',
    conditional: 'Bedingt',
    rows: 'Zeilen',
    columns: 'Spalten',
    values: 'Werte',
    reportFilters: 'Berichtsfilter',
    grandTotal: 'Gesamtergebnis',
    grandTotalLabel: 'Gesamtergebnis',
    export: 'Exportieren',
    noData: 'Keine Daten',
  },
};

const LANGS: Array<{ value: keyof typeof STRINGS; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'de', label: 'Deutsch (German)' },
];

export default function LocalizationRtl() {
  const [lang, setLang] = useState<keyof typeof STRINGS>('en');
  const [rtl, setRtl] = useState(false);

  const localization = useMemo<Localization>(
    () => ({ ...STRINGS[lang], rtl: rtl || lang === 'ar' }),
    [lang, rtl],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Language</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as keyof typeof STRINGS)} style={{ padding: '4px 8px' }}>
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={rtl || lang === 'ar'} onChange={(e) => setRtl(e.target.checked)} />
          Right-to-left (RTL)
        </label>
      </div>

      <PivotTable
        height={460}
        localization={localization}
        dataSource={{ data: SALES }}
        slice={{
          rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
          columns: [{ uniqueName: 'category' }],
          measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
        }}
      />
    </div>
  );
}
