import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { usePivotEngine } from '@pvotly/react';
import { PivotChart, createChartJsAdapter } from '@pvotly/charts';
import type { ChartJsConstructor, ChartType } from '@pvotly/charts';
import type { Slice } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'chartjs',
  title: 'Charts (Chart.js)',
  description:
    'Render the pivot through Chart.js. createChartJsAdapter takes the Chart.js `Chart` class — @pvotly/charts never imports chart.js itself, so it stays zero-dependency and you control which controllers/scales are registered (here via chart.js/auto). The chart tracks the engine: change grouping or chart type and it updates in place.',
  group: 'Features',
  code: `import Chart from 'chart.js/auto';
import { usePivotEngine } from '@pvotly/react';
import { PivotChart, createChartJsAdapter } from '@pvotly/charts';

const { engine } = usePivotEngine({ dataSource: { data: SALES }, slice });

// Hand the Chart class to the adapter — chart.js stays your dependency:
const adapter = createChartJsAdapter(Chart);
const chart = new PivotChart(el, engine, adapter, { type: 'bar', height: 320 });

// Live updates, in place:
chart.setType('line');`,
};

const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie'];
type RowField = 'country' | 'category' | 'channel';

export default function ChartJsSample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<PivotChart | null>(null);
  const [type, setType] = useState<ChartType>('bar');
  const [rowField, setRowField] = useState<RowField>('country');

  const slice: Slice = {
    rows: [{ uniqueName: rowField }],
    columns: [{ uniqueName: 'channel' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
  };

  const { engine } = usePivotEngine({ dataSource: { data: SALES }, slice });

  // Create the Chart.js-backed chart once, bound to the (stable) engine.
  useEffect(() => {
    if (!containerRef.current) return;
    const adapter = createChartJsAdapter(Chart as unknown as ChartJsConstructor);
    const chart = new PivotChart(containerRef.current, engine, adapter, {
      type: 'bar',
      height: 320,
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [engine]);

  useEffect(() => {
    chartRef.current?.setType(type);
  }, [type]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Chart type</span>
          <select value={type} onChange={(e) => setType(e.target.value as ChartType)} style={{ padding: '4px 8px' }}>
            {CHART_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Group by</span>
          <select value={rowField} onChange={(e) => setRowField(e.target.value as RowField)} style={{ padding: '4px 8px' }}>
            <option value="country">Country</option>
            <option value="category">Category</option>
            <option value="channel">Channel</option>
          </select>
        </label>
        <span style={{ opacity: 0.6 }}>Powered by Chart.js {Chart.version}</span>
      </div>

      <div
        ref={containerRef}
        style={{
          minHeight: 340,
          border: '1px solid var(--ph-border, #e2e8f0)',
          borderRadius: 8,
          padding: 8,
        }}
      />
    </div>
  );
}
