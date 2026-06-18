/**
 * @pvotly/charts — turn pvotly grids into charts with a pluggable,
 * bring-your-own-library rendering API.
 *
 * - **Normalize**: {@link gridToChartData} / {@link engineToChartData} produce a
 *   stable, library-agnostic {@link ChartData}.
 * - **Render**: a {@link ChartAdapter} draws that data. The default
 *   {@link builtinSvgAdapter} has **zero dependencies**; bring Chart.js, ECharts,
 *   Highcharts, D3, … via your own adapter.
 * - **Orchestrate**: {@link PivotChart} wires an engine/grid to an adapter and
 *   keeps the chart in sync with report changes.
 *
 * @example
 * ```ts
 * import { PivotEngine } from '@pvotly/core';
 * import { PivotChart } from '@pvotly/charts';
 *
 * const engine = new PivotEngine(config);
 * const chart = new PivotChart(document.getElementById('chart')!, engine, undefined, {
 *   type: 'bar',
 * });
 * ```
 */

// Contract
export type {
  ChartAdapter,
  ChartData,
  ChartSeries,
  ChartAxisMeta,
  ChartType,
  ChartRenderOptions,
  NormalizeOptions,
} from './types';

// Normalization layer
export { gridToChartData, engineToChartData } from './normalize';

// Controller
export { PivotChart } from './PivotChart';
export type { PivotChartOptions, ChartSource } from './PivotChart';

// Built-in zero-dependency adapter (the default)
export { builtinSvgAdapter } from './adapters/svg';

// Reference bring-your-own adapter (Chart.js — optional peer)
export { createChartJsAdapter } from './adapters/chartjs';
export type { ChartJsInstance, ChartJsConstructor } from './adapters/chartjs';

// Optional adapter registry
export { registerAdapter, getAdapter, listAdapters } from './registry';
