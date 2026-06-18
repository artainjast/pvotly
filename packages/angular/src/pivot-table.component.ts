import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from '@angular/core';
import {
  PivotTable as WebPivotTable,
  type PivotTableOptions,
  type ActionBarConfig,
  type ThemeName,
  type ThemeTokens,
  type ExportFormat,
  type ExportOptions,
} from '@pvotly/web';
import type {
  ConditionalFormat,
  DataRecord,
  DataSourceConfig,
  FieldFilter,
  Localization,
  NumberFormat,
  PivotCell,
  PivotConfiguration,
  PivotEngine,
  PivotEventMap,
  PivotOptions,
  Slice,
  SortDirection,
} from '@pvotly/core';

/**
 * Standalone Angular component wrapping the framework-agnostic `@pvotly/web`
 * widget.
 *
 * Remember to import the stylesheet once in your app (e.g. in `angular.json`
 * `styles` or a global stylesheet):
 *
 * ```ts
 * import '@pvotly/web/styles.css';
 * ```
 *
 * @example
 * ```html
 * <pvotly-table
 *   [dataSource]="{ data }"
 *   [slice]="{ rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] }"
 *   (cellClick)="onCellClick($event)"
 * ></pvotly-table>
 * ```
 */
@Component({
  selector: 'pvotly-table',
  standalone: true,
  template: '<div #host></div>',
})
export class PivotTableComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Host element the widget renders into. */
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

  /* ---- PivotConfiguration inputs ------------------------------------- */

  /** Data source (records, fields, etc.). */
  @Input() dataSource!: DataSourceConfig;
  /** Rows / columns / measures slice. */
  @Input() slice?: Slice;
  /** Engine options (totals, drill-through, etc.). */
  @Input() options?: PivotOptions;
  /** Number-format definitions. */
  @Input() formats?: NumberFormat[];
  /** Conditional-formatting rules. */
  @Input() conditions?: ConditionalFormat[];
  /** Localization strings. */
  @Input() localization?: Localization;

  /* ---- Widget UI inputs ---------------------------------------------- */

  /** Show the toolbar (default true). */
  @Input() toolbar?: boolean;
  /** Show the drag-and-drop field-list panel (default true). */
  @Input() fieldList?: boolean;
  /** Theme name (default 'light'). */
  @Input() theme?: ThemeName;
  /** Typed style tokens applied as CSS variables. */
  @Input() tokens?: ThemeTokens;
  /** Action-bar configuration. */
  @Input() actionBar?: ActionBarConfig;
  /** CSS height for the widget (e.g. 500 or '60vh'). */
  @Input() height?: string | number;
  /** CSS width. */
  @Input() width?: string | number;

  /* ---- Events -------------------------------------------------------- */

  @Output() ready = new EventEmitter<PivotEventMap['ready']>();
  @Output() reportChange = new EventEmitter<PivotEventMap['reportChange']>();
  @Output() dataChange = new EventEmitter<PivotEventMap['dataChange']>();
  @Output() cellClick = new EventEmitter<PivotEventMap['cellClick']>();
  @Output() cellDoubleClick = new EventEmitter<PivotEventMap['cellDoubleClick']>();
  @Output() filterChange = new EventEmitter<PivotEventMap['filterChange']>();
  @Output() sortChange = new EventEmitter<PivotEventMap['sortChange']>();
  @Output() drillThrough = new EventEmitter<PivotEventMap['drillThrough']>();
  @Output() error = new EventEmitter<PivotEventMap['error']>();

  private instance: WebPivotTable | null = null;
  private unsubs: Array<() => void> = [];

  /** The underlying engine for imperative control (available after init). */
  get engine(): PivotEngine | undefined {
    return this.instance?.engine;
  }

  /** The underlying web widget instance (available after init). */
  get widget(): WebPivotTable | null {
    return this.instance;
  }

  ngAfterViewInit(): void {
    const host = this.hostRef.nativeElement;
    this.instance = new WebPivotTable(host, this.buildOptions());

    const map: Array<[keyof PivotEventMap, EventEmitter<unknown>]> = [
      ['ready', this.ready as EventEmitter<unknown>],
      ['reportChange', this.reportChange as EventEmitter<unknown>],
      ['dataChange', this.dataChange as EventEmitter<unknown>],
      ['cellClick', this.cellClick as EventEmitter<unknown>],
      ['cellDoubleClick', this.cellDoubleClick as EventEmitter<unknown>],
      ['filterChange', this.filterChange as EventEmitter<unknown>],
      ['sortChange', this.sortChange as EventEmitter<unknown>],
      ['drillThrough', this.drillThrough as EventEmitter<unknown>],
      ['error', this.error as EventEmitter<unknown>],
    ];
    this.unsubs = map.map(([event, emitter]) =>
      this.instance!.on(event as 'cellClick', ((payload: unknown) =>
        emitter.emit(payload)) as never),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    const instance = this.instance;
    // Before init the constructor picks everything up; nothing to push.
    if (!instance) return;

    const configKeys = ['dataSource', 'slice', 'options', 'formats', 'conditions', 'localization'];
    if (configKeys.some((k) => k in changes)) {
      instance.setConfiguration(this.buildConfiguration());
    }
    if ('theme' in changes && this.theme) instance.setTheme(this.theme);
    if ('tokens' in changes && this.tokens) instance.setTokens(this.tokens);
    if ('actionBar' in changes && this.actionBar) instance.setActionBar(this.actionBar);
  }

  ngOnDestroy(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.instance?.destroy();
    this.instance = null;
  }

  /* ---- Imperative API ------------------------------------------------ */

  getConfiguration(): PivotConfiguration | undefined {
    return this.instance?.getConfiguration();
  }

  setConfiguration(config: PivotConfiguration): void {
    this.instance?.setConfiguration(config);
  }

  /** Apply typed style tokens reactively. */
  setTokens(tokens: ThemeTokens): void {
    this.instance?.setTokens(tokens);
  }

  /** Update the action-bar configuration. */
  setActionBar(config: ActionBarConfig): void {
    this.instance?.setActionBar(config);
  }

  /** Switch the theme without a full reset. */
  setTheme(theme: ThemeName): void {
    this.instance?.setTheme(theme);
  }

  openFieldsDialog(): void {
    this.instance?.openFieldsDialog();
  }

  openFormatDialog(): void {
    this.instance?.openFormatDialog();
  }

  openConditionalDialog(): void {
    this.instance?.openConditionalDialog();
  }

  openFilterDialog(uniqueName: string): void {
    this.instance?.openFilterDialog(uniqueName);
  }

  exportTo(format: ExportFormat, options?: ExportOptions): void {
    this.instance?.exportTo(format, options);
  }

  print(title?: string): void {
    this.instance?.print(title);
  }

  refresh(): void {
    this.instance?.refresh();
  }

  /* ---- internals ----------------------------------------------------- */

  private buildConfiguration(): PivotConfiguration {
    return {
      dataSource: this.dataSource,
      slice: this.slice,
      options: this.options,
      formats: this.formats,
      conditions: this.conditions,
      localization: this.localization,
    };
  }

  private buildOptions(): PivotTableOptions {
    const opts: PivotTableOptions = { ...this.buildConfiguration() };
    if (this.toolbar !== undefined) opts.toolbar = this.toolbar;
    if (this.fieldList !== undefined) opts.fieldList = this.fieldList;
    if (this.theme !== undefined) opts.theme = this.theme;
    if (this.tokens !== undefined) opts.tokens = this.tokens;
    if (this.actionBar !== undefined) opts.actionBar = this.actionBar;
    if (this.height !== undefined) opts.height = this.height;
    if (this.width !== undefined) opts.width = this.width;
    return opts;
  }
}

// Re-export the payload helper types so consumers can type their handlers.
export type {
  PivotCell,
  DataRecord,
  FieldFilter,
  SortDirection,
};
