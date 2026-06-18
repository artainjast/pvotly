import { useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { DataValue } from '@pvotly/core';
import type { SampleMeta } from './types';

/**
 * Array-of-arrays ("matrix") data source. The FIRST row is the header — its
 * cells become the field names that `slice` then references (Region, Product,
 * Sales, Qty). Every following row is one record, positionally aligned to the
 * header.
 */
const MATRIX: DataValue[][] = [
  ['Region', 'Product', 'Sales', 'Qty'],
  ['North', 'Widget', 1200, 30],
  ['North', 'Gadget', 900, 18],
  ['North', 'Gizmo', 450, 9],
  ['South', 'Widget', 800, 20],
  ['South', 'Gadget', 1500, 25],
  ['South', 'Gizmo', 600, 12],
  ['East', 'Widget', 1100, 27],
  ['East', 'Gadget', 700, 14],
  ['West', 'Gizmo', 950, 19],
  ['West', 'Widget', 1300, 33],
];

type Measure = 'Sales' | 'Qty';

export const meta: SampleMeta = {
  id: 'matrix',
  title: 'Array / matrix source',
  description:
    'Feed an inline array-of-arrays instead of objects. The first row is the header — its cells become the field names (Region, Product, Sales, Qty) that the slice references. Region on rows, Product on columns, summed Sales. Switch the value to sum below.',
  group: 'Data sources',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

const MATRIX = [
  ['Region', 'Product', 'Sales', 'Qty'], // header row defines field names
  ['North', 'Widget', 1200, 30],
  ['South', 'Gadget', 1500, 25],
  // ...more rows
];

<PivotTable
  dataSource={{ matrix: MATRIX }}
  slice={{
    rows: [{ uniqueName: 'Region' }],
    columns: [{ uniqueName: 'Product' }],
    measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
  }}
/>`,
};

export default function Matrix() {
  const [measure, setMeasure] = useState<Measure>('Sales');

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="matrix-measure" style={{ fontSize: 14, fontWeight: 600 }}>
          Sum:
        </label>
        <select
          id="matrix-measure"
          value={measure}
          onChange={(e) => setMeasure(e.target.value as Measure)}
          style={{ padding: '4px 8px', borderRadius: 6 }}
        >
          <option value="Sales">Sales</option>
          <option value="Qty">Qty</option>
        </select>
      </div>
      <PivotTable
        height={460}
        dataSource={{ matrix: MATRIX }}
        slice={{
          rows: [{ uniqueName: 'Region' }],
          columns: [{ uniqueName: 'Product' }],
          measures: [{ uniqueName: measure, aggregation: 'sum' }],
        }}
      />
    </div>
  );
}
