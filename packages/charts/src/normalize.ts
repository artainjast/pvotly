/**
 * The normalization layer: turn a pvotly grid/engine into the stable,
 * library-agnostic {@link ChartData} shape consumed by every adapter.
 */
import type { HeaderNode, MeasureConfig, PivotEngine, PivotGrid } from '@pvotly/core';
import type { ChartAxisMeta, ChartData, ChartSeries, NormalizeOptions } from './types';

/** Visible leaves, optionally excluding subtotal / grand-total nodes. */
function leaves(nodes: HeaderNode[], includeTotals: boolean): HeaderNode[] {
  return includeTotals ? nodes : nodes.filter((n) => !n.isTotal && !n.isGrandTotal);
}

/** Coerce a cell value into a finite number, or `null` for non-numeric/blank. */
function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Resolve the measures to plot from `opts.measures`, preserving grid order. */
function pickMeasures(grid: PivotGrid, names?: string[]): MeasureConfig[] {
  if (!names || names.length === 0) return grid.measures.slice();
  const result: MeasureConfig[] = [];
  for (const name of names) {
    const found = grid.measures.find((m) => m.uniqueName === name);
    if (found) result.push(found);
  }
  return result;
}

function measureLabel(m: MeasureConfig): string {
  return m.caption ?? m.uniqueName;
}

/** Compute min/max across every value in the series (nulls ignored). */
function valueExtent(series: ChartSeries[]): ChartAxisMeta {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (v == null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 0;
  // Charts generally baseline at zero unless data goes negative.
  return { min: Math.min(0, min), max: Math.max(0, max) };
}

/**
 * Derive a flat, library-agnostic {@link ChartData} from a computed grid.
 *
 * - **categories** come from the visible (non-total) row leaves.
 * - **series** are the cartesian product of the chosen measures × the visible
 *   (non-total) column leaves, read via {@link PivotGrid.getCell}.
 *
 * Series names adapt to the shape:
 * - one measure, no column dims → a single series named after the measure;
 * - one measure, N column leaves → one series per column leaf (column caption);
 * - M measures, one column leaf → one series per measure (measure caption);
 * - M measures × N column leaves → `"<column> · <measure>"`.
 *
 * @example
 * ```ts
 * const data = gridToChartData(engine.getGrid(), { type: 'line' });
 * builtinSvgAdapter.render(el, data, {});
 * ```
 */
export function gridToChartData(grid: PivotGrid, opts: NormalizeOptions = {}): ChartData {
  const includeTotals = opts.includeTotals ?? false;
  const type = opts.type ?? 'bar';

  const rowLeaves = leaves(grid.rowLeaves, includeTotals);
  const colLeaves = leaves(grid.columnLeaves, includeTotals);
  const measures = pickMeasures(grid, opts.measures);

  const categories = rowLeaves.map((r) => r.caption);
  const categoryTitle = grid.rowTree[0]?.uniqueName;

  const series: ChartSeries[] = [];

  if (measures.length > 0 && rowLeaves.length > 0) {
    const multiMeasure = measures.length > 1;
    // When the grid has real column dimensions use those leaves; otherwise fall
    // back to the single (grand-total) column leaf so we still read values.
    const cols = colLeaves.length > 0 ? colLeaves : grid.columnLeaves.slice(0, 1);
    const multiCol = cols.length > 1;

    for (const measure of measures) {
      for (const col of cols) {
        const values = rowLeaves.map((r) => toNumber(grid.getCell(r, col, measure).value));
        const colName = col.caption;
        const name =
          multiMeasure && multiCol
            ? `${colName} · ${measureLabel(measure)}`
            : multiCol
              ? colName || measureLabel(measure)
              : measureLabel(measure);
        series.push({ name, values, measure: measure.uniqueName });
      }
    }
  }

  const value = valueExtent(series);
  const valueTitle = measures.length === 1 ? measureLabel(measures[0] as MeasureConfig) : undefined;

  const data: ChartData = {
    type,
    categories,
    series,
    axes: {
      category: { min: 0, max: Math.max(0, categories.length - 1), ...(categoryTitle ? { title: categoryTitle } : {}) },
      value: { ...value, ...(valueTitle ? { title: valueTitle } : {}) },
    },
  };
  if (opts.title !== undefined) data.title = opts.title;
  return data;
}

/**
 * Convenience wrapper: normalize the engine's *current* grid into {@link ChartData}.
 * Equivalent to `gridToChartData(engine.getGrid(), opts)`.
 */
export function engineToChartData(engine: PivotEngine, opts: NormalizeOptions = {}): ChartData {
  return gridToChartData(engine.getGrid(), opts);
}
