/**
 * {@link PivotChart} — the high-level controller that wires a pvotly engine (or
 * a one-shot grid) to a pluggable {@link ChartAdapter}. It owns the normalize →
 * render → update → destroy lifecycle and, when given a live engine, can keep
 * the chart in sync with report changes automatically.
 */
import type { PivotEngine, PivotGrid } from '@pvotly/core';
import type { ChartAdapter, ChartData, ChartRenderOptions, ChartType, NormalizeOptions } from './types';
import { gridToChartData } from './normalize';
import { getAdapter } from './registry';
import { builtinSvgAdapter } from './adapters/svg';

/** A grid source: either a live engine or a pre-computed grid. */
export type ChartSource = PivotEngine | PivotGrid;

/** Options for {@link PivotChart}. Combines normalization + render concerns. */
export interface PivotChartOptions extends NormalizeOptions, ChartRenderOptions {
  /**
   * When the source is a {@link PivotEngine}, re-render automatically on every
   * `reportChange` (default `true`). Ignored for a plain grid source.
   */
  autoUpdate?: boolean;
}

function isEngine(source: ChartSource): source is PivotEngine {
  return typeof (source as PivotEngine).getGrid === 'function';
}

function resolveAdapter<T>(adapter: ChartAdapter<T> | string | undefined): ChartAdapter<T> {
  if (adapter == null) return builtinSvgAdapter as unknown as ChartAdapter<T>;
  if (typeof adapter === 'string') {
    const found = getAdapter(adapter);
    if (!found) throw new Error(`[@pvotly/charts] no adapter registered as "${adapter}"`);
    return found as ChartAdapter<T>;
  }
  return adapter;
}

/**
 * @typeParam TInstance The adapter's instance/handle type.
 *
 * @example
 * ```ts
 * import { PivotChart } from '@pvotly/charts';
 *
 * // Built-in SVG (default), kept in sync with the engine:
 * const chart = new PivotChart(el, engine, undefined, { type: 'bar' });
 *
 * // Switch chart type or adapter at runtime:
 * chart.setType('line');
 * chart.setAdapter(myEChartsAdapter);
 *
 * chart.destroy();
 * ```
 */
export class PivotChart<TInstance = unknown> {
  private readonly container: HTMLElement;
  private readonly source: ChartSource;
  private adapter: ChartAdapter<TInstance>;
  private options: PivotChartOptions;
  private instance: TInstance | null = null;
  private data: ChartData;
  private unsubscribe: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    source: ChartSource,
    adapter?: ChartAdapter<TInstance> | string,
    options: PivotChartOptions = {},
  ) {
    this.container = container;
    this.source = source;
    this.adapter = resolveAdapter<TInstance>(adapter);
    this.options = options;
    this.data = this.normalize();

    this.instance = this.adapter.render(this.container, this.data, this.renderOptions());

    if (isEngine(source) && (options.autoUpdate ?? true)) {
      this.unsubscribe = source.on('reportChange', () => this.update());
    }
  }

  /** The most recently normalized {@link ChartData}. */
  getData(): ChartData {
    return this.data;
  }

  /** The live adapter instance handle (e.g. the `<svg>` or a Chart.js chart). */
  getInstance(): TInstance | null {
    return this.instance;
  }

  /** Re-read the source grid, re-normalize, and update the rendered chart. */
  update(): void {
    this.data = this.normalize();
    if (this.instance == null) {
      this.instance = this.adapter.render(this.container, this.data, this.renderOptions());
      return;
    }
    const next = this.adapter.update(this.instance, this.data, this.renderOptions());
    if (next != null) this.instance = next;
  }

  /** Change the chart kind and re-render. */
  setType(type: ChartType): void {
    this.options = { ...this.options, type };
    this.update();
  }

  /** Merge new normalize/render options and re-render. */
  setOptions(options: Partial<PivotChartOptions>): void {
    this.options = { ...this.options, ...options };
    this.update();
  }

  /** Swap the rendering adapter. The previous instance is destroyed first. */
  setAdapter(adapter: ChartAdapter<TInstance> | string): void {
    if (this.instance != null) this.adapter.destroy(this.instance);
    this.instance = null;
    this.adapter = resolveAdapter<TInstance>(adapter);
    this.data = this.normalize();
    this.instance = this.adapter.render(this.container, this.data, this.renderOptions());
  }

  /** Destroy the chart, unsubscribe from the engine, and release the instance. */
  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.instance != null) this.adapter.destroy(this.instance);
    this.instance = null;
  }

  private normalize(): ChartData {
    const grid = isEngine(this.source) ? this.source.getGrid() : this.source;
    return gridToChartData(grid, this.options);
  }

  private renderOptions(): ChartRenderOptions {
    return this.options;
  }
}
