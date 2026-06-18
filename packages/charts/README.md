# @pvotly/charts

Turn a [pvotly](https://github.com/artainjast/pivot-table) pivot grid into a chart —
with **your** charting library.

`@pvotly/charts` does two things and nothing else:

1. **Normalizes** a computed pivot grid into a stable, library-agnostic
   [`ChartData`](#chartdata) shape (categories × series + axis metadata).
2. Hands that data to a pluggable [`ChartAdapter`](#chartadapter) that renders it.

It ships a **zero-dependency** built-in SVG adapter as the default, so it works
out of the box. To use Chart.js, ECharts, Highcharts, D3, Recharts, or anything
else, you write (or import) a small adapter. pvotly never talks to your chart
library directly.

```bash
pnpm add @pvotly/charts @pvotly/core
```

> Required runtime dependencies: **none** (besides `@pvotly/core`, the engine).
> The built-in SVG adapter needs nothing else.

## Quick start (built-in SVG, zero deps)

```ts
import { PivotEngine } from '@pvotly/core';
import { PivotChart } from '@pvotly/charts';

const engine = new PivotEngine({
  dataSource: { data },
  slice: {
    rows: [{ uniqueName: 'Country' }],
    columns: [{ uniqueName: 'Category' }],
    measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
  },
});

const chart = new PivotChart(document.getElementById('chart')!, engine, undefined, {
  type: 'bar', // 'bar' | 'line' | 'area' | 'pie'
});

// The chart auto-updates whenever the engine's report changes.
chart.setType('line');
chart.destroy();
```

Just want the data? Skip the controller:

```ts
import { gridToChartData } from '@pvotly/charts';
const data = gridToChartData(engine.getGrid(), { type: 'line' });
```

## `ChartData`

The stable contract every adapter receives:

```ts
type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter';

interface ChartSeries {
  name: string;                  // column-leaf caption and/or measure caption
  values: Array<number | null>;  // aligned 1:1 with categories; null = gap
  measure?: string;              // source measure uniqueName
}

interface ChartData {
  type: ChartType;               // requested kind (a hint)
  categories: string[];          // x labels (one per row leaf)
  series: ChartSeries[];         // (column leaf × measure)
  axes: {
    category: { title?: string; min: number; max: number };
    value: { title?: string; min: number; max: number };
  };
  title?: string;
}
```

## `ChartAdapter`

The single plug-in point — three lifecycle methods over an opaque instance:

```ts
interface ChartRenderOptions {
  type?: ChartType;
  width?: number;
  height?: number;
  title?: string;
  palette?: string[];
  [key: string]: unknown;        // adapter-specific escape hatch
}

interface ChartAdapter<TInstance = unknown> {
  name?: string;
  render(container: HTMLElement, data: ChartData, options: ChartRenderOptions): TInstance;
  update(instance: TInstance, data: ChartData, options: ChartRenderOptions): TInstance | void;
  destroy(instance: TInstance): void;
}
```

## Bring your own library

### Chart.js (reference adapter, optional peer)

Chart.js is an **optional peer dependency** — `@pvotly/charts` never imports it.
You pass the `Chart` class in, so you stay in control of tree-shaking and which
controllers/scales are registered:

```ts
import Chart from 'chart.js/auto';
import { PivotChart, createChartJsAdapter } from '@pvotly/charts';

const adapter = createChartJsAdapter(Chart);
const chart = new PivotChart(el, engine, adapter, { type: 'line' });
```

### Write a custom adapter (e.g. ECharts)

Implement the interface and hand pvotly's normalized `ChartData` to your lib:

```ts
import * as echarts from 'echarts';
import type { ChartAdapter } from '@pvotly/charts';

const echartsAdapter: ChartAdapter<echarts.ECharts> = {
  name: 'echarts',
  render(container, data, options) {
    const instance = echarts.init(container, undefined, {
      width: options.width,
      height: options.height,
    });
    instance.setOption(toEChartsOption(data, options));
    return instance;
  },
  update(instance, data, options) {
    instance.setOption(toEChartsOption(data, options));
  },
  destroy(instance) {
    instance.dispose();
  },
};

function toEChartsOption(data, options) {
  return {
    title: { text: options.title ?? data.title },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: data.series.map((s) => ({
      name: s.name,
      type: options.type ?? data.type,
      data: s.values,
    })),
  };
}

// Use it:
const chart = new PivotChart(el, engine, echartsAdapter);
```

You can also register adapters by name and reference them as strings:

```ts
import { registerAdapter, PivotChart } from '@pvotly/charts';

registerAdapter('echarts', echartsAdapter);
new PivotChart(el, engine, 'echarts'); // 'svg' is always registered too
```

## API

| Export | Description |
| ------ | ----------- |
| `gridToChartData(grid, opts?)` | Normalize a `PivotGrid` → `ChartData`. |
| `engineToChartData(engine, opts?)` | Normalize the engine's current grid. |
| `PivotChart` | Controller: normalize → render → auto-update → destroy. |
| `builtinSvgAdapter` | Default zero-dependency SVG adapter. |
| `createChartJsAdapter(Chart)` | Reference Chart.js adapter factory. |
| `registerAdapter` / `getAdapter` / `listAdapters` | Optional name registry. |
| `ChartAdapter`, `ChartData`, `ChartType`, `ChartRenderOptions`, `NormalizeOptions`, … | Types for TS consumers. |

## License

MIT
