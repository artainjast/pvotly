import { useEffect, useRef, useState } from 'react';
import { usePivotEngine } from '@pvotly/react';
import { PivotChart, builtinSvgAdapter } from '@pvotly/charts';
import type { ChartAdapter, ChartData, ChartRenderOptions, ChartType } from '@pvotly/charts';
import type { Slice } from '@pvotly/core';
import { SALES } from '../data';
import type { SampleMeta } from './types';

export const meta: SampleMeta = {
  id: 'charts',
  title: 'Charts (pluggable)',
  description:
    '@pvotly/charts normalizes a pivot grid into a library-agnostic ChartData and hands it to a ChartAdapter. The zero-dependency builtinSvgAdapter is the default; swap in Chart.js via createChartJsAdapter, or your own adapter — here a bring-your-own "HTML bars" adapter built from plain divs. The chart stays in sync with the engine: change the grouping and it updates automatically. Switch chart type and adapter live.',
  group: 'Features',
  code: `import { usePivotEngine } from '@pvotly/react';
import { PivotChart, builtinSvgAdapter } from '@pvotly/charts';
import type { ChartAdapter } from '@pvotly/charts';

const { engine } = usePivotEngine({ dataSource: { data: SALES }, slice });

// Default zero-dep SVG, kept in sync with the engine:
const chart = new PivotChart(el, engine, builtinSvgAdapter, { type: 'bar' });

// Switch type / adapter at runtime:
chart.setType('line');
chart.setAdapter(myCustomAdapter); // any ChartAdapter — Chart.js, ECharts, ...

// A bring-your-own adapter is just three methods:
const myCustomAdapter: ChartAdapter<HTMLElement> = {
  name: 'html-bars',
  render(container, data, options) { /* draw + return a handle */ },
  update(instance, data, options) { /* re-draw */ },
  destroy(instance) { instance.remove(); },
};`,
};

/* ---- A bring-your-own adapter: horizontal bars from plain HTML ----------- */

const PALETTE = ['#4f7cff', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

function drawHtmlBars(container: HTMLElement, data: ChartData): void {
  container.innerHTML = '';
  const max = Math.max(1, ...data.series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:8px 4px;font-size:12px;';

  data.categories.forEach((cat, ci) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const label = document.createElement('div');
    label.textContent = cat;
    label.style.cssText = 'width:90px;text-align:right;color:var(--ph-fg-muted,#64748b);flex:0 0 auto;';
    row.append(label);

    const bars = document.createElement('div');
    bars.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:1 1 auto;';
    data.series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const bar = document.createElement('div');
      bar.title = `${s.name}: ${v}`;
      bar.style.cssText = `height:14px;border-radius:3px;background:${PALETTE[si % PALETTE.length]};width:${(v / max) * 100}%;min-width:2px;transition:width .25s;`;
      bars.append(bar);
    });
    row.append(bars);
    wrap.append(row);
  });

  container.append(wrap);
}

const htmlBarsAdapter: ChartAdapter<HTMLElement> = {
  name: 'html-bars',
  render(container: HTMLElement, data: ChartData, _options: ChartRenderOptions) {
    drawHtmlBars(container, data);
    return container;
  },
  update(instance: HTMLElement, data: ChartData) {
    drawHtmlBars(instance, data);
  },
  destroy(instance: HTMLElement) {
    instance.innerHTML = '';
  },
};

const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie'];
type AdapterKind = 'svg' | 'html';

export default function Charts() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<PivotChart | null>(null);
  const [type, setType] = useState<ChartType>('bar');
  const [adapterKind, setAdapterKind] = useState<AdapterKind>('svg');
  const [rowField, setRowField] = useState<'country' | 'category' | 'channel'>('country');

  const slice: Slice = {
    rows: [{ uniqueName: rowField }],
    columns: [{ uniqueName: 'channel' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum', caption: 'Revenue' }],
  };

  const { engine } = usePivotEngine({ dataSource: { data: SALES }, slice });

  // Create the chart once, bound to the (stable) engine.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new PivotChart(containerRef.current, engine, builtinSvgAdapter, {
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

  useEffect(() => {
    chartRef.current?.setAdapter(adapterKind === 'svg' ? builtinSvgAdapter : htmlBarsAdapter);
  }, [adapterKind]);

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
          <span style={{ fontWeight: 600 }}>Adapter</span>
          <select
            value={adapterKind}
            onChange={(e) => setAdapterKind(e.target.value as AdapterKind)}
            style={{ padding: '4px 8px' }}
          >
            <option value="svg">Built-in SVG (zero-dep)</option>
            <option value="html">Custom: HTML bars (BYO)</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Group by</span>
          <select value={rowField} onChange={(e) => setRowField(e.target.value as typeof rowField)} style={{ padding: '4px 8px' }}>
            <option value="country">Country</option>
            <option value="category">Category</option>
            <option value="channel">Channel</option>
          </select>
        </label>
        {adapterKind === 'html' && (
          <span style={{ opacity: 0.6 }}>(HTML bars adapter ignores chart type)</span>
        )}
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
