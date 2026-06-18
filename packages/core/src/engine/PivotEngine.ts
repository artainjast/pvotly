import type {
  AggregationType,
  DataRecord,
  DataSourceConfig,
  DataValue,
  FieldFilter,
  MeasureConfig,
  MemberPath,
  PivotConfiguration,
  PivotGrid,
  Slice,
  SortDirection,
} from '../types';
import { Dataset, FieldInfo } from '../data/dataset';
import { EventEmitter } from '../events';
import { buildGrid } from './build';
import { loadDataSource as resolveDataSource, isAsyncSource } from '../data/source';
import { deserializeGrid } from './serialize';
import type { WorkerRequestMessage, WorkerResponseMessage } from './workerProtocol';

export type Axis = 'rows' | 'columns' | 'measures' | 'reportFilters';

interface PendingWorkerJob {
  resolve: (grid: PivotGrid) => void;
  reject: (error: Error) => void;
}

/** True when this runtime can spawn a Web Worker (browser); false in plain Node. */
function canUseWorker(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Deep-clone a config value while PRESERVING function references. The report can
 * legitimately carry functions — `dataSource.fetcher`, `serverSide.query`,
 * `customAggregators[*]`, `options.worker.factory` — which `structuredClone` and
 * a JSON round-trip would silently drop. Data (objects/arrays/dates) is copied;
 * functions are shared by reference (they cannot be meaningfully cloned anyway).
 */
function clone<T>(value: T): T {
  return deepClone(value) as T;
}

function deepClone(value: unknown): unknown {
  // Primitives AND functions fall through unchanged.
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(deepClone);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return out;
}

/**
 * Stateful orchestrator over a {@link Dataset} and a {@link PivotConfiguration}.
 * Owns the report, applies incremental mutations (drag-drop, sort, filter,
 * expand), lazily rebuilds the computed {@link PivotGrid}, and emits events.
 */
export class PivotEngine extends EventEmitter {
  private dataset: Dataset;
  private config: PivotConfiguration;
  private grid: PivotGrid | null = null;
  private dirty = true;

  /* async data source + worker state */
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private worker: Worker | null = null;
  private workerSeq = 0;
  private readonly workerPending = new Map<number, PendingWorkerJob>();

  constructor(config: PivotConfiguration) {
    super();
    this.config = clone(config);
    this.dataset = new Dataset(this.config.dataSource);
    queueMicrotaskSafe(() => this.emit('ready', undefined));
  }

  /* ---- data ---------------------------------------------------------- */

  updateData(source: DataSourceConfig): void {
    this.config.dataSource = clone(source);
    this.dataset = new Dataset(this.config.dataSource);
    this.invalidate();
    this.emit('dataChange', { records: this.dataset.records.length });
  }

  /** True when the configured data source needs an async fetch (remote/fetcher). */
  hasAsyncSource(): boolean {
    return isAsyncSource(this.config.dataSource);
  }

  /**
   * Resolve the (possibly async) data source — `fetcher`, `remote`, or inline —
   * ingest the records, rebuild, and arm auto-refresh when configured. Call this
   * after construction for `remote`/`fetcher` sources.
   */
  async loadDataSource(): Promise<void> {
    const records = await resolveDataSource(this.config.dataSource);
    this.ingest(records);
    this.emit('dataChange', { records: this.dataset.records.length });
    this.setupAutoRefresh();
  }

  /** Re-fetch the remote/fetcher data source and re-ingest (manual refresh). */
  async refresh(): Promise<void> {
    const records = await resolveDataSource(this.config.dataSource);
    this.ingest(records);
    this.emit('dataChange', { records: this.dataset.records.length });
  }

  /** Stop any auto-refresh timer started by {@link loadDataSource}. */
  stopAutoRefresh(): void {
    if (this.refreshTimer != null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Replace the ingested records in place, reusing field mappings. */
  private ingest(records: DataRecord[]): void {
    // Keep the source descriptor (remote/fetcher) for later refreshes; just
    // swap in the freshly fetched records as the inline `data`.
    this.config.dataSource = { ...this.config.dataSource, data: records };
    this.dataset = new Dataset(this.config.dataSource);
    this.invalidate();
  }

  private setupAutoRefresh(): void {
    this.stopAutoRefresh();
    const interval = this.config.dataSource.remote?.refreshInterval;
    if (interval && interval > 0 && typeof setInterval === 'function') {
      this.refreshTimer = setInterval(() => {
        this.refresh().catch((error) =>
          this.emit('error', { message: 'pvotly auto-refresh failed', error }),
        );
      }, interval);
      // Don't keep a Node process alive solely for this timer.
      (this.refreshTimer as { unref?: () => void })?.unref?.();
    }
  }

  getDataset(): Dataset {
    return this.dataset;
  }

  getFields(): FieldInfo[] {
    return this.dataset.listFields();
  }

  getMembers(uniqueName: string): DataValue[] {
    return this.dataset.getMembers(uniqueName);
  }

  /* ---- configuration / report --------------------------------------- */

  getConfiguration(): PivotConfiguration {
    return clone(this.config);
  }

  /** Alias matching common pivot-tool naming. */
  getReport(): PivotConfiguration {
    return this.getConfiguration();
  }

  /**
   * Replace the whole report. By default the data is re-ingested; pass
   * `{ reuseData: true }` — or simply keep the same `dataSource` object
   * reference — to skip re-ingestion (ingest is roughly half the cost of a
   * rebuild) when only the slice/options/formatting changed.
   */
  setConfiguration(config: PivotConfiguration, opts?: { reuseData?: boolean }): void {
    const reuse = opts?.reuseData ?? config.dataSource === this.config.dataSource;
    this.config = clone(config);
    if (!reuse) this.dataset = new Dataset(this.config.dataSource);
    this.invalidate();
    this.emit('reportChange', this.getConfiguration());
  }

  setReport(config: PivotConfiguration): void {
    this.setConfiguration(config);
  }

  getSlice(): Slice {
    return clone(this.config.slice ?? {});
  }

  setSlice(slice: Slice): void {
    this.config.slice = clone(slice);
    this.changed();
  }

  setOptions(options: PivotConfiguration['options']): void {
    this.config.options = { ...this.config.options, ...options };
    this.changed();
  }

  setFormats(formats: PivotConfiguration['formats']): void {
    this.config.formats = clone(formats);
    this.changed();
  }

  setConditions(conditions: PivotConfiguration['conditions']): void {
    this.config.conditions = clone(conditions);
    this.changed();
  }

  /* ---- slice mutations (drag-drop) ----------------------------------- */

  private slice(): Slice {
    if (!this.config.slice) this.config.slice = {};
    return this.config.slice;
  }

  private removeEverywhere(uniqueName: string): void {
    const s = this.slice();
    s.rows = (s.rows ?? []).filter((f) => f.uniqueName !== uniqueName);
    s.columns = (s.columns ?? []).filter((f) => f.uniqueName !== uniqueName);
    s.reportFilters = (s.reportFilters ?? []).filter((f) => f.uniqueName !== uniqueName);
    s.measures = (s.measures ?? []).filter((m) => m.uniqueName !== uniqueName);
  }

  /** Move/insert a field onto an axis (removing it from any other axis). */
  setFieldAxis(uniqueName: string, axis: Axis, index?: number): void {
    this.removeEverywhere(uniqueName);
    const s = this.slice();
    if (axis === 'measures') {
      const list = (s.measures ??= []);
      const measure = this.defaultMeasure(uniqueName);
      insertAt(list, measure, index);
    } else {
      const list = (s[axis] ??= []);
      insertAt(list, { uniqueName }, index);
    }
    this.changed();
  }

  addToRows(uniqueName: string, index?: number): void {
    this.setFieldAxis(uniqueName, 'rows', index);
  }
  addToColumns(uniqueName: string, index?: number): void {
    this.setFieldAxis(uniqueName, 'columns', index);
  }
  addToValues(uniqueName: string, index?: number): void {
    this.setFieldAxis(uniqueName, 'measures', index);
  }
  addToFilters(uniqueName: string, index?: number): void {
    this.setFieldAxis(uniqueName, 'reportFilters', index);
  }

  removeField(uniqueName: string): void {
    this.removeEverywhere(uniqueName);
    this.changed();
  }

  private defaultMeasure(uniqueName: string): MeasureConfig {
    const info = this.dataset.listFields().find((f) => f.uniqueName === uniqueName);
    const aggregation: AggregationType =
      info?.aggregation ?? this.config.options?.defaultAggregation ?? (info?.isMeasure ? 'sum' : 'count');
    return { uniqueName, aggregation, caption: info?.caption };
  }

  /* ---- measures ------------------------------------------------------ */

  setMeasures(measures: MeasureConfig[]): void {
    this.slice().measures = clone(measures);
    this.changed();
  }

  addCalculatedMeasure(measure: MeasureConfig): void {
    const list = (this.slice().measures ??= []);
    list.push(clone(measure));
    this.changed();
  }

  setAggregation(uniqueName: string, aggregation: AggregationType): void {
    const m = (this.slice().measures ?? []).find((x) => x.uniqueName === uniqueName);
    if (m) {
      m.aggregation = aggregation;
      this.changed();
    }
  }

  setMeasureFormat(uniqueName: string, formatName: string): void {
    const m = (this.slice().measures ?? []).find((x) => x.uniqueName === uniqueName);
    if (m) {
      m.format = formatName;
      this.changed();
    }
  }

  setShowDataAs(uniqueName: string, showDataAs: MeasureConfig['showDataAs']): void {
    const m = (this.slice().measures ?? []).find((x) => x.uniqueName === uniqueName);
    if (m) {
      m.showDataAs = showDataAs;
      this.changed();
    }
  }

  /* ---- sorting ------------------------------------------------------- */

  sortField(uniqueName: string, direction: SortDirection): void {
    const s = this.slice();
    for (const f of [...(s.rows ?? []), ...(s.columns ?? [])]) {
      if (f.uniqueName === uniqueName) f.sort = direction;
    }
    this.changed();
    this.emit('sortChange', { field: uniqueName, direction });
  }

  sortByValue(
    axis: 'rows' | 'columns',
    spec: NonNullable<Slice['sorting']>['row'],
  ): void {
    const s = this.slice();
    s.sorting = s.sorting ?? {};
    if (axis === 'rows') s.sorting.row = spec;
    else s.sorting.column = spec;
    this.changed();
  }

  /* ---- filtering ----------------------------------------------------- */

  setFilter(uniqueName: string, filter: FieldFilter | undefined): void {
    const s = this.slice();
    for (const f of [...(s.rows ?? []), ...(s.columns ?? []), ...(s.reportFilters ?? [])]) {
      if (f.uniqueName === uniqueName) f.filter = filter;
    }
    this.changed();
    this.emit('filterChange', { field: uniqueName, filter });
  }

  clearFilter(uniqueName: string): void {
    this.setFilter(uniqueName, undefined);
  }

  /* ---- expand / collapse -------------------------------------------- */

  private ensureExpands() {
    const s = this.slice();
    s.expands = s.expands ?? {};
    s.expands.rows = s.expands.rows ?? [];
    s.expands.columns = s.expands.columns ?? [];
    return s.expands;
  }

  private ensureDrills() {
    const s = this.slice();
    s.drills = s.drills ?? {};
    s.drills.rows = s.drills.rows ?? [];
    s.drills.columns = s.drills.columns ?? [];
    return s.drills;
  }

  expand(axis: 'rows' | 'columns', path: MemberPath): void {
    const drills = this.ensureDrills();
    const list = drills[axis]!;
    const key = pathString(path);
    const idx = list.findIndex((p) => pathString(p) === key);
    if (idx >= 0) list.splice(idx, 1);
    const expands = this.ensureExpands();
    expands[axis]!.push(path);
    this.changed();
  }

  collapse(axis: 'rows' | 'columns', path: MemberPath): void {
    const expands = this.ensureExpands();
    const elist = expands[axis]!;
    const key = pathString(path);
    const idx = elist.findIndex((p) => pathString(p) === key);
    if (idx >= 0) elist.splice(idx, 1);
    const drills = this.ensureDrills();
    drills[axis]!.push(path);
    this.changed();
  }

  expandAll(): void {
    const s = this.slice();
    s.expands = { expandAll: true, rows: [], columns: [] };
    s.drills = { drillAll: false, rows: [], columns: [] };
    this.changed();
  }

  collapseAll(): void {
    const s = this.slice();
    s.expands = { expandAll: false, rows: [], columns: [] };
    s.drills = { drillAll: true, rows: [], columns: [] };
    this.changed();
  }

  /* ---- drill-through ------------------------------------------------- */

  /** Underlying records contributing to a cell (matching row + column paths). */
  getRecords(rowPath: MemberPath['tuple'] = [], columnPath: MemberPath['tuple'] = []): DataRecord[] {
    const matches = (record: DataRecord, segs: MemberPath['tuple']) =>
      segs.every((seg) => sameValue(this.dataset.resolveValue(record, seg.uniqueName), seg.value));
    return this.dataset.records.filter(
      (r) => matches(r, rowPath) && matches(r, columnPath),
    );
  }

  /* ---- output -------------------------------------------------------- */

  getGrid(): PivotGrid {
    if (this.dirty || !this.grid) {
      this.grid = buildGrid(this.dataset, this.config);
      this.dirty = false;
    }
    return this.grid;
  }

  /**
   * Async grid computation. Routing order:
   *  1. {@link PivotConfiguration.serverSide} — delegate aggregation to a server;
   *  2. `options.useWorker` — build off the main thread in a Web Worker (when a
   *     {@link import('../types').WorkerConfig} is wired and workers exist);
   *  3. otherwise build locally (also the fallback if a worker/server fails).
   */
  async getGridAsync(): Promise<PivotGrid> {
    const server = this.config.serverSide;
    if (server) {
      return server.query({
        dataSource: this.config.dataSource,
        slice: this.config.slice,
        options: this.config.options,
        formats: this.config.formats,
        conditions: this.config.conditions,
        valuesAxis: this.config.valuesAxis ?? this.config.options?.grid?.measurePosition,
      });
    }

    if (this.config.options?.useWorker && canUseWorker()) {
      const job = this.buildOnWorker();
      if (job) {
        try {
          return await job;
        } catch {
          // Any worker failure degrades gracefully to a local build.
        }
      }
    }

    return this.getGrid();
  }

  /** Force a rebuild on the next {@link getGrid}, reusing the ingested dataset. */
  rebuild(): void {
    this.invalidate();
  }

  /** Tear down timers and the worker; detach all event handlers. */
  dispose(): void {
    this.stopAutoRefresh();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const job of this.workerPending.values()) {
      job.reject(new Error('PivotEngine disposed'));
    }
    this.workerPending.clear();
    this.clear();
  }

  /* ---- worker plumbing ---------------------------------------------- */

  /**
   * Build the structured-clone-safe config to hand a worker. Returns `null` when
   * the report can't cross the worker boundary (e.g. it uses function-valued
   * `customAggregators`), so the caller can fall back to a local build.
   */
  private workerConfig(): PivotConfiguration | null {
    const c = this.config;
    if (c.customAggregators && Object.keys(c.customAggregators).length) return null;
    const { worker: _worker, ...options } = c.options ?? {};
    void _worker;
    return {
      // Ship the already-ingested records (no function-valued fetcher/remote).
      dataSource: { data: this.dataset.records, mapping: c.dataSource.mapping },
      slice: c.slice,
      options,
      formats: c.formats,
      conditions: c.conditions,
      localization: c.localization,
      valuesAxis: c.valuesAxis,
      locale: c.locale,
    };
  }

  private buildOnWorker(): Promise<PivotGrid> | null {
    const config = this.workerConfig();
    if (!config) return null;
    const worker = this.ensureWorker();
    if (!worker) return null;
    const id = ++this.workerSeq;
    return new Promise<PivotGrid>((resolve, reject) => {
      this.workerPending.set(id, { resolve, reject });
      worker.postMessage({ id, config } satisfies WorkerRequestMessage);
    });
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    const cfg = this.config.options?.worker;
    let worker: Worker | null = null;
    try {
      if (cfg?.factory) worker = cfg.factory();
      else if (cfg?.url) worker = new Worker(cfg.url, { type: 'module' });
      else return null; // No wiring supplied -> caller builds locally.
    } catch {
      return null;
    }

    worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const { id, grid, error } = event.data;
      const pending = this.workerPending.get(id);
      if (!pending) return;
      this.workerPending.delete(id);
      if (error || !grid) pending.reject(new Error(error ?? 'worker returned no grid'));
      else pending.resolve(deserializeGrid(grid));
    };
    worker.onerror = () => {
      for (const job of this.workerPending.values()) job.reject(new Error('worker error'));
      this.workerPending.clear();
    };

    this.worker = worker;
    return worker;
  }

  private invalidate(): void {
    this.dirty = true;
    this.grid = null;
  }

  private changed(): void {
    this.invalidate();
    this.emit('reportChange', this.getConfiguration());
  }
}

function insertAt<T>(list: T[], item: T, index?: number): void {
  if (index == null || index < 0 || index >= list.length) list.push(item);
  else list.splice(index, 0, item);
}

function pathString(path: MemberPath): string {
  return path.tuple.map((t) => `${t.uniqueName}=${String(t.value)}`).join('/');
}

function sameValue(a: DataValue, b: DataValue): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date) return a.getTime() === new Date(b as never).getTime();
  return a === b;
}

function queueMicrotaskSafe(fn: () => void): void {
  if (typeof queueMicrotask === 'function') queueMicrotask(fn);
  else Promise.resolve().then(fn);
}
