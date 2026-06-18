import { PivotTable } from '@pvotly/react';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'basic',
  title: 'Basic pivot',
  description:
    'Country on rows, Category on columns, summed Revenue. Drag fields in the panel on the right, click ▸ to expand, double-click a cell to drill through.',
  group: 'Getting started',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
/>`,
};

export default function Basic() {
  return (
    <PivotTable
      height={460}
      dataSource={{ data: SALES }}
      slice={{
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      }}
    />
  );
}
