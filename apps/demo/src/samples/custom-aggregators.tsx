import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import { registerAggregator } from '@pvotly/core';
import type { AggregatorDefinition, NumberFormat, Slice } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'custom-aggregators',
  title: 'Custom aggregators',
  description:
    'Register your own aggregation functions by name alongside the 15 built-ins via the customAggregators registry, then reference them like any built-in (aggregation: "weightedPrice"). This sample adds a weighted-average price (revenue-weighted) using the streaming init/reduce/finalize form, and a "range" aggregator (max − min units) using the simpler batch evaluate form.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import type { AggregatorDefinition } from '@pvotly/core';
import '@pvotly/web/styles.css';

// Streaming form: memory-efficient single-pass reduction.
const weightedPrice: AggregatorDefinition = {
  label: 'Weighted price',
  init: () => ({ revenue: 0, units: 0 }),
  reduce: (acc, _value, record) => {
    const a = acc as { revenue: number; units: number };
    a.revenue += Number(record.revenue) || 0;
    a.units += Number(record.units) || 0;
    return a;
  },
  finalize: (acc) => {
    const a = acc as { revenue: number; units: number };
    return a.units ? a.revenue / a.units : null;
  },
};

// Batch form: gets every value for the cell at once.
const unitsRange: AggregatorDefinition = {
  label: 'Units range',
  evaluate: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
  },
};

<PivotTable
  dataSource={{ data: SALES }}
  customAggregators={{ weightedPrice, unitsRange }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    measures: [
      { uniqueName: 'price', aggregation: 'weightedPrice', caption: 'Wtd price' },
      { uniqueName: 'units', aggregation: 'unitsRange', caption: 'Units range' },
    ],
  }}
/>`,
};

const weightedPrice: AggregatorDefinition = {
  label: 'Weighted price',
  init: () => ({ revenue: 0, units: 0 }),
  reduce: (acc, _value, record) => {
    const a = acc as { revenue: number; units: number };
    a.revenue += Number(record.revenue) || 0;
    a.units += Number(record.units) || 0;
    return a;
  },
  finalize: (acc) => {
    const a = acc as { revenue: number; units: number };
    return a.units ? a.revenue / a.units : null;
  },
};

const unitsRange: AggregatorDefinition = {
  label: 'Units range',
  evaluate: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
  },
};

const customAggregators = { weightedPrice, unitsRange };

// Also register globally so the names resolve from anywhere (and survive
// report updates), in addition to the per-report `customAggregators` map.
registerAggregator('weightedPrice', weightedPrice);
registerAggregator('unitsRange', unitsRange);

const formats: NumberFormat[] = [
  { name: 'price', decimalPlaces: 2, currencySymbol: '$', thousandsSeparator: ',' },
];

export default function CustomAggregators() {
  const [showCustom, setShowCustom] = useState(true);

  const slice = useMemo<Slice>(
    () => ({
      rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
      measures: showCustom
        ? [
            { uniqueName: 'price', aggregation: 'weightedPrice', caption: 'Wtd price', format: 'price' },
            { uniqueName: 'units', aggregation: 'unitsRange', caption: 'Units range' },
            { uniqueName: 'price', aggregation: 'average', caption: 'Simple avg price', format: 'price' },
          ]
        : [{ uniqueName: 'price', aggregation: 'average', caption: 'Simple avg price', format: 'price' }],
    }),
    [showCustom],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={showCustom}
          onChange={(e) => setShowCustom(e.target.checked)}
        />
        Show custom aggregators (compare weighted vs. simple average price)
      </label>

      <PivotTable
        height={460}
        dataSource={{ data: SALES }}
        customAggregators={customAggregators}
        formats={formats}
        slice={slice}
      />
    </div>
  );
}
