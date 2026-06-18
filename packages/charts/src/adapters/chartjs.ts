/**
 * Reference "bring-your-own-library" adapter for [Chart.js](https://www.chartjs.org).
 *
 * Chart.js is an **optional peer dependency** — this module never imports it.
 * Instead you hand the `Chart` class (or its `auto`-registered build) to
 * {@link createChartJsAdapter}, so `@pvotly/charts` keeps **zero required
 * runtime dependencies** and you control exactly which controllers/scales are
 * registered.
 *
 * @example
 * ```ts
 * import Chart from 'chart.js/auto';
 * import { createChartJsAdapter, PivotChart, gridToChartData } from '@pvotly/charts';
 *
 * const adapter = createChartJsAdapter(Chart);
 * const chart = new PivotChart(el, engine, adapter, { type: 'line' });
 * ```
 */
import type { ChartAdapter, ChartData, ChartRenderOptions, ChartType } from '../types';

/* -- Minimal structural types so we don't depend on chart.js' types --------- */

/** The subset of the Chart.js `Chart` instance we use. */
export interface ChartJsInstance {
  data: unknown;
  options?: unknown;
  update(mode?: string): void;
  destroy(): void;
}

/** The subset of the Chart.js `Chart` constructor we use. */
export interface ChartJsConstructor {
  new (item: HTMLCanvasElement | CanvasRenderingContext2D, config: unknown): ChartJsInstance;
}

/** Map our {@link ChartType} onto a Chart.js chart `type` string. */
function chartJsType(type: ChartType): string {
  switch (type) {
    case 'area':
      return 'line'; // area = filled line
    case 'scatter':
      return 'scatter';
    case 'pie':
      return 'pie';
    case 'line':
      return 'line';
    case 'bar':
    default:
      return 'bar';
  }
}

const DEFAULT_PALETTE = ['#4f7cff', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/** Build a Chart.js `data` object from normalized {@link ChartData}. */
function toChartJsData(data: ChartData, options: ChartRenderOptions): unknown {
  const type = options.type ?? data.type;
  const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE;
  const filled = type === 'area';

  // Pie/doughnut: a single dataset, one color per category.
  if (type === 'pie') {
    const first = data.series[0];
    return {
      labels: data.categories,
      datasets: [
        {
          label: first?.name ?? '',
          data: (first?.values ?? []).map((v) => v ?? 0),
          backgroundColor: data.categories.map((_, i) => palette[i % palette.length]),
        },
      ],
    };
  }

  return {
    labels: data.categories,
    datasets: data.series.map((s, i) => ({
      label: s.name,
      data: s.values.map((v) => v ?? null),
      borderColor: palette[i % palette.length],
      backgroundColor: palette[i % palette.length],
      fill: filled,
      tension: 0.25,
    })),
  };
}

function toChartJsConfig(data: ChartData, options: ChartRenderOptions): unknown {
  const title = options.title ?? data.title;
  return {
    type: chartJsType(options.type ?? data.type),
    data: toChartJsData(data, options),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: data.series.length > 1 },
        title: title ? { display: true, text: title } : { display: false },
      },
    },
  };
}

/**
 * Create a Chart.js {@link ChartAdapter}. Pass the Chart.js `Chart` class.
 *
 * The adapter creates a `<canvas>` inside the container, instantiates a Chart,
 * and on `update` patches the existing chart's `data` in place (fast path).
 */
export function createChartJsAdapter(Chart: ChartJsConstructor): ChartAdapter<ChartJsInstance> {
  return {
    name: 'chart.js',
    render(container, data, options) {
      while (container.firstChild) container.removeChild(container.firstChild);
      const canvas = document.createElement('canvas');
      if (options.width) canvas.width = options.width;
      if (options.height) canvas.height = options.height;
      container.append(canvas);
      return new Chart(canvas, toChartJsConfig(data, options));
    },
    update(instance, data, options) {
      const config = toChartJsConfig(data, options) as { data: unknown; options: unknown };
      instance.data = config.data;
      instance.options = config.options;
      instance.update();
    },
    destroy(instance) {
      instance.destroy();
    },
  };
}
