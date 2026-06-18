import type { HeaderNode, MeasureConfig, PivotConfiguration, PivotGrid } from '@pvotly/core';

/**
 * A flattened, windowing-friendly view of a {@link PivotGrid}. This is the
 * single source of truth the renderer (table + virtualized paths) programs
 * against: ordered value columns, ordered body rows and the spanning column
 * header matrix — all carrying stable ids so resized widths survive rebuilds.
 */
export interface ValueColumn {
  /** Stable id (column-leaf path + measure) used to persist widths. */
  id: string;
  leaf: HeaderNode;
  /** The measure rendered in this column, or null when there are no measures. */
  measure: MeasureConfig | null;
  measureIndex: number;
}

export interface BodyRow {
  /** Stable id (row-node path + measure index). */
  id: string;
  node: HeaderNode;
  /** For measures-on-rows: the measure rendered by this sub-row. */
  measure?: MeasureConfig;
  measureIndex: number;
  /** Whether this row prints the member caption (false for measure sub-rows > 0). */
  showLabel: boolean;
  /** Whether this row prints the gutter expander button. */
  showGutterButton: boolean;
  isTotal: boolean;
  isGrandTotal: boolean;
}

export interface HeaderCell {
  node: HeaderNode;
  caption: string;
  /** Span measured in column *leaves* (not value columns). */
  colspan: number;
  rowspan: number;
  /** First value-column index covered by this header cell (inclusive). */
  valueStart: number;
  /** Last value-column index covered by this header cell (exclusive). */
  valueEnd: number;
}

export interface GridModel {
  grid: PivotGrid;
  measures: MeasureConfig[];
  colLevels: number;
  rowFieldCount: number;
  gutter: boolean;
  measuresOnRows: boolean;
  showMeasureRow: boolean;
  rowLabelsCaption: string;
  gtCaption: string;
  /** Number of leading (row-header) columns: gutter ? 2 : 1. */
  leadingCols: number;
  colLeaves: HeaderNode[];
  /** Spanning member header rows (length === colLevels). */
  headerRows: HeaderCell[][];
  /** The real body columns (one per measure per column-leaf, or per leaf). */
  valueColumns: ValueColumn[];
  bodyRows: BodyRow[];
  empty: boolean;
}

export const ALL_NODE: HeaderNode = {
  uniqueName: '',
  value: null,
  caption: '',
  level: 0,
  path: [],
  children: [],
  expanded: false,
  leafCount: 1,
};

export function grandTotalNode(caption: string): HeaderNode {
  return { ...ALL_NODE, caption, isGrandTotal: true };
}

/** Stable key for a header node based on its member path. */
export function nodePathKey(node: HeaderNode): string {
  if (node.isGrandTotal) return '\u0000GT';
  if (!node.path.length) return '\u0000ALL';
  return node.path.map((p) => `${p.uniqueName}=${valueToken(p.value)}`).join('/');
}

function valueToken(value: unknown): string {
  if (value instanceof Date) return `d${value.getTime()}`;
  if (value === null || value === undefined) return '\u0000';
  return String(value);
}

/** Visible nodes for the compact row axis: every node, recursing when expanded. */
function walkRowsCompact(nodes: HeaderNode[], out: HeaderNode[] = []): HeaderNode[] {
  for (const node of nodes) {
    out.push(node);
    if (node.expanded && node.children.length) walkRowsCompact(node.children, out);
  }
  return out;
}

/** Build spanning column-header rows + the ordered visible leaf columns. */
function buildColumnHeader(
  roots: HeaderNode[],
  levels: number,
): { rows: HeaderCell[][]; leaves: HeaderNode[] } {
  const rows: HeaderCell[][] = Array.from({ length: levels }, () => []);
  const leaves: HeaderNode[] = [];
  const rec = (node: HeaderNode): { span: number; start: number } => {
    const hasKids = node.expanded && node.children.length > 0;
    if (!hasKids) {
      const start = leaves.length;
      leaves.push(node);
      rows[node.level]?.push({
        node,
        caption: node.caption,
        colspan: 1,
        rowspan: levels - node.level,
        valueStart: start,
        valueEnd: start + 1,
      });
      return { span: 1, start };
    }
    let span = 0;
    const start = leaves.length;
    for (const child of node.children) span += rec(child).span;
    rows[node.level]?.push({
      node,
      caption: node.caption,
      colspan: span,
      rowspan: 1,
      valueStart: start,
      valueEnd: start + span,
    });
    return { span, start };
  };
  for (const root of roots) rec(root);
  return { rows, leaves };
}

/** Compute the unified, windowing-friendly model from a computed grid. */
export function buildGridModel(grid: PivotGrid, config: PivotConfiguration): GridModel {
  const measures = grid.measures;
  const colLevels = grid.meta.columnFieldCount;
  const rowFieldCount = grid.meta.rowFieldCount;
  const gridOpts = config.options?.grid ?? {};
  const gtCaption = config.localization?.grandTotal ?? 'Grand Total';
  const gutter = gridOpts.rowLayout === 'gutter' && rowFieldCount > 0;
  // Honor either the renderer's `options.grid.measurePosition` or core's
  // top-level `valuesAxis` contract field, whichever is present.
  const valuesAxis = (config as PivotConfiguration & { valuesAxis?: 'columns' | 'rows' }).valuesAxis;
  const measuresOnRows =
    (gridOpts.measurePosition === 'rows' || valuesAxis === 'rows') && measures.length > 0;
  const rowLabelsCaption = gridOpts.rowLabelsCaption ?? 'Row Labels';
  const showMeasureRow = measures.length > 0 && !measuresOnRows;

  const hasRowGT = grid.rowLeaves.some((l) => l.isGrandTotal);
  const hasColGT = grid.columnLeaves.some((l) => l.isGrandTotal);

  // ---- columns / header matrix ----
  let colLeaves: HeaderNode[];
  let headerRows: HeaderCell[][];
  if (colLevels === 0) {
    colLeaves = [ALL_NODE];
    headerRows = [];
  } else {
    const built = buildColumnHeader(grid.columnTree, colLevels);
    headerRows = built.rows;
    colLeaves = built.leaves;
    if (hasColGT) {
      const gt = grandTotalNode(gtCaption);
      const start = colLeaves.length;
      colLeaves = [...colLeaves, gt];
      headerRows[0]?.push({
        node: gt,
        caption: gtCaption,
        colspan: 1,
        rowspan: colLevels,
        valueStart: start,
        valueEnd: start + 1,
      });
    }
  }

  // ---- value columns (the real body columns) ----
  const valueColumns: ValueColumn[] = [];
  const mult = showMeasureRow ? measures.length : 1;
  if (measuresOnRows) {
    colLeaves.forEach((leaf) => {
      valueColumns.push({
        id: `c:${nodePathKey(leaf)}`,
        leaf,
        measure: measures[0] ?? null,
        measureIndex: 0,
      });
    });
  } else if (measures.length === 0) {
    colLeaves.forEach((leaf) => {
      valueColumns.push({ id: `c:${nodePathKey(leaf)}`, leaf, measure: null, measureIndex: 0 });
    });
  } else {
    colLeaves.forEach((leaf) => {
      measures.forEach((m, mi) => {
        valueColumns.push({
          id: `c:${nodePathKey(leaf)}|m:${m.uniqueName}`,
          leaf,
          measure: m,
          measureIndex: mi,
        });
      });
    });
  }

  // Re-map header leaf-span ranges from leaf units into value-column units.
  if (mult !== 1) {
    for (const row of headerRows) {
      for (const cell of row) {
        cell.valueStart *= mult;
        cell.valueEnd *= mult;
      }
    }
  }

  // ---- body rows ----
  let rowNodes: HeaderNode[];
  if (rowFieldCount === 0) {
    rowNodes = [ALL_NODE];
  } else {
    rowNodes = walkRowsCompact(grid.rowTree);
    if (hasRowGT) rowNodes = [...rowNodes, grandTotalNode(gtCaption)];
  }

  const bodyRows: BodyRow[] = [];
  if (measuresOnRows) {
    for (const node of rowNodes) {
      measures.forEach((m, mi) => {
        bodyRows.push({
          id: `r:${nodePathKey(node)}|m:${mi}`,
          node,
          measure: m,
          measureIndex: mi,
          showLabel: mi === 0,
          showGutterButton: mi === 0,
          isTotal: !!node.isTotal,
          isGrandTotal: !!node.isGrandTotal,
        });
      });
    }
  } else {
    for (const node of rowNodes) {
      bodyRows.push({
        id: `r:${nodePathKey(node)}`,
        node,
        measureIndex: 0,
        showLabel: true,
        showGutterButton: true,
        isTotal: !!node.isTotal,
        isGrandTotal: !!node.isGrandTotal,
      });
    }
  }

  const empty = !rowNodes.length || !measures.length;

  return {
    grid,
    measures,
    colLevels,
    rowFieldCount,
    gutter,
    measuresOnRows,
    showMeasureRow,
    rowLabelsCaption,
    gtCaption,
    leadingCols: gutter ? 2 : 1,
    colLeaves,
    headerRows,
    valueColumns,
    bodyRows,
    empty,
  };
}

/** Row-header column ids (stable; used for width persistence + freeze). */
export const ROWHEAD_COL_ID = '__ph_rowhead__';
export const GUTTER_COL_ID = '__ph_gutter__';
