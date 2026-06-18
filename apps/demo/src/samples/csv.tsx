import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import { SALES_CSV } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'csv',
  title: 'CSV data source',
  description:
    'Pass a raw CSV string via dataSource={{ csv }} — pvotly parses it and infers each column type automatically (numbers, booleans and dates are coerced from text). Tune parsing with csvOptions, e.g. { delimiter: ";", header: true, dynamicTyping: true }.',
  group: 'Data sources',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

const SALES_CSV = \`country,category,units,revenue,date
USA,Cars,4,12000,2023-01-15
USA,Bikes,12,3600,2023-02-10
Canada,Cars,3,9000,2023-03-05\`;

<PivotTable
  dataSource={{
    csv: SALES_CSV,
    // Optional — these are the defaults:
    csvOptions: { delimiter: ',', header: true, dynamicTyping: true },
  }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  }}
/>`,
};

export default function Csv() {
  // Toggle automatic type coercion to show what CSV parsing does for you:
  // with it on, `revenue`/`units` are numbers (and aggregate); off, they stay
  // strings and `sum` has nothing numeric to add up.
  const [dynamicTyping, setDynamicTyping] = useState(true);

  return (
    <div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          fontSize: 14,
        }}
      >
        <input
          type="checkbox"
          checked={dynamicTyping}
          onChange={(e) => setDynamicTyping(e.target.checked)}
        />
        csvOptions.dynamicTyping (coerce numbers/dates from text)
      </label>

      <PivotTable
        height={460}
        dataSource={{
          csv: SALES_CSV,
          csvOptions: { delimiter: ',', header: true, dynamicTyping },
        }}
        slice={{
          rows: [{ uniqueName: 'country' }],
          columns: [{ uniqueName: 'category' }],
          measures: [
            { uniqueName: 'revenue', aggregation: 'sum' },
            { uniqueName: 'units', aggregation: 'sum' },
          ],
        }}
      />
    </div>
  );
}
