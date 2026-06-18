import type { HeaderNode, MeasureConfig, PivotConfiguration, SortDirection } from '@pvotly/core';
import type { PivotContext } from '../context';
import { ICONS } from '../icons';
import { clear, h, on } from '../dom';
import { resolveDirection, resolveStrings, type Direction, type UIStrings } from '../i18n';
import {
  buildGridModel,
  GUTTER_COL_ID,
  ROWHEAD_COL_ID,
  type BodyRow,
  type GridModel,
  type HeaderCell,
  type ValueColumn,
} from './model';
import {
  buildTSV,
  cellAt,
  normalizeRange,
  rangeContains,
  writeClipboard,
  type CellCoord,
  type CellRange,
} from './selection';
import { cumulativeOffsets, windowUniform, windowVariable } from './virtual';

const DEFAULT_ROW_HEIGHT = 30;
const DEFAULT_VALUE_WIDTH = 96;
const DEFAULT_ROWHEAD_WIDTH = 180;
const DEFAULT_GUTTER_WIDTH = 34;
const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 22;
const OVERSCAN_ROWS = 6;
const OVERSCAN_PX = 280;
/** Auto-enable virtualization beyond this many body rows. */
const AUTO_VIRT_ROWS = 200;
/** Auto-window columns beyond this many column leaves (single-level headers only). */
const COL_VIRT_LEAVES = 60;

/** Per-container singleton view, so scroll/selection state survives re-renders. */
const views = new WeakMap<HTMLElement, GridView>();

/** Render (or update) the crosstab into `container`. Public, stable entry point. */
export function renderGrid(ctx: PivotContext, container: HTMLElement): void {
  let view = views.get(container);
  if (!view) {
    view = new GridView(ctx, container);
    views.set(container, view);
  }
  view.update();
}

/** Copy the current selection (or focused cell) of a rendered grid as TSV. */
export function copyGridSelection(container: HTMLElement): Promise<boolean> {
  const view = views.get(container);
  return view ? view.copySelection() : Promise.resolve(false);
}

/**
 * Owns the grid DOM for one container. Holds persistent interaction state
 * (scroll position via the container, selection, focus, in-flight resize) and
 * supports both a plain full-table render and a windowed/virtualized render.
 */
class GridView {
  private readonly ctx: PivotContext;
  private readonly scroller: HTMLElement;
  private model!: GridModel;
  private config!: PivotConfiguration;
  private t!: UIStrings;
  private dir: Direction = 'ltr';
  private virtual = false;
  private colVirtual = false;
  private rowHeight = DEFAULT_ROW_HEIGHT;

  // selection / focus (logical body coordinates)
  private anchor: CellCoord | null = null;
  private focus: CellCoord | null = null;
  private range: CellRange | null = null;
  private dragging = false;
  private wantFocus = false;

  private rafScheduled = false;
  private disposers: Array<() => void> = [];

  constructor(ctx: PivotContext, container: HTMLElement) {
    this.ctx = ctx;
    this.scroller = container;
    this.scroller.classList.add('ph-grid-scroller');
    this.disposers.push(on(this.scroller, 'scroll', () => this.onScroll()));
  }

  /* ---- lifecycle ----------------------------------------------------- */

  update(): void {
    const grid = this.ctx.engine.getGrid();
    this.config = this.ctx.engine.getConfiguration();
    this.t = resolveStrings(this.config.localization);
    this.dir = resolveDirection(this.config.localization);
    this.model = buildGridModel(grid, this.config);

    const rowCount = this.model.bodyRows.length;
    const leafCount = this.model.colLeaves.length;
    const explicit = this.config.options?.virtualization === true;
    this.virtual = explicit || rowCount > AUTO_VIRT_ROWS;
    // Column windowing only when headers are single-level (alignment-safe).
    this.colVirtual = this.virtual && this.model.colLevels <= 1 && leafCount > COL_VIRT_LEAVES;
    this.rowHeight = this.ctx.ui.rowHeight || DEFAULT_ROW_HEIGHT;

    // Clamp selection/focus to the new model bounds.
    this.clampState();
    this.scroller.classList.toggle('ph-virtual', this.virtual);
    this.scroller.setAttribute('dir', this.dir);
    this.paint();
  }

  private clampState(): void {
    const maxR = this.model.bodyRows.length - 1;
    const maxC = this.model.valueColumns.length - 1;
    const clamp = (p: CellCoord | null) =>
      p && maxR >= 0 && maxC >= 0
        ? { r: Math.min(p.r, maxR), c: Math.min(p.c, maxC) }
        : null;
    this.anchor = clamp(this.anchor);
    this.focus = clamp(this.focus);
    this.recomputeRange();
  }

  private onScroll(): void {
    if (!this.virtual || this.rafScheduled) return;
    this.rafScheduled = true;
    requestAnimationFrame(() => {
      this.rafScheduled = false;
      this.paint();
    });
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  /* ---- sizing helpers ------------------------------------------------ */

  private colWidth(vc: ValueColumn): number {
    return this.ctx.ui.columnWidths[vc.id] ?? DEFAULT_VALUE_WIDTH;
  }

  private leafWidth(leafIndex: number): number {
    const m = this.model;
    if (m.measuresOnRows || m.measures.length === 0) return this.colWidth(m.valueColumns[leafIndex]!);
    let w = 0;
    const base = leafIndex * m.measures.length;
    for (let i = 0; i < m.measures.length; i++) w += this.colWidth(m.valueColumns[base + i]!);
    return w;
  }

  private rowHeadWidth(): number {
    return this.ctx.ui.columnWidths[ROWHEAD_COL_ID] ?? DEFAULT_ROWHEAD_WIDTH;
  }

  private gutterWidth(): number {
    return this.ctx.ui.columnWidths[GUTTER_COL_ID] ?? DEFAULT_GUTTER_WIDTH;
  }

  private freezeCount(): number {
    return Math.max(0, Math.min(this.ctx.ui.freezeColumns, this.model.valueColumns.length));
  }

  /* ---- paint --------------------------------------------------------- */

  private paint(): void {
    const m = this.model;

    if (m.empty) {
      this.paintEmpty();
      return;
    }

    const valuesPerLeaf = m.measuresOnRows || m.measures.length === 0 ? 1 : m.measures.length;
    const leafCount = m.colLeaves.length;
    const freezeValues = this.freezeCount();
    const frozenLeaves = this.colVirtual
      ? Math.min(Math.ceil(freezeValues / valuesPerLeaf), leafCount)
      : 0;

    // Column window (over leaves).
    let leafStart = frozenLeaves;
    let leafEnd = leafCount;
    let leftSpacer = 0;
    let rightSpacer = 0;
    if (this.colVirtual) {
      const leafWidths = Array.from({ length: leafCount }, (_, i) => this.leafWidth(i));
      const offsets = cumulativeOffsets(leafWidths);
      const lead = this.leadingWidth() + (offsets[frozenLeaves]! - offsets[0]!);
      const win = windowVariable(
        offsets,
        this.scroller.scrollLeft,
        this.scroller.clientWidth || 1,
        lead,
        OVERSCAN_PX,
      );
      leafStart = Math.max(frozenLeaves, win.start);
      leafEnd = Math.max(win.end, leafStart);
      leftSpacer = offsets[leafStart]! - offsets[frozenLeaves]!;
      rightSpacer = offsets[leafCount]! - offsets[leafEnd]!;
    }

    // Row window.
    const rowCount = m.bodyRows.length;
    const rowWin = this.virtual
      ? windowUniform(rowCount, this.rowHeight, this.scroller.scrollTop, this.scroller.clientHeight || 1, OVERSCAN_ROWS)
      : { start: 0, end: rowCount, before: 0, after: 0 };

    const table = h('table', {
      class: 'ph-table',
      attrs: {
        role: 'grid',
        'aria-rowcount': this.totalHeaderRows() + rowCount,
        'aria-colcount': m.leadingCols + m.valueColumns.length,
      },
    });

    table.append(this.buildHead(frozenLeaves, leafStart, leafEnd, leftSpacer, rightSpacer));
    table.append(this.buildBody(rowWin, frozenLeaves, leafStart, leafEnd, leftSpacer, rightSpacer));

    clear(this.scroller);
    this.scroller.append(table);
    this.applyFreeze();
    this.restoreFocus();
  }

  private paintEmpty(): void {
    const m = this.model;
    const table = h('table', { class: 'ph-table', attrs: { role: 'grid' } });
    table.append(
      h(
        'tbody',
        {},
        h(
          'tr',
          { attrs: { role: 'row' } },
          h('td', {
            class: 'ph-empty',
            text: this.t.noData,
            attrs: { colspan: Math.max(m.valueColumns.length + m.leadingCols, 1), role: 'gridcell' },
          }),
        ),
      ),
    );
    clear(this.scroller);
    this.scroller.append(table);
  }

  private totalHeaderRows(): number {
    const m = this.model;
    return m.colLevels + (m.showMeasureRow ? 1 : 0) || 1;
  }

  private leadingWidth(): number {
    return this.rowHeadWidth() + (this.model.gutter ? this.gutterWidth() : 0);
  }

  /* ---- THEAD --------------------------------------------------------- */

  private buildHead(
    frozenLeaves: number,
    leafStart: number,
    leafEnd: number,
    leftSpacer: number,
    rightSpacer: number,
  ): HTMLElement {
    const m = this.model;
    const thead = h('thead', {});
    const totalHeaderRows = this.totalHeaderRows();
    const vpl = this.valuesPerLeaf();

    // Member header levels.
    for (let level = 0; level < m.colLevels; level++) {
      const tr = h('tr', { attrs: { role: 'row', 'aria-rowindex': level + 1 } });
      if (level === 0) this.appendCornerCells(tr, totalHeaderRows);
      const cells = m.headerRows[level] ?? [];
      if (!this.colVirtual) {
        // Full, span-correct render (handles multi-level rowspans natively).
        for (const cell of cells) {
          const startLeaf = Math.floor(cell.valueStart / vpl);
          tr.append(this.buildColHeaderCell(cell, Math.max(1, Math.round(cell.colspan)), startLeaf));
        }
      } else {
        // Single-level windowed render: one cell per leaf (colspan === 1 leaf).
        const byLeaf = new Map<number, HeaderCell>();
        for (const cell of cells) byLeaf.set(Math.floor(cell.valueStart / vpl), cell);
        const emit = (i: number) => {
          const cell = byLeaf.get(i);
          if (cell) tr.append(this.buildColHeaderCell(cell, 1, i));
          else tr.append(h('th', { class: 'ph-col-head', attrs: { scope: 'col', role: 'columnheader' }, style: this.widthStyle(this.leafWidth(i) || DEFAULT_VALUE_WIDTH) }));
        };
        for (let i = 0; i < frozenLeaves; i++) emit(i);
        if (leftSpacer > 0) tr.append(this.headerSpacer(leftSpacer));
        for (let i = leafStart; i < leafEnd; i++) emit(i);
        if (rightSpacer > 0) tr.append(this.headerSpacer(rightSpacer));
      }
      thead.append(tr);
    }

    if (m.colLevels === 0) {
      const tr = h('tr', {
        class: m.showMeasureRow ? 'ph-measure-row' : '',
        attrs: { role: 'row', 'aria-rowindex': 1 },
      });
      this.appendCornerCells(tr, 1);
      if (m.showMeasureRow) this.appendMeasureRow(tr, frozenLeaves, leafStart, leafEnd, leftSpacer, rightSpacer);
      thead.append(tr);
    } else if (m.showMeasureRow) {
      const tr = h('tr', {
        class: 'ph-measure-row',
        attrs: { role: 'row', 'aria-rowindex': m.colLevels + 1 },
      });
      this.appendMeasureRow(tr, frozenLeaves, leafStart, leafEnd, leftSpacer, rightSpacer);
      thead.append(tr);
    }

    return thead;
  }

  /** Iterate visible leaves: frozen prefix, gap, window, trailing gap. */
  private eachVisibleLeaf(
    frozenLeaves: number,
    leafStart: number,
    leafEnd: number,
    leftSpacer: number,
    rightSpacer: number,
    onLeaf: (leafIndex: number) => void,
    onGap: (width: number) => void,
  ): void {
    for (let i = 0; i < frozenLeaves; i++) onLeaf(i);
    if (this.colVirtual && leftSpacer > 0) onGap(leftSpacer);
    for (let i = leafStart; i < leafEnd; i++) onLeaf(i);
    if (this.colVirtual && rightSpacer > 0) onGap(rightSpacer);
  }

  private valuesPerLeaf(): number {
    const m = this.model;
    return m.measuresOnRows || m.measures.length === 0 ? 1 : m.measures.length;
  }

  private appendCornerCells(tr: HTMLElement, rowspan: number): void {
    const m = this.model;
    if (m.gutter) {
      tr.append(
        this.tagFreeze(
          h('th', {
            class: 'ph-corner ph-gutter-corner',
            attrs: { rowspan, scope: 'col', role: 'columnheader' },
            style: this.widthStyle(this.gutterWidth(), this.pinned(GUTTER_COL_ID)),
            dataset: { colId: GUTTER_COL_ID },
          }),
          0,
        ),
      );
      tr.append(this.buildRowLabelsHeader(rowspan));
    } else {
      tr.append(
        this.tagFreeze(
          h('th', {
            class: 'ph-corner',
            attrs: { colspan: 1, rowspan, scope: 'col', role: 'columnheader' },
            style: this.widthStyle(this.rowHeadWidth(), this.pinned(ROWHEAD_COL_ID)),
            dataset: { colId: ROWHEAD_COL_ID },
          }),
          0,
          this.makeColResizer(ROWHEAD_COL_ID),
        ),
      );
    }
  }

  private buildRowLabelsHeader(rowspan: number): HTMLElement {
    const m = this.model;
    const firstRowField = m.grid.rowTree[0]?.uniqueName ?? '';
    const direction = firstRowField ? this.fieldSort(firstRowField) : 'unsorted';
    const th = h('th', {
      class: 'ph-row-labels-head ph-sortable',
      attrs: {
        rowspan,
        scope: 'col',
        role: 'columnheader',
        'aria-sort': ariaSort(direction),
        title: this.sortTitle(direction),
      },
      style: this.widthStyle(this.rowHeadWidth(), this.pinned(ROWHEAD_COL_ID)),
      dataset: { colId: ROWHEAD_COL_ID },
      on: { click: () => this.cycleSort(firstRowField) },
    });
    th.append(h('span', { class: 'ph-caption', text: m.rowLabelsCaption }));
    const ind = sortIndicator(direction);
    if (ind) th.append(ind);
    this.tagFreeze(th, m.gutter ? 1 : 0, this.makeColResizer(ROWHEAD_COL_ID));
    return th;
  }

  private headerSpacer(width: number): HTMLElement {
    return h('th', {
      class: 'ph-col-spacer',
      attrs: { 'aria-hidden': 'true', role: 'presentation' },
      style: this.widthStyle(width, true),
    });
  }

  private buildColHeaderCell(cell: HeaderCell, spanLeaves: number, leafIndex: number): HTMLElement {
    const node = cell.node;
    const hasChildren = node.children.length > 0;
    const direction = node.uniqueName ? this.fieldSort(node.uniqueName) : 'unsorted';
    const width = this.spanWidth(leafIndex, spanLeaves);
    const th = h('th', {
      class: `ph-col-head ph-sortable${node.isGrandTotal ? ' ph-grand-total' : ''}`,
      attrs: {
        colspan: spanLeaves * this.valuesPerLeaf(),
        rowspan: cell.rowspan,
        scope: 'col',
        role: 'columnheader',
        'aria-sort': node.isGrandTotal ? null : ariaSort(direction),
        title: node.isGrandTotal ? null : this.sortTitle(direction),
      },
      style: this.widthStyle(width),
      on: {
        click: () => {
          if (node.isGrandTotal) return;
          this.cycleSort(node.uniqueName);
        },
      },
    });
    if (hasChildren) {
      th.append(
        h('button', {
          class: 'ph-toggle',
          html: node.expanded ? ICONS.expand : ICONS.collapse,
          attrs: { type: 'button', 'aria-label': node.expanded ? this.t.collapse : this.t.expand },
          on: {
            click: (e) => {
              e.stopPropagation();
              this.toggleNode('columns', node);
            },
          },
        }),
      );
    }
    th.append(h('span', { class: 'ph-caption', text: cell.caption }));
    const ind = sortIndicator(direction);
    if (ind && !node.isGrandTotal) th.append(ind);
    return th;
  }

  private spanWidth(leafIndex: number, spanLeaves: number): number {
    let w = 0;
    for (let i = 0; i < spanLeaves; i++) w += this.leafWidth(leafIndex + i) || DEFAULT_VALUE_WIDTH;
    return w;
  }

  private appendMeasureRow(
    tr: HTMLElement,
    frozenLeaves: number,
    leafStart: number,
    leafEnd: number,
    leftSpacer: number,
    rightSpacer: number,
  ): void {
    const m = this.model;
    this.eachVisibleLeaf(
      frozenLeaves,
      leafStart,
      leafEnd,
      leftSpacer,
      rightSpacer,
      (leafIndex) => {
        m.measures.forEach((measure, mi) => {
          const vc = m.valueColumns[leafIndex * m.measures.length + mi];
          if (!vc) return;
          tr.append(
            this.tagColResizable(
              h('th', {
                class: 'ph-measure-head',
                text: measure.caption ?? measure.uniqueName,
                attrs: { scope: 'col', role: 'columnheader' },
                style: this.widthStyle(this.colWidth(vc), this.pinned(vc.id)),
                dataset: { colId: vc.id },
              }),
              vc.id,
            ),
          );
        });
      },
      (width) => tr.append(this.headerSpacer(width)),
    );
  }

  /* ---- TBODY --------------------------------------------------------- */

  private buildBody(
    rowWin: { start: number; end: number; before: number; after: number },
    frozenLeaves: number,
    leafStart: number,
    leafEnd: number,
    leftSpacer: number,
    rightSpacer: number,
  ): HTMLElement {
    const m = this.model;
    const tbody = h('tbody', {});
    const colCount = m.leadingCols + m.valueColumns.length + frozenLeaves + 4;

    if (this.virtual && rowWin.before > 0) tbody.append(spacerRow(rowWin.before, colCount));

    for (let r = rowWin.start; r < rowWin.end; r++) {
      const row = m.bodyRows[r]!;
      tbody.append(this.buildBodyRow(row, r, frozenLeaves, leafStart, leafEnd, leftSpacer, rightSpacer));
    }

    if (this.virtual && rowWin.after > 0) tbody.append(spacerRow(rowWin.after, colCount));
    return tbody;
  }

  private buildBodyRow(
    row: BodyRow,
    r: number,
    frozenLeaves: number,
    leafStart: number,
    leafEnd: number,
    leftSpacer: number,
    rightSpacer: number,
  ): HTMLElement {
    const m = this.model;
    const cls = [row.isGrandTotal ? 'ph-grand-total' : '', row.isTotal ? 'ph-subtotal' : '', m.measuresOnRows ? 'ph-measure-body-row' : '']
      .filter(Boolean)
      .join(' ');
    const heightPx = this.virtual ? this.rowHeight : this.ctx.ui.rowHeights[row.id];
    const tr = h('tr', {
      class: cls,
      attrs: { role: 'row', 'aria-rowindex': this.totalHeaderRows() + r + 1 },
      style: heightPx ? { height: `${heightPx}px` } : undefined,
    });

    if (m.gutter) tr.append(this.buildGutterCell(row));
    tr.append(this.buildRowHeaderCell(row, r));

    const measures = m.measures;
    this.eachVisibleLeaf(
      frozenLeaves,
      leafStart,
      leafEnd,
      leftSpacer,
      rightSpacer,
      (leafIndex) => {
        const leaf = m.colLeaves[leafIndex]!;
        if (m.measuresOnRows) {
          tr.append(this.buildBodyCell(row, leaf, row.measure!, r, leafIndex));
        } else if (measures.length > 0) {
          measures.forEach((measure, mi) => {
            tr.append(this.buildBodyCell(row, leaf, measure, r, leafIndex * measures.length + mi));
          });
        }
      },
      (width) => tr.append(bodySpacer(width)),
    );

    return tr;
  }

  private buildGutterCell(row: BodyRow): HTMLElement {
    const node = row.node;
    const hasChildren = node.children.length > 0 && !node.isGrandTotal;
    const td = h('td', {
      class: `ph-gutter${node.isGrandTotal ? ' ph-grand-total' : ''}${node.isTotal ? ' ph-subtotal' : ''}`,
      attrs: { role: 'rowheader' },
      style: { paddingInlineStart: `${4 + node.level * 16}px` },
    });
    if (hasChildren && row.showGutterButton) {
      td.append(
        h('button', {
          class: 'ph-expander',
          text: node.expanded ? '−' : '+',
          attrs: {
            type: 'button',
            'aria-label': node.expanded ? this.t.collapse : this.t.expand,
            'aria-expanded': node.expanded ? 'true' : 'false',
          },
          on: {
            click: (e) => {
              e.stopPropagation();
              this.toggleNode('rows', node);
            },
          },
        }),
      );
    }
    return this.tagFreeze(td, 0);
  }

  private buildRowHeaderCell(row: BodyRow, r: number): HTMLElement {
    const m = this.model;
    const node = row.node;
    const hasChildren = node.children.length > 0;
    const indent = m.gutter ? 8 + node.level * 16 : 8 + node.level * 18;
    const sortable = !m.gutter && !!node.uniqueName && !node.isGrandTotal;
    const th = h('th', {
      class: `ph-row-head${node.isGrandTotal ? ' ph-grand-total' : ''}${node.isTotal ? ' ph-subtotal' : ''}${sortable ? ' ph-sortable' : ''}`,
      attrs: { scope: 'row', role: 'rowheader', 'aria-rowindex': this.totalHeaderRows() + r + 1 },
      style: { paddingInlineStart: `${indent}px`, ...this.widthStyle(this.rowHeadWidth(), this.pinned(ROWHEAD_COL_ID)) },
      dataset: { colId: ROWHEAD_COL_ID },
    });
    if (!m.gutter && hasChildren) {
      th.append(
        h('button', {
          class: 'ph-toggle',
          html: node.expanded ? ICONS.expand : ICONS.collapse,
          attrs: { type: 'button', 'aria-label': node.expanded ? this.t.collapse : this.t.expand },
          on: {
            click: (e) => {
              e.stopPropagation();
              this.toggleNode('rows', node);
            },
          },
        }),
      );
    }
    if (row.showLabel) th.append(h('span', { class: 'ph-caption', text: node.caption }));
    if (row.measure) {
      th.append(h('span', { class: 'ph-row-measure', text: row.measure.caption ?? row.measure.uniqueName }));
    }
    if (sortable) th.addEventListener('click', () => this.cycleSort(node.uniqueName));
    const idx = m.gutter ? 1 : 0;
    this.tagFreeze(th, idx, this.makeRowResizer(row.id));
    return th;
  }

  private buildBodyCell(
    row: BodyRow,
    colNode: HeaderNode,
    measure: MeasureConfig,
    r: number,
    c: number,
  ): HTMLElement {
    const cell = this.model.grid.getCell(row.node, colNode, measure);
    const vc = this.model.valueColumns[c];
    const selected = rangeContains(this.range, r, c);
    const focused = this.focus?.r === r && this.focus?.c === c;
    // Roving tabindex: the focused cell (or cell 0,0 when nothing is focused yet)
    // is the single tab stop, so keyboard users can enter the grid.
    const isEntry = !this.focus && r === 0 && c === 0;
    const td = h('td', {
      class: [
        'ph-cell',
        cell.isGrandTotal ? 'ph-grand-total' : '',
        cell.isTotal ? 'ph-subtotal' : '',
        selected ? 'ph-selected' : '',
        focused ? 'ph-focused' : '',
      ]
        .filter(Boolean)
        .join(' '),
      text: cell.formatted,
      attrs: {
        role: 'gridcell',
        tabindex: focused || isEntry ? 0 : -1,
        'aria-colindex': this.model.leadingCols + c + 1,
        'aria-selected': selected ? 'true' : null,
      },
      dataset: { r: String(r), c: String(c), colId: vc?.id ?? '' },
      style: vc ? this.widthStyle(this.colWidth(vc), this.pinned(vc.id)) : undefined,
    });
    if (cell.style) Object.assign(td.style, cell.style as Partial<CSSStyleDeclaration>);

    td.addEventListener('pointerdown', (e) => this.onCellPointerDown(e, r, c));
    td.addEventListener('pointerenter', () => this.onCellPointerEnter(r, c));
    td.addEventListener('click', () => this.ctx.engine.emit('cellClick', { cell }));
    td.addEventListener('dblclick', () => {
      const records = this.ctx.engine.getRecords(cell.rowPath, cell.columnPath);
      this.ctx.engine.emit('cellDoubleClick', { cell, records });
      this.ctx.engine.emit('drillThrough', { cell, records });
    });
    td.addEventListener('keydown', (e) => this.onKeyDown(e));
    return td;
  }

  /* ---- selection ----------------------------------------------------- */

  private onCellPointerDown(e: PointerEvent, r: number, c: number): void {
    if (e.button !== 0) return;
    this.wantFocus = true;
    if (e.shiftKey && this.anchor) {
      this.focus = { r, c };
    } else {
      this.anchor = { r, c };
      this.focus = { r, c };
    }
    this.dragging = true;
    this.recomputeRange();
    const off = on(document, 'pointerup', () => {
      this.dragging = false;
      off();
    });
    this.repaintSelection();
  }

  private onCellPointerEnter(r: number, c: number): void {
    if (!this.dragging) return;
    this.focus = { r, c };
    this.recomputeRange();
    this.repaintSelection();
  }

  private recomputeRange(): void {
    this.range = this.anchor && this.focus ? normalizeRange(this.anchor, this.focus) : null;
  }

  /** Re-apply selection/focus classes without rebuilding the whole table. */
  private repaintSelection(): void {
    const cells = this.scroller.querySelectorAll<HTMLElement>('td.ph-cell');
    cells.forEach((td) => {
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      const selected = rangeContains(this.range, r, c);
      const focused = this.focus?.r === r && this.focus?.c === c;
      td.classList.toggle('ph-selected', selected);
      td.classList.toggle('ph-focused', focused);
      td.setAttribute('tabindex', focused ? '0' : '-1');
      if (selected) td.setAttribute('aria-selected', 'true');
      else td.removeAttribute('aria-selected');
    });
    if (this.wantFocus) this.restoreFocus();
  }

  /* ---- keyboard ------------------------------------------------------ */

  private onKeyDown(e: KeyboardEvent): void {
    const maxR = this.model.bodyRows.length - 1;
    const maxC = this.model.valueColumns.length - 1;
    if (maxR < 0 || maxC < 0) return;
    const cur = this.focus ?? { r: 0, c: 0 };
    const rtl = this.dir === 'rtl';
    let next: CellCoord | null = null;
    const pageRows = Math.max(1, Math.floor((this.scroller.clientHeight || this.rowHeight) / this.rowHeight) - 1);

    switch (e.key) {
      case 'ArrowDown':
        next = { r: Math.min(maxR, cur.r + 1), c: cur.c };
        break;
      case 'ArrowUp':
        next = { r: Math.max(0, cur.r - 1), c: cur.c };
        break;
      case 'ArrowRight':
        next = { r: cur.r, c: rtl ? Math.max(0, cur.c - 1) : Math.min(maxC, cur.c + 1) };
        break;
      case 'ArrowLeft':
        next = { r: cur.r, c: rtl ? Math.min(maxC, cur.c + 1) : Math.max(0, cur.c - 1) };
        break;
      case 'Home':
        next = e.ctrlKey || e.metaKey ? { r: 0, c: 0 } : { r: cur.r, c: 0 };
        break;
      case 'End':
        next = e.ctrlKey || e.metaKey ? { r: maxR, c: maxC } : { r: cur.r, c: maxC };
        break;
      case 'PageDown':
        next = { r: Math.min(maxR, cur.r + pageRows), c: cur.c };
        break;
      case 'PageUp':
        next = { r: Math.max(0, cur.r - pageRows), c: cur.c };
        break;
      case 'c':
      case 'C':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          void this.copySelection();
        }
        return;
      case 'Enter': {
        const c = cellAt(this.model, cur.r, cur.c);
        if (c) this.ctx.engine.emit('cellClick', { cell: c });
        return;
      }
      default:
        return;
    }
    if (!next) return;
    e.preventDefault();
    this.focus = next;
    if (e.shiftKey) {
      if (!this.anchor) this.anchor = cur;
    } else {
      this.anchor = next;
    }
    this.recomputeRange();
    this.wantFocus = true;
    this.ensureVisible(next);
    if (this.virtual) this.paint();
    else this.repaintSelection();
  }

  private ensureVisible(coord: CellCoord): void {
    // Vertical
    const top = coord.r * this.rowHeight;
    const bottom = top + this.rowHeight;
    if (this.virtual) {
      if (top < this.scroller.scrollTop) this.scroller.scrollTop = top;
      else if (bottom > this.scroller.scrollTop + this.scroller.clientHeight)
        this.scroller.scrollTop = bottom - this.scroller.clientHeight;
    }
    // Horizontal handled by browser scrollIntoView fallback after focus.
  }

  /* ---- clipboard ----------------------------------------------------- */

  async copySelection(): Promise<boolean> {
    const range = this.range ?? (this.focus ? { r0: this.focus.r, r1: this.focus.r, c0: this.focus.c, c1: this.focus.c } : null);
    if (!range) return false;
    const tsv = buildTSV(this.model, range);
    return writeClipboard(tsv);
  }

  /* ---- focus restore ------------------------------------------------- */

  private restoreFocus(): void {
    if (!this.focus) return;
    const sel = `td.ph-cell[data-r="${this.focus.r}"][data-c="${this.focus.c}"]`;
    const el = this.scroller.querySelector<HTMLElement>(sel);
    if (el) {
      el.setAttribute('tabindex', '0');
      if (this.wantFocus) {
        el.focus?.({ preventScroll: this.virtual });
        if (!this.virtual) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        this.wantFocus = false;
      }
    }
  }

  /* ---- freeze (sticky pinned columns) -------------------------------- */

  private tagFreeze(el: HTMLElement, freezeIndex: number, ...extra: Array<HTMLElement | null>): HTMLElement {
    el.dataset.freeze = String(freezeIndex);
    for (const x of extra) if (x) el.append(x);
    return el;
  }

  private tagColResizable(el: HTMLElement, colId: string): HTMLElement {
    const handle = this.makeColResizer(colId);
    if (handle) el.append(handle);
    return el;
  }

  /**
   * After paint, pin the leading row-header column(s) and the first
   * `freezeColumns` value columns by measuring their rendered widths and
   * assigning cumulative sticky `inset-inline-start` offsets. Works in both
   * LTR and RTL via logical inset properties.
   */
  private applyFreeze(): void {
    const m = this.model;
    const leading = m.leadingCols;
    const freeze = this.freezeCount();
    const totalFrozen = leading + freeze;
    if (totalFrozen <= 0) return;

    // Tag the frozen value columns (header measure cells + body cells), so the
    // leading row-header columns and the first `freeze` value columns all carry
    // a contiguous data-freeze index 0..totalFrozen-1.
    for (let v = 0; v < freeze; v++) {
      const vc = m.valueColumns[v];
      if (!vc) continue;
      const cells = this.scroller.querySelectorAll<HTMLElement>(`[data-col-id="${cssEscape(vc.id)}"]`);
      cells.forEach((cell) => {
        if (cell.classList.contains('ph-row-head') || cell.classList.contains('ph-corner')) return;
        cell.dataset.freeze = String(leading + v);
      });
    }

    // Frozen column widths are deterministic — every leading/value cell is
    // width-pinned via `widthStyle`, so derive offsets from the known widths
    // instead of measuring. Measuring here (getBoundingClientRect) forced a
    // synchronous reflow on every scroll frame and was the main scroll-jank
    // source on large grids.
    const widths: number[] = [];
    for (let i = 0; i < totalFrozen; i++) {
      widths[i] =
        i < leading
          ? i === 0 && m.gutter
            ? this.gutterWidth()
            : this.rowHeadWidth()
          : this.colWidth(m.valueColumns[i - leading]!);
    }

    let offset = 0;
    for (let i = 0; i < totalFrozen; i++) {
      const cells = this.scroller.querySelectorAll<HTMLElement>(`[data-freeze="${i}"]`);
      const off = offset;
      cells.forEach((cell) => {
        cell.style.position = 'sticky';
        cell.style.insetInlineStart = `${off}px`;
        cell.classList.add('ph-frozen');
        if (i === totalFrozen - 1) cell.classList.add('ph-frozen-edge');
      });
      offset += widths[i] ?? 0;
    }
  }

  /* ---- resize handles ------------------------------------------------ */

  private makeColResizer(colId: string): HTMLElement | null {
    const handle = h('span', { class: 'ph-col-resize', attrs: { 'aria-hidden': 'true', title: this.t.resizeColumn } });
    handle.addEventListener('pointerdown', (e) => this.startColResize(e, colId));
    handle.addEventListener('click', (e) => e.stopPropagation());
    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      delete this.ctx.ui.columnWidths[colId];
      this.paint();
    });
    return handle;
  }

  private startColResize(e: PointerEvent, colId: string): void {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const rtl = this.dir === 'rtl';
    const startW = this.ctx.ui.columnWidths[colId] ?? (colId === ROWHEAD_COL_ID ? this.rowHeadWidth() : DEFAULT_VALUE_WIDTH);
    this.scroller.classList.add('ph-resizing');
    const move = (ev: PointerEvent) => {
      const delta = (ev.clientX - startX) * (rtl ? -1 : 1);
      this.ctx.ui.columnWidths[colId] = Math.max(MIN_COL_WIDTH, Math.round(startW + delta));
      this.applyColWidth(colId);
    };
    const up = () => {
      this.scroller.classList.remove('ph-resizing');
      offMove();
      offUp();
      this.paint();
    };
    const offMove = on(document, 'pointermove', move);
    const offUp = on(document, 'pointerup', up);
  }

  /** Live-apply a column width to already-rendered cells (no full repaint). */
  private applyColWidth(colId: string): void {
    const w = this.ctx.ui.columnWidths[colId];
    if (w == null) return;
    const cells = this.scroller.querySelectorAll<HTMLElement>(`[data-col-id="${cssEscape(colId)}"]`);
    cells.forEach((cell) => {
      cell.style.width = `${w}px`;
      cell.style.minWidth = `${w}px`;
      cell.style.maxWidth = `${w}px`;
    });
  }

  private makeRowResizer(rowId: string): HTMLElement | null {
    if (this.virtual) return null; // uniform row height while virtualized
    const handle = h('span', { class: 'ph-row-resize', attrs: { 'aria-hidden': 'true' } });
    handle.addEventListener('pointerdown', (e) => this.startRowResize(e, rowId));
    handle.addEventListener('click', (e) => e.stopPropagation());
    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      delete this.ctx.ui.rowHeights[rowId];
      this.paint();
    });
    return handle;
  }

  private startRowResize(e: PointerEvent, rowId: string): void {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = this.ctx.ui.rowHeights[rowId] ?? (e.target as HTMLElement).closest('tr')?.getBoundingClientRect().height ?? DEFAULT_ROW_HEIGHT;
    this.scroller.classList.add('ph-resizing');
    const move = (ev: PointerEvent) => {
      this.ctx.ui.rowHeights[rowId] = Math.max(MIN_ROW_HEIGHT, Math.round(startH + (ev.clientY - startY)));
      this.paint();
    };
    const up = () => {
      this.scroller.classList.remove('ph-resizing');
      offMove();
      offUp();
      this.paint();
    };
    const offMove = on(document, 'pointermove', move);
    const offUp = on(document, 'pointerup', up);
  }

  /* ---- sorting / expand ---------------------------------------------- */

  private fieldSort(uniqueName: string): SortDirection {
    // Read the live slice (cheap clone, no bulk data) so repeated header clicks
    // before the async re-render still cycle correctly.
    const slice = this.ctx.engine.getSlice();
    for (const f of [...(slice.rows ?? []), ...(slice.columns ?? [])]) {
      if (f.uniqueName === uniqueName) return f.sort ?? 'unsorted';
    }
    return 'unsorted';
  }

  private cycleSort(uniqueName: string): void {
    if (!uniqueName) return;
    const current = this.fieldSort(uniqueName);
    const next: SortDirection = current === 'asc' ? 'desc' : current === 'desc' ? 'unsorted' : 'asc';
    this.ctx.engine.sortField(uniqueName, next);
  }

  private sortTitle(direction: SortDirection): string {
    if (direction === 'asc') return this.t.sortDescending;
    if (direction === 'desc') return this.t.removeSort;
    return this.t.sortAscending;
  }

  private toggleNode(axis: 'rows' | 'columns', node: HeaderNode): void {
    const path = { tuple: node.path.map((p) => ({ uniqueName: p.uniqueName, value: p.value })) };
    if (node.expanded) this.ctx.engine.collapse(axis, path);
    else this.ctx.engine.expand(axis, path);
  }

  /* ---- width style helper ------------------------------------------- */

  private widthStyle(width: number, force = false): Partial<CSSStyleDeclaration> | undefined {
    // Pin widths when virtualizing (geometry needed) or when forced (a column
    // the user has explicitly resized). Otherwise let the browser auto-size.
    if (!this.virtual && !force) return undefined;
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
  }

  /** Whether a column's width should be pinned (virtualized or user-resized). */
  private pinned(colId: string): boolean {
    return this.virtual || this.ctx.ui.columnWidths[colId] !== undefined;
  }
}

/* ---- small module helpers ------------------------------------------- */

function spacerRow(height: number, colspan: number): HTMLElement {
  return h('tr', { class: 'ph-vrow-spacer', attrs: { 'aria-hidden': 'true', role: 'presentation' } },
    h('td', { attrs: { colspan }, style: { height: `${height}px`, padding: '0', border: '0' } }),
  );
}

function bodySpacer(width: number): HTMLElement {
  return h('td', {
    class: 'ph-col-spacer',
    attrs: { 'aria-hidden': 'true', role: 'presentation' },
    style: { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` },
  });
}

function sortIndicator(direction: SortDirection): HTMLElement | null {
  if (direction === 'unsorted') return null;
  return h('span', {
    class: 'ph-sort-ind',
    html: direction === 'asc' ? ICONS.sortAsc : ICONS.sortDesc,
    attrs: { 'aria-hidden': 'true' },
  });
}

function ariaSort(direction: SortDirection): string {
  return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\\]]/g, '\\$&');
}
