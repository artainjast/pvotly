import { useEffect, useRef } from 'react';
import { PivotTable } from '@pvotly/web';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'vanilla',
  title: 'Vanilla JS usage',
  description:
    'No framework required — instantiate the widget directly against a DOM node with @pvotly/web.',
  group: 'Frameworks',
  code: `import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';

const pivot = new PivotTable('#app', {
  dataSource: { data: SALES },
  slice: {
    rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  },
  options: { grid: { type: 'compact' } },
});

pivot.on('cellClick', ({ cell }) => console.log(cell));`,
};

export default function Vanilla() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const pivot = new PivotTable(ref.current, {
      height: 460,
      dataSource: { data: SALES },
      slice: {
        rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
        measures: [
          { uniqueName: 'revenue', aggregation: 'sum' },
          { uniqueName: 'units', aggregation: 'sum' },
        ],
      },
    });
    return () => pivot.destroy();
  }, []);
  return <div ref={ref} />;
}
