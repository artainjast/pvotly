import {
  PivotEngine,
  type PivotConfiguration,
  type PivotEventMap,
  type PivotEventName,
} from '@pvotly/core';
import type { PivotContext } from './context';
import { applyTheme, applyTokens, setThemeTokens, type ThemeName, type ThemeTokens } from './theme';
import { clear, h, resolveTarget } from './dom';
import { ICONS } from './icons';
import { resolveDirection, type Direction } from './i18n';
import { mountToolbar, type ActionBarConfig } from './toolbar/toolbar';
import { mountFieldList } from './fieldlist/fieldList';
import { openFieldsDialog as openFieldsDialogImpl } from './dialogs/fieldsDialog';
import { openFormatDialog as openFormatDialogImpl } from './dialogs/formatDialog';
import { openConditionalDialog as openConditionalDialogImpl } from './dialogs/conditionalDialog';
import { openFilterDialog as openFilterDialogImpl } from './dialogs/filterDialog';
import { renderGrid, copyGridSelection } from './render/grid';
import { downloadExport, printGrid, type ExportFormat, type ExportOptions } from './export';
import { UIState, type UIStateData } from './state/uiState';
import { UndoRedoStack } from './state/history';
import {
  createSnapshot,
  loadFromLocalStorage,
  loadFromUrlHash,
  parseSnapshot,
  saveToLocalStorage,
  saveToUrlHash,
  serializeSnapshot,
  type PivotSnapshot,
  type SerializeOptions,
} from './state/persistence';

/** Values-axis position. Mirrors core's `valuesAxis` contract. */
export type ValuesAxis = 'columns' | 'rows';

export interface PivotTableOptions extends PivotConfiguration {
  /** Show the toolbar (default true). */
  toolbar?: boolean;
  /** Show the drag-and-drop field-list panel (default true). */
  fieldList?: boolean;
  /** Theme name (default 'light'). */
  theme?: ThemeName;
  /** Typed style tokens applied as CSS variables — restyle without writing CSS. */
  tokens?: ThemeTokens;
  /** Configure / style the action bar (toggle built-ins, add custom buttons). */
  actionBar?: ActionBarConfig;
  /** CSS height for the widget (e.g. 500 or '60vh'). */
  height?: string | number;
  /** CSS width. */
  width?: string | number;
  /**
   * Show the horizontal report-filter bar above the grid. When omitted it
   * defaults to `true` if `slice.reportFilters` is non-empty, else `false`.
   * Each report-filter field renders a chip that opens its filter dialog.
   */
  reportFilterBar?: boolean;
  /** Number of leading value columns to freeze (pin) during horizontal scroll. */
  freezeColumns?: number;
  /** Initial renderer UI state (column/row sizes, freeze count). */
  uiState?: UIStateData;
  /** Maximum number of undo/redo states retained (default 50). */
  historyLimit?: number;
}

/**
 * The all-in-one pivot table widget. Owns a {@link PivotEngine}, builds the
 * layout (toolbar / field list / grid), and re-renders on every state change.
 *
 * @example
 * ```ts
 * import { PivotTable } from '@pvotly/web';
 * import '@pvotly/web/styles.css';
 *
 * const pivot = new PivotTable('#app', {
 *   dataSource: { data },
 *   slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
 * });
 * ```
 */
export class PivotTable {
  readonly engine: PivotEngine;
  private readonly root: HTMLElement;
  private readonly toolbarEl: HTMLElement;
  private readonly reportBarEl: HTMLElement;
  private readonly mainEl: HTMLElement;
  private readonly fieldListEl: HTMLElement;
  private readonly gridEl: HTMLElement;
  private readonly dialogLayer: HTMLElement;
  private readonly ctx: PivotContext;
  private showFieldList: boolean;
  private readonly showToolbar: boolean;
  private readonly reportFilterBar?: boolean;
  /** Action-bar configuration (mutable; see {@link setActionBar}). */
  actionBar?: ActionBarConfig;
  /** Renderer-level UI state (column sizes, freeze count). */
  readonly uiState: UIState;
  private readonly history: UndoRedoStack;
  private applyingHistory = false;
  private unsubscribe: () => void;
  private renderScheduled = false;

  constructor(target: string | HTMLElement, options: PivotTableOptions) {
    const {
      toolbar = true,
      fieldList = true,
      theme = 'light',
      tokens,
      actionBar,
      height,
      width,
      reportFilterBar,
      freezeColumns,
      uiState,
      historyLimit,
      ...config
    } = options;
    this.showFieldList = fieldList;
    this.showToolbar = toolbar;
    this.actionBar = actionBar;
    this.reportFilterBar = reportFilterBar;
    this.uiState = new UIState({ ...uiState, freezeColumns: freezeColumns ?? uiState?.freezeColumns });

    this.root = resolveTarget(target);
    this.root.classList.add('ph-root');
    applyTheme(this.root, theme);
    if (tokens) applyTokens(this.root, tokens);
    if (height != null) this.root.style.setProperty('--ph-height', cssSize(height));
    if (width != null) this.root.style.width = cssSize(width);
    clear(this.root);

    this.engine = new PivotEngine(config as PivotConfiguration);
    this.applyDirection();

    this.toolbarEl = h('div', { class: 'ph-toolbar-host' });
    this.reportBarEl = h('div', { class: 'ph-report-bar-host' });
    this.fieldListEl = h('div', { class: 'ph-fieldlist-host' });
    this.gridEl = h('div', { class: 'ph-grid-host' });
    this.mainEl = h('div', { class: 'ph-main' }, this.gridEl, this.fieldListEl);
    this.dialogLayer = h('div', { class: 'ph-dialog-layer', attrs: { hidden: true } });
    this.root.append(this.toolbarEl, this.reportBarEl, this.mainEl, this.dialogLayer);

    this.ctx = {
      engine: this.engine,
      table: this,
      ui: this.uiState,
      refresh: () => this.scheduleRender(),
      openDialog: (content, title, opts) => this.openDialog(content, title, opts),
      closeDialog: () => this.closeDialog(),
    };

    this.history = new UndoRedoStack({ limit: historyLimit });
    this.history.reset(this.captureEntry());

    this.unsubscribe = this.engine.on('reportChange', () => {
      this.scheduleRender();
      if (!this.applyingHistory) this.history.push(this.captureEntry());
    });

    if (this.showToolbar) mountToolbar(this.ctx, this.toolbarEl);
    this.render();
  }

  /** Reflect the localization layout direction onto the root element. */
  private applyDirection(): void {
    const dir = resolveDirection(this.engine.getConfiguration().localization);
    this.root.setAttribute('dir', dir);
    this.root.classList.toggle('ph-rtl', dir === 'rtl');
  }

  /** The current layout direction. */
  get direction(): Direction {
    return resolveDirection(this.engine.getConfiguration().localization);
  }

  /* ---- rendering ----------------------------------------------------- */

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => {
      this.renderScheduled = false;
      this.render();
    });
  }

  private render(): void {
    this.renderReportBar();
    this.fieldListEl.hidden = !this.showFieldList;
    if (this.showFieldList) mountFieldList(this.ctx, this.fieldListEl);
    renderGrid(this.ctx, this.gridEl);
  }

  /** Render the horizontal report-filter chip bar above the grid. */
  private renderReportBar(): void {
    const reportFilters = this.engine.getConfiguration().slice?.reportFilters ?? [];
    const show = this.reportFilterBar ?? reportFilters.length > 0;
    clear(this.reportBarEl);
    if (!show || reportFilters.length === 0) {
      this.reportBarEl.hidden = true;
      return;
    }
    this.reportBarEl.hidden = false;
    const dataset = this.engine.getDataset();
    const bar = h('div', { class: 'ph-report-filters' });
    for (const field of reportFilters) {
      const caption = field.caption ?? dataset.fieldCaption(field.uniqueName);
      const chip = h('button', {
        class: 'ph-report-chip',
        attrs: { type: 'button', 'aria-label': `Filter ${caption}` },
        on: { click: () => this.openFilterDialog(field.uniqueName) },
      });
      chip.append(
        h('span', { class: 'ph-report-chip-icon', html: ICONS.filter }),
        h('span', { class: 'ph-report-chip-label', text: caption }),
      );
      bar.append(chip);
    }
    this.reportBarEl.append(bar);
  }

  /** Force an immediate re-render. */
  refresh(): void {
    this.render();
  }

  /* ---- dialogs ------------------------------------------------------- */

  private openDialog(content: HTMLElement, title = '', opts: { width?: string } = {}): void {
    const dialog = h(
      'div',
      {
        class: 'ph-dialog',
        attrs: { role: 'dialog', 'aria-modal': 'true' },
        style: opts.width ? { width: opts.width, maxWidth: '94%' } : undefined,
      },
      h(
        'div',
        { class: 'ph-dialog-head' },
        h('span', { class: 'ph-dialog-title', text: title }),
        h('button', {
          class: 'ph-dialog-close',
          html: ICONS.close,
          attrs: { type: 'button', 'aria-label': 'Close' },
          on: { click: () => this.closeDialog() },
        }),
      ),
      h('div', { class: 'ph-dialog-body' }, content),
    );
    clear(this.dialogLayer);
    this.dialogLayer.append(
      h('div', {
        class: 'ph-dialog-backdrop',
        on: { click: () => this.closeDialog() },
      }),
      dialog,
    );
    this.dialogLayer.hidden = false;
  }

  closeDialog(): void {
    clear(this.dialogLayer);
    this.dialogLayer.hidden = true;
  }

  /* ---- public API ---------------------------------------------------- */

  getConfiguration(): PivotConfiguration {
    return this.engine.getConfiguration();
  }

  setConfiguration(config: PivotConfiguration): void {
    this.engine.setConfiguration(config);
    this.applyDirection();
    this.render();
  }

  /* ---- values axis (measures on columns / rows) ---------------------- */

  /** Current values-axis position (`'columns'` default, or `'rows'`). */
  getValuesAxis(): ValuesAxis {
    const cfg = this.engine.getConfiguration() as PivotConfiguration & { valuesAxis?: ValuesAxis };
    return cfg.valuesAxis ?? (cfg.options?.grid?.measurePosition === 'rows' ? 'rows' : 'columns');
  }

  /**
   * Move the Values (measures) between the column axis and the row axis. Sets
   * both the core `valuesAxis` contract field and the renderer's
   * `options.grid.measurePosition`, so it works against the current renderer and
   * forward-compatibly once core honors `valuesAxis`.
   */
  setValuesAxis(axis: ValuesAxis): void {
    const cfg = this.engine.getConfiguration() as PivotConfiguration & { valuesAxis?: ValuesAxis };
    cfg.valuesAxis = axis;
    cfg.options = {
      ...cfg.options,
      grid: { ...cfg.options?.grid, measurePosition: axis },
    };
    this.engine.setConfiguration(cfg);
    this.render();
  }

  /* ---- freeze / sizing ----------------------------------------------- */

  /** Freeze (pin) the first `count` value columns during horizontal scroll. */
  freezeColumns(count: number): void {
    this.uiState.freezeColumns = Math.max(0, Math.floor(count));
    this.render();
  }

  /** Set the width (px) of a column by its renderer id (or reset with null). */
  setColumnWidth(columnId: string, width: number | null): void {
    if (width == null) delete this.uiState.columnWidths[columnId];
    else this.uiState.columnWidths[columnId] = Math.max(1, Math.round(width));
    this.render();
  }

  /** Forget all user resize/size overrides. */
  resetSizes(): void {
    this.uiState.clearSizes();
    this.render();
  }

  /** Snapshot of the renderer UI state. */
  getUIState(): UIStateData {
    return this.uiState.data;
  }

  /** Replace the renderer UI state and re-render. */
  setUIState(data: UIStateData): void {
    this.uiState.set(data);
    this.render();
  }

  /* ---- undo / redo --------------------------------------------------- */

  private captureEntry() {
    const { dataSource, ...report } = this.engine.getConfiguration();
    void dataSource;
    return { report: report as PivotConfiguration, ui: this.uiState.data };
  }

  private applyEntry(entry: { report: PivotConfiguration; ui?: UIStateData }): void {
    this.applyingHistory = true;
    const dataSource = this.engine.getConfiguration().dataSource;
    if (entry.ui) this.uiState.set(entry.ui);
    this.engine.setConfiguration({ ...entry.report, dataSource });
    this.applyingHistory = false;
    this.applyDirection();
    this.render();
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  /** Revert to the previous report/UI state. Returns false when at the start. */
  undo(): boolean {
    const entry = this.history.undo();
    if (!entry) return false;
    this.applyEntry(entry);
    return true;
  }

  /** Re-apply the next report/UI state. Returns false when at the end. */
  redo(): boolean {
    const entry = this.history.redo();
    if (!entry) return false;
    this.applyEntry(entry);
    return true;
  }

  /* ---- save / restore ------------------------------------------------ */

  /** Serialize the full report + UI state to a JSON string. */
  serializeState(options?: SerializeOptions): string {
    return serializeSnapshot(this.engine.getConfiguration(), this.uiState.data, options);
  }

  /** A structured snapshot of the report + UI state. */
  getSnapshot(options?: SerializeOptions): PivotSnapshot {
    return createSnapshot(this.engine.getConfiguration(), this.uiState.data, options);
  }

  /** Restore from a snapshot object or JSON string (keeps the current data). */
  restoreState(source: PivotSnapshot | string): boolean {
    const snapshot = typeof source === 'string' ? parseSnapshot(source) : source;
    if (!snapshot?.report) return false;
    const dataSource = this.engine.getConfiguration().dataSource;
    const restoredData = snapshot.report.dataSource;
    const mergedSource =
      restoredData && (restoredData.data || restoredData.matrix || restoredData.csv)
        ? restoredData
        : { ...restoredData, ...dataSource };
    this.uiState.set(snapshot.ui ?? {});
    this.engine.setConfiguration({ ...snapshot.report, dataSource: mergedSource });
    this.applyDirection();
    this.history.reset(this.captureEntry());
    this.render();
    return true;
  }

  /** Persist the current state to `localStorage`. */
  saveToLocalStorage(options?: SerializeOptions & { key?: string }): boolean {
    return saveToLocalStorage(this.engine.getConfiguration(), this.uiState.data, options);
  }

  /** Restore state previously written with {@link saveToLocalStorage}. */
  loadFromLocalStorage(key?: string): boolean {
    const snapshot = loadFromLocalStorage(key);
    return snapshot ? this.restoreState(snapshot) : false;
  }

  /** Persist the current state into `location.hash`. */
  saveToUrlHash(options?: SerializeOptions & { key?: string }): boolean {
    return saveToUrlHash(this.engine.getConfiguration(), this.uiState.data, options);
  }

  /** Restore state previously written with {@link saveToUrlHash}. */
  loadFromUrlHash(key?: string): boolean {
    const snapshot = loadFromUrlHash(key);
    return snapshot ? this.restoreState(snapshot) : false;
  }

  /** Copy the current grid selection (or focused cell) to the clipboard as TSV. */
  copySelection(): Promise<boolean> {
    return copyGridSelection(this.gridEl);
  }

  on<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): () => void {
    return this.engine.on(event, handler);
  }

  off<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): void {
    this.engine.off(event, handler);
  }

  setTheme(theme: ThemeName): void {
    applyTheme(this.root, theme);
  }

  setThemeTokens(tokens: Record<string, string>): void {
    setThemeTokens(this.root, tokens);
  }

  /** Apply typed style tokens (the same shape as the `tokens` option). */
  setTokens(tokens: ThemeTokens): void {
    applyTokens(this.root, tokens);
  }

  toggleFieldList(show?: boolean): void {
    this.showFieldList = show ?? !this.showFieldList;
    this.render();
  }

  /** Open the modal "Fields" configurator (drag-drop + checklist + Apply/Cancel). */
  openFieldsDialog(): void {
    openFieldsDialogImpl(this.ctx);
  }

  /** Open the number-format dialog (wire this to your own action-bar button). */
  openFormatDialog(): void {
    openFormatDialogImpl(this.ctx);
  }

  /** Open the conditional-formatting dialog. */
  openConditionalDialog(): void {
    openConditionalDialogImpl(this.ctx);
  }

  /** Open the filter dialog for a specific field. */
  openFilterDialog(uniqueName: string): void {
    openFilterDialogImpl(this.ctx, uniqueName);
  }

  /** Update the action-bar configuration and re-render the toolbar. */
  setActionBar(config: ActionBarConfig): void {
    this.actionBar = config;
    if (this.showToolbar) mountToolbar(this.ctx, this.toolbarEl);
  }

  async toggleFullscreen(): Promise<void> {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await this.root.requestFullscreen?.();
  }

  exportTo(format: ExportFormat, options?: ExportOptions): void {
    downloadExport(this.engine.getGrid(), format, options);
  }

  print(title?: string): void {
    printGrid(this.engine.getGrid(), title);
  }

  /** The root element of the widget. */
  get element(): HTMLElement {
    return this.root;
  }

  destroy(): void {
    this.unsubscribe();
    this.engine.clear();
    clear(this.root);
    this.root.classList.remove('ph-root');
  }
}

function cssSize(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value;
}
