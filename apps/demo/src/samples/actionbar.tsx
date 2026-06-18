import { PivotTable } from '@pvotly/react';
import type { ActionBarConfig } from '@pvotly/web';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'actionbar',
  title: 'Custom action bar',
  description:
    'The toolbar is fully configurable through the `actionBar` prop: toggle or restyle each built-in action (fields/format/conditional/layout/export/fullscreen), give the bar a class or inline style, and add your own buttons whose onClick receives the widget instance.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import type { ActionBarConfig } from '@pvotly/web';

const actionBar: ActionBarConfig = {
  className: 'my-bar',
  style: { background: '#0f172a' },     // style the bar itself
  conditional: false,                   // hide a built-in
  fields: { label: 'Configure' },       // relabel a built-in
  export: { label: 'Download' },        // keep the menu, change the label
  custom: [                             // add your own buttons
    { id: 'reset', label: 'Reset', onClick: (t) => t.engine.expandAll() },
    { id: 'csv', label: 'Quick CSV', onClick: (t) => t.exportTo('csv') },
    { id: 'json', label: 'Quick JSON', onClick: (t) => t.exportTo('json') },
  ],
  customPosition: 'end',
};

<PivotTable actionBar={actionBar} dataSource={{ data }} slice={...} />`,
};

const actionBar: ActionBarConfig = {
  className: 'demo-action-bar',
  conditional: false,
  fields: { label: 'Configure' },
  export: { label: 'Download' },
  custom: [
    { id: 'reset', label: 'Reset view', onClick: (t) => t.engine.expandAll() },
    { id: 'csv', label: 'Quick CSV', onClick: (t) => t.exportTo('csv') },
    { id: 'json', label: 'Quick JSON', onClick: (t) => t.exportTo('json') },
  ],
};

export default function ActionBar() {
  return (
    <PivotTable
      height={460}
      actionBar={actionBar}
      dataSource={{ data: SALES }}
      slice={{
        rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      }}
    />
  );
}
