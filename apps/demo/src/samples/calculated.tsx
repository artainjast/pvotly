import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import { SALES } from '../data';
import type { NumberFormat, Slice } from '@pvotly/core';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'calculated',
  title: 'Calculated measures',
  description:
    "Derive new measures from formulas instead of plain aggregations. Avg price is sum('revenue') / sum('units') — the blended per-unit price across each row, which is NOT the same as averaging the per-record prices. Avg discount % is average('discount') — the mean discount of the underlying records. Formulas can reference any aggregation (sum, average, count, min, max, …) over a field and combine them with + - * /.",
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
      // Calculated: blended price = total revenue / total units.
      { uniqueName: 'avgPrice', caption: 'Avg price',
        formula: "sum('revenue') / sum('units')" },
      // Calculated: mean of the per-record discount.
      { uniqueName: 'avgDiscount', caption: 'Avg discount %',
        formula: "average('discount')" },
    ],
  }}
/>`,
};

const baseMeasures: NonNullable<Slice['measures']> = [
  { uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' },
  {
    uniqueName: 'avgPrice',
    caption: 'Avg price',
    formula: "sum('revenue') / sum('units')",
  },
  {
    uniqueName: 'avgDiscount',
    caption: 'Avg discount %',
    formula: "average('discount')",
  },
];

const formats: NumberFormat[] = [{ name: '', decimalPlaces: 2, thousandsSeparator: ',' }];

export default function Calculated() {
  const [showCalculated, setShowCalculated] = useState(true);

  const measures = showCalculated
    ? baseMeasures
    : baseMeasures.filter((m) => !m.formula);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={showCalculated}
          onChange={(e) => setShowCalculated(e.target.checked)}
        />
        Show calculated measures (Avg price &amp; Avg discount %)
      </label>
      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        formats={formats}
        slice={{
          rows: [{ uniqueName: 'country' }],
          measures,
        }}
      />
    </div>
  );
}
