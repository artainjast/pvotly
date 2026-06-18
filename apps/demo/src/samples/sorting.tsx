import { useMemo, useState } from 'react';
import { PivotTable } from '@pvotly/react';
import type { Slice, SortDirection } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'sorting',
  title: 'Sorting',
  description:
    'Two ways to order an axis: member sort (alphabetical asc/desc on the field itself) and sort-by-value (rank members by a measure). Clicking the ↕ sort icon on a field chip in the panel cycles asc → desc → unsorted.',
  group: 'Features',
  code: `import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

// 1. Member sort — order the Country members alphabetically.
<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country', sort: 'desc' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  }}
/>;

// 2. Sort-by-value — order the rows axis by a measure (vs grand total).
<PivotTable
  dataSource={{ data: SALES }}
  slice={{
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    sorting: { row: { direction: 'desc', measure: 'revenue' } },
  }}
/>;`,
};

type Mode = 'member' | 'value';

const MEASURES = [
  { uniqueName: 'revenue', aggregation: 'sum' as const },
  { uniqueName: 'units', aggregation: 'sum' as const },
];

export default function Sorting() {
  const [mode, setMode] = useState<Mode>('member');
  const [memberSort, setMemberSort] = useState<SortDirection>('desc');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [measure, setMeasure] = useState<'revenue' | 'units'>('revenue');

  const slice = useMemo<Slice>(() => {
    if (mode === 'member') {
      // Member sort: order the Country members by their own labels.
      return {
        rows: [{ uniqueName: 'country', sort: memberSort }],
        columns: [{ uniqueName: 'category' }],
        measures: MEASURES,
      };
    }
    // Sort-by-value: rank the rows axis by a measure (compared vs grand total).
    return {
      rows: [{ uniqueName: 'country' }],
      columns: [{ uniqueName: 'category' }],
      measures: MEASURES,
      sorting: { row: { direction, measure } },
    };
  }, [mode, memberSort, direction, measure]);

  const cycle = (d: SortDirection): SortDirection =>
    d === 'asc' ? 'desc' : d === 'desc' ? 'unsorted' : 'asc';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Sort type:
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="member">Member sort (by label)</option>
            <option value="value">Sort by value (by measure)</option>
          </select>
        </label>

        {mode === 'member' ? (
          <button type="button" onClick={() => setMemberSort(cycle(memberSort))}>
            Country ↕ {memberSort}
          </button>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Measure:
              <select
                value={measure}
                onChange={(e) => setMeasure(e.target.value as 'revenue' | 'units')}
              >
                <option value="revenue">Revenue</option>
                <option value="units">Units</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              Direction ↕ {direction}
            </button>
          </>
        )}
      </div>

      <PivotTable height={460} dataSource={{ data: SALES }} slice={slice} />
    </div>
  );
}
