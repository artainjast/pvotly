/**
 * @pvotly/core — public type contract.
 *
 * This file is the keystone of the whole monorepo: the engine, the web renderer
 * and the React wrapper all program against these types. The report shape
 * intentionally mirrors the familiar "slice / options / formats / conditions"
 * layout used by tools like WebDataRocks, so configs feel familiar, but every
 * field here is fully typed and documented.
 */

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

/** A primitive cell value coming from a data source. */
export type DataValue = string | number | boolean | Date | null | undefined;

/** A single input record: a flat map of field name -> value. */
export type DataRecord = Record<string, DataValue>;

/** Logical type of a field, used for grouping, formatting and filtering. */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

/**
 * Date "parts" a date field can be expanded into. Selecting parts turns a
 * single date field into a multi-level hierarchy (Year > Quarter > Month ...).
 */
export type DatePart =
  | 'year'
  | 'quarter'
  | 'month'
  | 'monthName'
  | 'week'
  | 'dayOfMonth'
  | 'weekday'
  | 'date'
  | 'hour'
  | 'minute'
  | 'second';

/** Explicit declaration / override for a source field. */
export interface FieldMapping {
  /** Human readable caption shown in the UI. Defaults to the field name. */
  caption?: string;
  /** Logical type. When omitted it is inferred from the data. */
  type?: FieldType;
  /** For date/datetime fields: expand into these hierarchical parts. */
  dateParts?: DatePart[];
  /** Hide this field from the field list entirely. */
  visible?: boolean;
  /** Treat this numeric field as a measure-only field (never a dimension). */
  isMeasure?: boolean;
  /** Default aggregation to use when this field is dropped into Values. */
  aggregation?: AggregationType;
  /** Default number format name (see {@link NumberFormat}). */
  format?: string;
}

/** Map of field name -> mapping overrides. */
export type FieldMap = Record<string, FieldMapping>;

/** Where the data comes from. Exactly one source should be provided. */
export interface DataSourceConfig {
  /** In-memory array of records (object form). */
  data?: DataRecord[];
  /** Array-of-arrays form: first row is the header. */
  matrix?: DataValue[][];
  /** Raw CSV text to be parsed. */
  csv?: string;
  /** Options applied to {@link csv} parsing. */
  csvOptions?: CsvParseOptions;
  /**
   * Async remote source. When present the engine fetches + ingests the data via
   * {@link import('./engine/PivotEngine').PivotEngine.loadDataSource}. Inline
   * `data`/`matrix`/`csv` still act as the synchronous initial value.
   */
  remote?: RemoteDataSource;
  /**
   * Custom async fetcher returning records. Takes precedence over {@link remote}
   * when both are present. Useful for GraphQL, SDKs or any bespoke transport.
   */
  fetcher?: () => Promise<DataRecord[]> | DataRecord[];
  /** Field type/caption overrides. */
  mapping?: FieldMap;
}

/**
 * Declarative description of an async HTTP data source. Resolved with the global
 * `fetch`, so it works in modern browsers, Node 18+, Deno and Bun.
 */
export interface RemoteDataSource {
  type: 'remote';
  /** Endpoint to fetch. */
  url: string;
  /**
   * Payload format. When omitted it is inferred from the response
   * `Content-Type` header, then the URL extension, defaulting to `json`.
   */
  format?: 'json' | 'csv';
  /** Options applied when the payload is parsed as CSV. */
  csvOptions?: CsvParseOptions;
  /** Passed straight through to `fetch` (headers, method, credentials, signal...). */
  fetchOptions?: RequestInit;
  /**
   * Optional transform from the raw parsed payload (any shape) into the flat
   * record list the engine ingests. Runs after JSON/CSV parsing.
   */
  transform?: (raw: unknown) => DataRecord[] | Promise<DataRecord[]>;
  /** Auto-refresh interval in milliseconds (engine re-fetches on a timer). */
  refreshInterval?: number;
}

export interface CsvParseOptions {
  delimiter?: string;
  /** Whether the first row holds column headers (default true). */
  header?: boolean;
  /** Quote character (default `"`). */
  quote?: string;
  /** Trim whitespace around values (default true). */
  trim?: boolean;
  /** Attempt to coerce numeric / boolean / date strings (default true). */
  dynamicTyping?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

/** Built-in reducers. `none` shows the raw value (flat view / single record). */
export type AggregationType =
  | 'sum'
  | 'count'
  | 'distinctCount'
  | 'average'
  | 'median'
  | 'min'
  | 'max'
  | 'product'
  | 'first'
  | 'last'
  | 'stdev'
  | 'stdevp'
  | 'var'
  | 'varp'
  | 'none';

/**
 * A built-in {@link AggregationType} OR the name of a user-registered custom
 * aggregator (see {@link AggregatorDefinition} / `customAggregators`). The
 * `(string & {})` keeps editor autocomplete for the built-ins while still
 * accepting arbitrary custom names.
 */
export type AggregationName = AggregationType | (string & {});

/**
 * A user-defined aggregation function, registered by name alongside the 15
 * built-ins. Provide EITHER the streaming triplet ({@link init}/{@link reduce}/
 * {@link finalize}) for memory-efficient single-pass reduction, OR the simpler
 * batch {@link evaluate} form that receives every value (and source record) for
 * a cell at once.
 *
 * @example
 * ```ts
 * const range: AggregatorDefinition = {
 *   label: 'Range',
 *   evaluate: (values) => {
 *     const nums = values.filter((v): v is number => typeof v === 'number');
 *     return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
 *   },
 * };
 * ```
 */
export interface AggregatorDefinition {
  /** Human-readable label for UI (defaults to the registered name). */
  label?: string;
  /** Create the per-cell accumulator (streaming form). */
  init?: () => unknown;
  /** Fold one value/record into the accumulator (streaming form). */
  reduce?: (accumulator: unknown, value: DataValue, record: DataRecord) => unknown;
  /** Produce the final cell value from the accumulator (streaming form). */
  finalize?: (accumulator: unknown) => number | DataValue;
  /** Batch form: compute the result from all of a cell's values/records. */
  evaluate?: (values: DataValue[], records: DataRecord[]) => number | DataValue;
}

/**
 * "Show value as" post-processing applied on top of the base aggregation.
 * These are computed once the full grid exists (they need totals / siblings).
 */
export type ShowDataAs =
  | 'raw'
  | 'percentOfGrandTotal'
  | 'percentOfRowTotal'
  | 'percentOfColumnTotal'
  | 'percentOfParentRowTotal'
  | 'percentOfParentColumnTotal'
  | 'runningTotalInRow'
  | 'runningTotalInColumn'
  | 'rankInRow'
  | 'rankInColumn'
  | 'differenceFromPrevRow'
  | 'differenceFromPrevColumn';

/* -------------------------------------------------------------------------- */
/* Slice (the report definition)                                              */
/* -------------------------------------------------------------------------- */

export type SortDirection = 'asc' | 'desc' | 'unsorted';

/** A dimension placed on the Rows / Columns / Filters axis. */
export interface SliceField {
  /** Source field name. For a date part, use `field.part` (e.g. `Date.month`). */
  uniqueName: string;
  caption?: string;
  /** Member-level sort direction for this field. */
  sort?: SortDirection;
  /** Filter applied to this field's members. */
  filter?: FieldFilter;
}

/** A measure placed on the Values axis. */
export interface MeasureConfig {
  /**
   * Source field name, or — for a calculated measure — a unique id that does
   * not collide with a real field.
   */
  uniqueName: string;
  caption?: string;
  /** Base reducer (built-in or custom). Ignored when {@link formula} is present. */
  aggregation?: AggregationName;
  /** "Show value as" transformation. Defaults to `raw`. */
  showDataAs?: ShowDataAs;
  /** Named format (see {@link NumberFormat.name}) or inline format. */
  format?: string;
  /**
   * Calculated-measure formula referencing other measures, e.g.
   * `"sum('price') * sum('quantity')"` or `"#total_revenue / #orders"`.
   * See {@link MeasureConfig.uniqueName} for referencing calculated measures.
   */
  formula?: string;
  /** Whether the calculated measure participates in grand totals. */
  grandTotalCaption?: string;
  active?: boolean;
}

/** Which members of which fields are currently expanded (drilled into). */
export interface ExpandsConfig {
  expandAll?: boolean;
  rows?: MemberPath[];
  columns?: MemberPath[];
}

/** Which member paths are explicitly collapsed (drilled up). */
export interface DrillsConfig {
  drillAll?: boolean;
  rows?: MemberPath[];
  columns?: MemberPath[];
}

/** A path of member values identifying a node in the header tree. */
export interface MemberPath {
  /** Tuple, e.g. `[{ uniqueName: 'Country', value: 'USA' }, ...]`. */
  tuple: Array<{ uniqueName: string; value: DataValue }>;
}

/** Sort a whole axis by the values in a particular row/column tuple. */
export interface ValueSorting {
  /** Sort direction. */
  direction: Exclude<SortDirection, 'unsorted'>;
  /** Measure whose values drive the ordering. */
  measure: string;
  /** The opposite-axis tuple whose values are compared (omit = grand total). */
  tuple?: Array<{ uniqueName: string; value: DataValue }>;
}

export interface SortingConfig {
  /** Sort the columns axis by a row of values. */
  column?: ValueSorting;
  /** Sort the rows axis by a column of values. */
  row?: ValueSorting;
}

export interface Slice {
  rows?: SliceField[];
  columns?: SliceField[];
  measures?: MeasureConfig[];
  reportFilters?: SliceField[];
  expands?: ExpandsConfig;
  drills?: DrillsConfig;
  sorting?: SortingConfig;
  /** Flat-view column sort order. */
  flatSort?: Array<{ uniqueName: string; sort: SortDirection }>;
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

export type FieldFilter = MemberFilter | ValueFilter | LabelFilter | QueryFilter;

/** Include/exclude an explicit set of member values. */
export interface MemberFilter {
  type: 'members';
  /** Members to keep. If present, `exclude` is ignored. */
  include?: DataValue[];
  /** Members to drop. */
  exclude?: DataValue[];
}

/** Keep top/bottom N members ranked by a measure, or threshold comparisons. */
export interface ValueFilter {
  type: 'value';
  /** Measure used to rank/compare. */
  measure: string;
  aggregation?: AggregationName;
  query: ValueQuery;
}

export type ValueQuery =
  | { op: 'top'; count: number }
  | { op: 'bottom'; count: number }
  | { op: 'equal'; value: number }
  | { op: 'notEqual'; value: number }
  | { op: 'greater'; value: number }
  | { op: 'greaterEqual'; value: number }
  | { op: 'less'; value: number }
  | { op: 'lessEqual'; value: number }
  | { op: 'between'; from: number; to: number }
  | { op: 'notBetween'; from: number; to: number };

/** String/label predicate filter on member captions. */
export interface LabelFilter {
  type: 'label';
  query: LabelQuery;
}

export type LabelQuery =
  | { op: 'contains'; value: string }
  | { op: 'notContains'; value: string }
  | { op: 'beginsWith'; value: string }
  | { op: 'endsWith'; value: string }
  | { op: 'equal'; value: string }
  | { op: 'notEqual'; value: string }
  | { op: 'regex'; value: string };

/** Arbitrary predicate (used for date ranges and numeric ranges on members). */
export interface QueryFilter {
  type: 'query';
  query: Record<string, DataValue>;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export interface NumberFormat {
  /** Format name referenced by {@link MeasureConfig.format}. `''` = default. */
  name: string;
  decimalPlaces?: number;
  /** Decimal separator (default `.`). */
  decimalSeparator?: string;
  /** Thousands separator (default `,`; set `''` to disable). */
  thousandsSeparator?: string;
  /** Currency / unit prefix, e.g. `$`. */
  currencySymbol?: string;
  /** Where the currency symbol goes. */
  currencySymbolAlign?: 'left' | 'right';
  /** Render the number as a percentage (multiply by 100 + `%`). */
  isPercent?: boolean;
  /** How to display negatives. `parentheses` => (1,234). */
  negativeFormat?: 'minus' | 'parentheses' | 'redMinus';
  /** Text shown for null/blank measure cells. */
  nullValue?: string;
  /** Text shown when a value is an error (e.g. divide by zero). */
  infinityValue?: string;
  /** Maximum number of significant fractional digits before rounding kicks in. */
  maxDecimalPlaces?: number;
  /** Optional `Intl.DateTimeFormat`-style pattern for date measures. */
  dateTimePattern?: string;
  textAlign?: 'left' | 'center' | 'right';

  /* ---- Intl-based formatting (opt-in, backward compatible) ------------ */
  /**
   * Force the `Intl.NumberFormat` / `Intl.DateTimeFormat` formatting path.
   * It is also implied automatically whenever {@link style}, {@link currency}
   * or {@link dateTimeFormat} is set. When off (default) the legacy manual
   * formatter is used, so existing format specs behave exactly as before.
   */
  intl?: boolean;
  /** BCP-47 locale for this format (overrides the grid-wide locale). */
  locale?: string;
  /** `Intl.NumberFormat` style. Setting this enables the Intl path. */
  style?: 'decimal' | 'currency' | 'percent';
  /** ISO 4217 currency code, required when {@link style} is `'currency'`. */
  currency?: string;
  /** How the currency is displayed in the Intl path. */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  /** Minimum fraction digits (Intl path). */
  minimumFractionDigits?: number;
  /** Maximum fraction digits (Intl path). */
  maximumFractionDigits?: number;
  /** Toggle grouping separators (Intl path). */
  useGrouping?: boolean;
  /** `Intl.DateTimeFormat` options for date measures (enables the Intl path). */
  dateTimeFormat?: Intl.DateTimeFormatOptions;
}

/* -------------------------------------------------------------------------- */
/* Conditional formatting                                                     */
/* -------------------------------------------------------------------------- */

export interface ConditionalFormat {
  /** Restrict to a measure (omit = all measures). */
  measure?: string;
  /** Comparison applied to each matching cell value. */
  condition: ConditionExpr;
  /** Inline style applied when the condition matches. */
  format: CellStyle;
}

export type ConditionExpr =
  | { op: '='; value: number | string }
  | { op: '!='; value: number | string }
  | { op: '>'; value: number }
  | { op: '>='; value: number }
  | { op: '<'; value: number }
  | { op: '<='; value: number }
  | { op: 'between'; from: number; to: number }
  | { op: 'contains'; value: string }
  | { op: 'isTrue' }
  | { op: 'isFalse' };

export interface CellStyle {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
}

/* -------------------------------------------------------------------------- */
/* Options                                                                    */
/* -------------------------------------------------------------------------- */

export type GridType = 'compact' | 'classic' | 'flat';

export interface GridOptions {
  type?: GridType;
  /** Show grand totals on rows. */
  showGrandTotals?: 'on' | 'off' | 'rows' | 'columns';
  /** Show subtotals. */
  showTotals?: 'on' | 'off' | 'rows' | 'columns';
  /** Render row/column header titles. */
  showHeaders?: boolean;
  /** Show the field list filter icons in headers. */
  showFilter?: boolean;
  /** Title shown in the empty top-left corner of the grid. */
  title?: string;
  /**
   * Row-label layout. `'compact'` (default) indents nested members in a single
   * row-header column, as today. `'gutter'` renders an Excel-style outline with
   * a leading narrow gutter column of boxed −/+ expander buttons.
   */
  rowLayout?: 'compact' | 'gutter';
  /** Header caption for the row-labels column when `rowLayout` is `'gutter'` (default `'Row Labels'`). */
  rowLabelsCaption?: string;
  /**
   * Where measures are laid out. `'columns'` (default) makes each measure an
   * innermost column under every column leaf. `'rows'` makes each measure an
   * extra innermost row under every row leaf, with one value column per column leaf.
   */
  measurePosition?: 'columns' | 'rows';
  /**
   * How the table sizes itself horizontally.
   * - `'fill'` (default): the table is at least as wide as its container; when
   *   the columns' total width is smaller, the table stretches to fill it.
   * - `'content'`: the table is exactly the sum of its column widths. Leftover
   *   container space is left empty and columns keep their natural/resized size.
   */
  width?: 'fill' | 'content';
}

export interface PivotOptions {
  grid?: GridOptions;
  /** Show the field-list configurator panel. */
  configuratorActive?: boolean;
  configuratorButton?: boolean;
  showAggregationLabels?: boolean;
  /** Default aggregation when a field is dropped into Values without one. */
  defaultAggregation?: AggregationType;
  /** Virtualize rendering for large datasets. */
  virtualization?: boolean;
  /** Enable drill-through (show underlying records on double-click). */
  drillThrough?: boolean;
  /** Read-only: hide all configuration UI. */
  readOnly?: boolean;
  datePattern?: string;
  dateTimePattern?: string;
  /**
   * BCP-47 locale used by the Intl formatting layer across the whole grid. A
   * per-format {@link NumberFormat.locale} overrides this. Falls back to
   * {@link PivotConfiguration.locale} and finally the runtime default locale.
   */
  locale?: string;
  /**
   * Compute the grid off the main thread via a Web Worker when calling
   * {@link import('./engine/PivotEngine').PivotEngine.getGridAsync}. Degrades
   * gracefully to synchronous, on-thread building when workers are unavailable
   * (e.g. Node) or no {@link worker} wiring is supplied.
   */
  useWorker?: boolean;
  /** How to construct the Web Worker for {@link useWorker} / `getGridAsync`. */
  worker?: WorkerConfig;
}

/**
 * Wiring for the optional aggregation Web Worker. Supply a {@link factory} for
 * full control (recommended with bundlers), or a {@link url} to the built
 * worker entry. When neither is given the engine attempts a best-effort
 * `new Worker(new URL('../worker.js', import.meta.url))` and otherwise falls
 * back to on-thread building.
 */
export interface WorkerConfig {
  /** URL of the built worker entry (the `worker` build output of @pvotly/core). */
  url?: string | URL;
  /** Factory returning a ready-to-use `Worker`. Overrides {@link url}. */
  factory?: () => Worker;
}

/* -------------------------------------------------------------------------- */
/* Localization                                                               */
/* -------------------------------------------------------------------------- */

export interface Localization {
  grandTotal?: string;
  grandTotalLabel?: string;
  totalLabel?: string; // "{0} Total"
  blankMember?: string;
  noData?: string;
  aggregations?: Partial<Record<AggregationType, string>>;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Server-side aggregation                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The request handed to a {@link ServerSideConfig.query} implementation. It is
 * the fully-serializable description of "what grid to compute": the current
 * slice (rows/columns/measures/filters/sort/expansion), display options and
 * formatting. The `dataSource` is included for stateless backends but a typical
 * server keeps the data itself and ignores it.
 */
export interface ServerSidePivotRequest {
  /** The data source descriptor (often ignored by stateful servers). */
  dataSource?: DataSourceConfig;
  slice?: Slice;
  options?: PivotOptions;
  formats?: NumberFormat[];
  conditions?: ConditionalFormat[];
  /** Measure layout, mirrored from {@link PivotConfiguration.valuesAxis}. */
  valuesAxis?: 'columns' | 'rows';
}

/**
 * The response a server returns: a ready-to-render {@link PivotGrid}. Servers
 * can build it with the very same `buildGrid` exported from @pvotly/core (run
 * over a slice of data), or assemble the shape by hand. `getCell` may be omitted
 * by serialized transports and reconstructed on the client via
 * `deserializeGrid`.
 */
export type ServerSideGridResponse = PivotGrid;

/**
 * Hook for delegating aggregation of huge datasets to a server. When present on
 * the configuration, {@link import('./engine/PivotEngine').PivotEngine.getGridAsync}
 * routes through {@link query} instead of building locally. The synchronous
 * {@link import('./engine/PivotEngine').PivotEngine.getGrid} always falls back
 * to local building so callers keep working.
 */
export interface ServerSideConfig {
  query: (request: ServerSidePivotRequest) => Promise<ServerSideGridResponse>;
}

/* -------------------------------------------------------------------------- */
/* The report                                                                 */
/* -------------------------------------------------------------------------- */

/** Full, serializable pivot configuration ("report"). */
export interface PivotConfiguration {
  dataSource: DataSourceConfig;
  slice?: Slice;
  options?: PivotOptions;
  formats?: NumberFormat[];
  conditions?: ConditionalFormat[];
  localization?: Localization;
  /**
   * Where measures are laid out. `'columns'` (default) makes each measure an
   * innermost column; `'rows'` lays measures along the row axis so each row leaf
   * expands into one body row per measure. The computed {@link PivotGrid.body}
   * already reflects this, so renderers just paint it. Mirrors (and takes
   * precedence over) {@link GridOptions.measurePosition}.
   */
  valuesAxis?: 'columns' | 'rows';
  /**
   * User-defined aggregators, registered by name, usable anywhere a
   * {@link MeasureConfig.aggregation} name is accepted (alongside the built-ins).
   * These take precedence over any globally-registered aggregators.
   */
  customAggregators?: Record<string, AggregatorDefinition>;
  /** Grid-wide BCP-47 locale fallback for the Intl formatting layer. */
  locale?: string;
  /** Delegate aggregation to a server for very large datasets. */
  serverSide?: ServerSideConfig;
}

/* -------------------------------------------------------------------------- */
/* Computed output model (what the renderer consumes)                          */
/* -------------------------------------------------------------------------- */

/** A node in the row or column header tree. */
export interface HeaderNode {
  /** Field that produced this level. */
  uniqueName: string;
  /** Member value at this node. */
  value: DataValue;
  /** Caption to display. */
  caption: string;
  /** Depth in the tree (0 = top level). */
  level: number;
  /** Full path from the root to this node (inclusive). */
  path: Array<{ uniqueName: string; value: DataValue }>;
  children: HeaderNode[];
  /** True if currently expanded. */
  expanded: boolean;
  /** True if this node represents a subtotal/total row/column. */
  isTotal?: boolean;
  /** True if this is the grand-total node. */
  isGrandTotal?: boolean;
  /** Number of leaf descendants (drives colspan/rowspan). */
  leafCount: number;
}

/** A fully computed grid cell. */
export interface PivotCell {
  /** Raw aggregated numeric/primitive value (before "show as"). */
  value: number | DataValue;
  /** Value after "show value as" post-processing. */
  displayValue: number | DataValue;
  /** Formatted string ready for display. */
  formatted: string;
  /** Measure that produced this cell. */
  measure: string;
  /** Row header path. */
  rowPath: Array<{ uniqueName: string; value: DataValue }>;
  /** Column header path. */
  columnPath: Array<{ uniqueName: string; value: DataValue }>;
  isTotal: boolean;
  isGrandTotal: boolean;
  /** Resolved conditional-format style, if any. */
  style?: CellStyle;
}

/** The full computed grid handed to a renderer. */
export interface PivotGrid {
  rowTree: HeaderNode[];
  columnTree: HeaderNode[];
  /** Flattened, ordered visible row leaves. */
  rowLeaves: HeaderNode[];
  /** Flattened, ordered visible column leaves. */
  columnLeaves: HeaderNode[];
  measures: MeasureConfig[];
  /** Indexed cell lookup: `cells[rowKey][colKey][measure]`. */
  getCell: (rowPath: HeaderNode, colPath: HeaderNode, measure: MeasureConfig) => PivotCell;
  /** Convenience matrix of body cells in visual order (rows x cols x measures). */
  body: PivotCell[][];
  meta: GridMeta;
}

export interface GridMeta {
  type: GridType;
  rowFieldCount: number;
  columnFieldCount: number;
  measureCount: number;
  totalRows: number;
  totalColumns: number;
  /**
   * Effective measure layout used to build {@link PivotGrid.body}. With
   * `'columns'` each visual body row has `columnLeaves.length * measureCount`
   * cells; with `'rows'` there are `rowLeaves.length * measureCount` visual body
   * rows, each `columnLeaves.length` cells wide.
   */
  valuesAxis: 'columns' | 'rows';
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export type PivotEventMap = {
  ready: void;
  reportChange: PivotConfiguration;
  dataChange: { records: number };
  cellClick: { cell: PivotCell };
  cellDoubleClick: { cell: PivotCell; records: DataRecord[] };
  filterChange: { field: string; filter?: FieldFilter };
  sortChange: { field: string; direction: SortDirection };
  drillThrough: { cell: PivotCell; records: DataRecord[] };
  error: { message: string; error?: unknown };
};

export type PivotEventName = keyof PivotEventMap;
