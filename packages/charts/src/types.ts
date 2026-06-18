/**
 * @pvotly/charts — the library-agnostic contract.
 *
 * pvotly normalizes a computed {@link import('@pvotly/core').PivotGrid} into a
 * stable {@link ChartData} shape. A {@link ChartAdapter} is the single plug-in
 * point that turns that normalized data into pixels with whatever charting
 * library you like (the built-in SVG adapter, Chart.js, ECharts, Highcharts,
 * D3, Recharts, …). pvotly never talks to your chart library directly — it only
 * ever hands it `ChartData`.
 */

/* -------------------------------------------------------------------------- */
/* Normalized data                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The kind of chart to draw. The normalized {@link ChartData} is itself
 * type-agnostic (it is just categories × series), but it carries the requested
 * `type` so adapters can pick an appropriate visual without a second argument.
 */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter';

/** A single named series of numeric values aligned 1:1 with {@link ChartData.categories}. */
export interface ChartSeries {
  /** Display name (a column-leaf caption and/or the measure caption). */
  name: string;
  /** Values aligned to `categories`. `null` marks a gap / missing cell. */
  values: Array<number | null>;
  /** The measure `uniqueName` this series was derived from, if applicable. */
  measure?: string;
}

/** Pre-computed metadata for one axis, handy for adapters that want extents. */
export interface ChartAxisMeta {
  /** Suggested axis title (e.g. the row-field caption or measure caption). */
  title?: string;
  /** Minimum numeric value across the data (0 for the category axis). */
  min: number;
  /** Maximum numeric value across the data. */
  max: number;
}

/**
 * The stable, library-agnostic shape produced by the normalization layer and
 * consumed by every {@link ChartAdapter}. Treat this as the public contract:
 * adapters and consumers can rely on it not changing shape between releases.
 */
export interface ChartData {
  /** The requested chart kind (a hint; the data itself is type-agnostic). */
  type: ChartType;
  /** X-axis category labels — one per (non-total) row leaf. */
  categories: string[];
  /** One entry per series — (column leaf × measure). */
  series: ChartSeries[];
  /** Axis metadata for renderers that want pre-computed titles/extents. */
  axes: {
    /** The category (x) axis. */
    category: ChartAxisMeta;
    /** The value (y) axis. */
    value: ChartAxisMeta;
  };
  /** Optional human-readable chart title. */
  title?: string;
}

/* -------------------------------------------------------------------------- */
/* Adapter plug-in contract                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Options passed to an adapter's {@link ChartAdapter.render} / `update`. These
 * are presentation concerns only; data shaping happens during normalization.
 */
export interface ChartRenderOptions {
  /** Override the chart kind (defaults to {@link ChartData.type}). */
  type?: ChartType;
  /** Pixel width of the drawing surface. Adapters may treat this as a hint. */
  width?: number;
  /** Pixel height of the drawing surface. */
  height?: number;
  /** Title rendered by the adapter (defaults to {@link ChartData.title}). */
  title?: string;
  /** Categorical color palette. Adapters cycle through it per series/slice. */
  palette?: string[];
  /** Escape hatch for adapter-specific options (merged by the adapter). */
  [key: string]: unknown;
}

/**
 * The plug-in interface every renderer implements. It is intentionally tiny:
 * three lifecycle methods over an opaque instance handle `TInstance` (e.g. a
 * Chart.js `Chart`, an ECharts instance, or — for the built-in adapter — the
 * root `<svg>` element).
 *
 * @typeParam TInstance The renderer's instance/handle type.
 *
 * @example
 * ```ts
 * const myAdapter: ChartAdapter<MyChart> = {
 *   name: 'my-lib',
 *   render(container, data, options) {
 *     return new MyChart(container, toMyConfig(data, options));
 *   },
 *   update(instance, data, options) {
 *     instance.setData(toMyConfig(data, options));
 *   },
 *   destroy(instance) {
 *     instance.dispose();
 *   },
 * };
 * ```
 */
export interface ChartAdapter<TInstance = unknown> {
  /** Optional name, used by the registry and for diagnostics. */
  name?: string;
  /**
   * Create the chart inside `container` from normalized `data`.
   * @returns An instance handle passed back to {@link update} / {@link destroy}.
   */
  render(container: HTMLElement, data: ChartData, options: ChartRenderOptions): TInstance;
  /**
   * Apply new `data` to an existing instance. May mutate in place and return
   * `void`, or return a fresh instance handle (which replaces the old one).
   */
  update(instance: TInstance, data: ChartData, options: ChartRenderOptions): TInstance | void;
  /** Tear down the instance and release any resources / DOM it created. */
  destroy(instance: TInstance): void;
}

/** Options accepted by {@link import('./normalize').gridToChartData}. */
export interface NormalizeOptions {
  /**
   * Measure `uniqueName`s to plot, in order. Defaults to every measure present
   * in the grid. Unknown names are ignored.
   */
  measures?: string[];
  /** Chart kind hint stored on the result. Defaults to `'bar'`. */
  type?: ChartType;
  /** Include subtotal / grand-total leaves as categories/series (default false). */
  includeTotals?: boolean;
  /** Optional chart title carried through to {@link ChartData.title}. */
  title?: string;
}
