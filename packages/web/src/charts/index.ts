/**
 * @pvotly/web/charts — a tiny, dependency-free SVG charting helper.
 *
 * Turns a computed {@link PivotGrid} into a simple bar / line / pie chart,
 * rendered as inline SVG. No external libraries; colors come from the small
 * built-in palette and the surrounding `--ph-*` CSS variables (so the chart
 * inherits the active pvotly theme).
 *
 * @example
 * ```ts
 * import { renderChart } from '@pvotly/web';
 *
 * const grid = engine.getGrid();
 * renderChart(document.getElementById('chart')!, grid, { type: 'bar' });
 * ```
 */
import type { MeasureConfig, PivotGrid, HeaderNode } from '@pvotly/core';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ChartType = 'bar' | 'line' | 'pie';

/** Options for {@link renderChart}. */
export interface ChartOptions {
  /** Chart kind. Defaults to `'bar'`. */
  type?: ChartType;
  /** Measure `uniqueName` to plot. Defaults to the grid's first measure. */
  measure?: string;
  /** SVG viewport width in pixels. Defaults to `640`. */
  width?: number;
  /** SVG viewport height in pixels. Defaults to `360`. */
  height?: number;
  /** Optional title rendered above the plot area. */
  title?: string;
}

/** A single named series of numeric values aligned to {@link ChartData.categories}. */
export interface ChartSeries {
  name: string;
  values: number[];
}

/** The flat, chart-ready shape derived from a {@link PivotGrid}. */
export interface ChartData {
  /** One label per row leaf (non-total). */
  categories: string[];
  /** One series per column leaf (non-total) for the chosen measure. */
  series: ChartSeries[];
}

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A small, theme-neutral categorical palette. The first color falls back to
 * the active accent so single-series charts match the surrounding UI.
 */
const PALETTE = [
  'var(--ph-accent, #4f7cff)',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length] as string;
}

/* -------------------------------------------------------------------------- */
/* Data derivation                                                            */
/* -------------------------------------------------------------------------- */

/** Visible leaves that are not subtotal / grand-total nodes. */
function dataLeaves(leaves: HeaderNode[]): HeaderNode[] {
  return leaves.filter((l) => !l.isTotal && !l.isGrandTotal);
}

/** Resolve the measure to plot: by `uniqueName` when given, else the first. */
function pickMeasure(grid: PivotGrid, measure?: string): MeasureConfig | undefined {
  if (measure != null) {
    const found = grid.measures.find((m) => m.uniqueName === measure);
    if (found) return found;
  }
  return grid.measures[0];
}

/** Coerce a cell value into a finite number (NaN/non-numbers become 0). */
function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Derive a flat {@link ChartData} from a computed grid.
 *
 * - **categories** come from the visible, non-total row leaves.
 * - **series** come from the visible, non-total column leaves crossed with the
 *   chosen measure (default: the grid's first measure), reading values via
 *   {@link PivotGrid.getCell}.
 *
 * When the grid has no column dimensions (a single grand-total column leaf),
 * the result is a single series named after the measure.
 */
export function gridToSeries(grid: PivotGrid, opts: { measure?: string } = {}): ChartData {
  const rowLeaves = dataLeaves(grid.rowLeaves);
  const measure = pickMeasure(grid, opts.measure);
  const categories = rowLeaves.map((r) => r.caption);

  if (!measure) return { categories, series: [] };

  const measureLabel = measure.caption ?? measure.uniqueName;
  const colLeaves = dataLeaves(grid.columnLeaves);

  // No real column dimension: one series of the measure across the categories.
  if (colLeaves.length === 0) {
    const colLeaf = grid.columnLeaves[0];
    const values = colLeaf
      ? rowLeaves.map((r) => toNumber(grid.getCell(r, colLeaf, measure).value))
      : rowLeaves.map(() => 0);
    return { categories, series: [{ name: measureLabel, values }] };
  }

  const series: ChartSeries[] = colLeaves.map((colLeaf) => ({
    name: colLeaf.caption || measureLabel,
    values: rowLeaves.map((r) => toNumber(grid.getCell(r, colLeaf, measure).value)),
  }));

  return { categories, series };
}

/* -------------------------------------------------------------------------- */
/* SVG primitives                                                             */
/* -------------------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

type SvgAttrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: SvgAttrs = {},
  ...children: (SVGElement | string)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** "Nice" upper bound for an axis, so gridlines land on round numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

interface Layout {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  plotW: number;
  plotH: number;
}

function makeLayout(width: number, height: number, titleOffset: number): Layout {
  const pad = { top: 16 + titleOffset, right: 16, bottom: 48, left: 56 };
  return {
    width,
    height,
    pad,
    plotW: Math.max(1, width - pad.left - pad.right),
    plotH: Math.max(1, height - pad.top - pad.bottom),
  };
}

/** Shared title + legend chrome; appends to `root` and returns nothing. */
function addTitle(root: SVGElement, title: string | undefined, width: number): void {
  if (!title) return;
  root.append(
    svg(
      'text',
      {
        x: width / 2,
        y: 16,
        'text-anchor': 'middle',
        'font-weight': '600',
        'font-size': '14',
        fill: 'var(--ph-fg, #1a1a2e)',
      },
      title,
    ),
  );
}

function addLegend(root: SVGElement, names: string[], layout: Layout): void {
  if (names.length <= 1) return;
  const y = layout.height - 14;
  let x = layout.pad.left;
  for (let i = 0; i < names.length; i++) {
    const g = svg('g');
    g.append(svg('rect', { x, y: y - 9, width: 10, height: 10, rx: 2, fill: colorAt(i) }));
    g.append(
      svg(
        'text',
        { x: x + 14, y, 'font-size': '11', fill: 'var(--ph-fg-muted, #6b7280)' },
        names[i] ?? '',
      ),
    );
    root.append(g);
    x += 14 + 8 + Math.max(24, (names[i] ?? '').length * 6.5);
  }
}

function addYAxis(root: SVGElement, layout: Layout, max: number, ticks = 4): void {
  const { pad, plotW, plotH } = layout;
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const y = pad.top + plotH - t * plotH;
    const value = max * t;
    root.append(
      svg('line', {
        x1: pad.left,
        y1: y,
        x2: pad.left + plotW,
        y2: y,
        stroke: 'var(--ph-border, #e5e7eb)',
        'stroke-width': '1',
      }),
    );
    root.append(
      svg(
        'text',
        {
          x: pad.left - 8,
          y: y + 3,
          'text-anchor': 'end',
          'font-size': '10',
          fill: 'var(--ph-fg-muted, #6b7280)',
        },
        formatTick(value),
      ),
    );
  }
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(value * 100) / 100);
}

function addCategoryLabels(root: SVGElement, layout: Layout, categories: string[]): void {
  const { pad, plotW, plotH } = layout;
  const band = plotW / Math.max(1, categories.length);
  categories.forEach((cat, i) => {
    const cx = pad.left + band * (i + 0.5);
    root.append(
      svg(
        'text',
        {
          x: cx,
          y: pad.top + plotH + 16,
          'text-anchor': 'middle',
          'font-size': '10',
          fill: 'var(--ph-fg-muted, #6b7280)',
        },
        truncate(cat, 12),
      ),
    );
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function seriesMax(data: ChartData): number {
  let max = 0;
  for (const s of data.series) {
    for (const v of s.values) if (v > max) max = v;
  }
  return niceMax(max);
}

function renderBar(root: SVGElement, data: ChartData, layout: Layout): void {
  const { pad, plotW, plotH } = layout;
  const max = seriesMax(data);
  addYAxis(root, layout, max);

  const nCats = Math.max(1, data.categories.length);
  const nSeries = Math.max(1, data.series.length);
  const band = plotW / nCats;
  const groupPad = band * 0.15;
  const barW = (band - groupPad * 2) / nSeries;

  data.series.forEach((s, si) => {
    s.values.forEach((v, ci) => {
      const h = max > 0 ? (v / max) * plotH : 0;
      const x = pad.left + band * ci + groupPad + barW * si;
      const y = pad.top + plotH - h;
      const rect = svg('rect', {
        x,
        y,
        width: Math.max(0, barW - 1),
        height: Math.max(0, h),
        fill: colorAt(si),
        rx: 1,
      });
      rect.append(svg('title', {}, `${data.categories[ci] ?? ''} · ${s.name}: ${v}`));
      root.append(rect);
    });
  });

  addCategoryLabels(root, layout, data.categories);
  addLegend(root, data.series.map((s) => s.name), layout);
}

function renderLine(root: SVGElement, data: ChartData, layout: Layout): void {
  const { pad, plotW, plotH } = layout;
  const max = seriesMax(data);
  addYAxis(root, layout, max);

  const nCats = Math.max(1, data.categories.length);
  const band = plotW / nCats;
  const xAt = (i: number) => pad.left + band * (i + 0.5);
  const yAt = (v: number) => pad.top + plotH - (max > 0 ? (v / max) * plotH : 0);

  data.series.forEach((s, si) => {
    const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    if (s.values.length > 0) {
      root.append(
        svg('polyline', {
          points,
          fill: 'none',
          stroke: colorAt(si),
          'stroke-width': '2',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        }),
      );
    }
    s.values.forEach((v, i) => {
      const dot = svg('circle', { cx: xAt(i), cy: yAt(v), r: 3, fill: colorAt(si) });
      dot.append(svg('title', {}, `${data.categories[i] ?? ''} · ${s.name}: ${v}`));
      root.append(dot);
    });
  });

  addCategoryLabels(root, layout, data.categories);
  addLegend(root, data.series.map((s) => s.name), layout);
}

function renderPie(root: SVGElement, data: ChartData, layout: Layout): void {
  // Pie shows the first series only; each category becomes a slice.
  const series = data.series[0];
  const values = series ? series.values : [];
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);

  const cx = layout.pad.left + layout.plotW / 2;
  const cy = layout.pad.top + layout.plotH / 2;
  const r = Math.max(8, Math.min(layout.plotW, layout.plotH) / 2 - 8);

  if (total <= 0) {
    root.append(
      svg('circle', {
        cx,
        cy,
        r,
        fill: 'none',
        stroke: 'var(--ph-border, #e5e7eb)',
        'stroke-width': '1',
      }),
    );
    addLegend(root, data.categories, layout);
    return;
  }

  let angle = -Math.PI / 2; // start at 12 o'clock
  values.forEach((raw, i) => {
    const v = Math.max(0, raw);
    if (v <= 0) return;
    const frac = v / total;
    const next = angle + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(next);
    const y2 = cy + r * Math.sin(next);
    const largeArc = frac > 0.5 ? 1 : 0;
    // A single full-circle slice can't be drawn as an arc (x1==x2); use a circle.
    const path =
      frac >= 1
        ? svg('circle', { cx, cy, r, fill: colorAt(i) })
        : svg('path', {
            d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            fill: colorAt(i),
          });
    path.append(
      svg('title', {}, `${data.categories[i] ?? ''}: ${raw} (${(frac * 100).toFixed(1)}%)`),
    );
    root.append(path);
    angle = next;
  });

  addLegend(root, data.categories, layout);
}

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Render an inline SVG chart of `grid` into `container`.
 *
 * The container is cleared first. The chart is dependency-free and themeable
 * via the surrounding `--ph-*` CSS variables.
 */
export function renderChart(
  container: HTMLElement,
  grid: PivotGrid,
  opts: ChartOptions = {},
): void {
  const type: ChartType = opts.type ?? 'bar';
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;

  const data = gridToSeries(grid, { measure: opts.measure });

  while (container.firstChild) container.removeChild(container.firstChild);

  const root = svg('svg', {
    class: 'ph-chart',
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: String(height),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'font-family': 'var(--ph-font, system-ui, sans-serif)',
  });

  addTitle(root, opts.title, width);
  const layout = makeLayout(width, height, opts.title ? 12 : 0);

  if (data.categories.length === 0 || data.series.length === 0) {
    root.append(
      svg(
        'text',
        {
          x: width / 2,
          y: height / 2,
          'text-anchor': 'middle',
          'font-size': '12',
          fill: 'var(--ph-fg-muted, #6b7280)',
        },
        'No data',
      ),
    );
    container.append(root);
    return;
  }

  switch (type) {
    case 'line':
      renderLine(root, data, layout);
      break;
    case 'pie':
      renderPie(root, data, layout);
      break;
    case 'bar':
    default:
      renderBar(root, data, layout);
      break;
  }

  container.append(root);
}
