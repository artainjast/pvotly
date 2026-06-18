# pvotly API Reference

pvotly is a framework-agnostic pivot table toolkit published under the
`@pvotly/*` scope. This document enumerates the public exports of each
package.

| Package           | Version | Description                                                        |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `@pvotly/core` | 0.1.0   | Framework-agnostic engine: data model, aggregation, build, types.  |
| `@pvotly/web`  | 0.1.0   | DOM widget: toolbar, field list, grid renderer, dialogs, exports.  |
| `@pvotly/react`| 0.1.0   | Declarative React bindings: `<PivotTable />` and `usePivotEngine`. |

License: MIT.

Both `@pvotly/web` and `@pvotly/react` re-export everything from
`@pvotly/core`, so a single import can pull in the engine, its types and the
UI.

---

## `@pvotly/core`

```ts
import {
  PivotEngine,
  Dataset,
  buildGrid,
  EventEmitter,
  compareValues,
} from '@pvotly/core';
```

### Public exports

| Export                                                        | Kind            |
| ------------------------------------------------------------- | --------------- |
| `PivotEngine`                                                 | class           |
| `Dataset`                                                     | class           |
| `EventEmitter`                                                | class           |
| `buildGrid`                                                   | function        |
| `compareValues`                                               | function        |
| `createAggregator`, `AGGREGATION_LABELS`                      | function / const |
| `formatValue`, `formatDate`, `resolveFormat`, `DEFAULT_FORMAT`| function / const |
| `compileFormula`                                             | function        |
| `resolveCellStyle`                                            | function        |
| `datePartValue`, `datePartCaption`, `toDate`, `MONTH_NAMES`, `WEEKDAY_NAMES` | function / const |
| `parseCsv`, `parseCsvToMatrix`                                | function        |
| `inferFieldType`, `normalizeValue`, `discoverFields`          | function        |
| `buildMemberTree`, `prefixKeys`, `pathKey`, `valueToken`, `flatten`, `flattenCompact`, `flattenClassic`, `flattenFlat` | function |
| `Axis`, `FieldInfo`, `Aggregator`, `CompiledFormula`, `AggRef`, `AggResolver`, `MemberNode`, `PathSeg`, `VisibleNode` | type |
| All types from `./types` (see [Types](#core-types))          | type            |

### `PivotEngine`

Stateful orchestrator over a [`Dataset`](#dataset) and a
[`PivotConfiguration`](#core-types). It owns the report, applies incremental
mutations (drag-drop, sort, filter, expand), lazily rebuilds the computed
[`PivotGrid`](#core-types), and emits events. It extends
[`EventEmitter`](#eventemitter), so `on`, `once`, `off`, `emit` and `clear` are
available.

```ts
type Axis = 'rows' | 'columns' | 'measures' | 'reportFilters';

class PivotEngine extends EventEmitter {
  constructor(config: PivotConfiguration);
}
```

#### Data

| Method                                  | Signature                                  | Description                                  |
| --------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `updateData`                            | `(source: DataSourceConfig): void`         | Replace the data source and invalidate.      |
| `getDataset`                            | `(): Dataset`                              | The underlying normalized dataset.           |
| `getFields`                             | `(): FieldInfo[]`                          | Field-list metadata for every field.         |
| `getMembers`                            | `(uniqueName: string): DataValue[]`        | Distinct, sorted member values for a field.  |

#### Configuration / report

| Method               | Signature                                                  | Description                               |
| -------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `getConfiguration`   | `(): PivotConfiguration`                                  | Deep clone of the current report.         |
| `getReport`          | `(): PivotConfiguration`                                  | Alias for `getConfiguration`.             |
| `setConfiguration`   | `(config: PivotConfiguration): void`                     | Replace the whole report.                 |
| `setReport`          | `(config: PivotConfiguration): void`                     | Alias for `setConfiguration`.             |
| `getSlice`           | `(): Slice`                                               | Clone of the current slice.               |
| `setSlice`           | `(slice: Slice): void`                                    | Replace the slice.                        |
| `setOptions`         | `(options: PivotConfiguration['options']): void`         | Merge in option overrides.                |
| `setFormats`         | `(formats: PivotConfiguration['formats']): void`         | Replace number formats.                   |
| `setConditions`      | `(conditions: PivotConfiguration['conditions']): void`   | Replace conditional formats.              |

#### Slice mutations (drag-drop)

| Method          | Signature                                              | Description                                       |
| --------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `setFieldAxis`  | `(uniqueName: string, axis: Axis, index?: number): void` | Move/insert a field onto an axis (removing it elsewhere). |
| `addToRows`     | `(uniqueName: string, index?: number): void`          | Place a field on the Rows axis.                   |
| `addToColumns`  | `(uniqueName: string, index?: number): void`          | Place a field on the Columns axis.                |
| `addToValues`   | `(uniqueName: string, index?: number): void`          | Place a field on the Values (measures) axis.      |
| `addToFilters`  | `(uniqueName: string, index?: number): void`          | Place a field on the report-filters axis.         |
| `removeField`   | `(uniqueName: string): void`                          | Remove a field from every axis.                   |

#### Measures

| Method                 | Signature                                                       | Description                                  |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| `setMeasures`          | `(measures: MeasureConfig[]): void`                            | Replace the measure list.                    |
| `addCalculatedMeasure` | `(measure: MeasureConfig): void`                               | Append a measure (e.g. with a `formula`).    |
| `setAggregation`       | `(uniqueName: string, aggregation: AggregationType): void`     | Change a measure's reducer.                   |
| `setMeasureFormat`     | `(uniqueName: string, formatName: string): void`              | Set a measure's named format.                |
| `setShowDataAs`        | `(uniqueName: string, showDataAs: MeasureConfig['showDataAs']): void` | Set "show value as" post-processing.  |

#### Sorting

| Method        | Signature                                                                | Description                                |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `sortField`   | `(uniqueName: string, direction: SortDirection): void`                  | Member-level sort for a row/column field.  |
| `sortByValue` | `(axis: 'rows' \| 'columns', spec: NonNullable<Slice['sorting']>['row']): void` | Sort an axis by measure values.   |

#### Filtering

| Method        | Signature                                              | Description                       |
| ------------- | ----------------------------------------------------- | --------------------------------- |
| `setFilter`   | `(uniqueName: string, filter: FieldFilter \| undefined): void` | Set/replace a field's filter. |
| `clearFilter` | `(uniqueName: string): void`                          | Remove a field's filter.          |

#### Expand / collapse

| Method        | Signature                                                  | Description                                  |
| ------------- | --------------------------------------------------------- | -------------------------------------------- |
| `expand`      | `(axis: 'rows' \| 'columns', path: MemberPath): void`     | Expand (drill into) a member path.           |
| `collapse`    | `(axis: 'rows' \| 'columns', path: MemberPath): void`     | Collapse (drill up) a member path.           |
| `expandAll`   | `(): void`                                                | Expand every member on both axes.            |
| `collapseAll` | `(): void`                                                | Collapse every member on both axes.          |

#### Drill-through and output

| Method        | Signature                                                                          | Description                                            |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `getRecords`  | `(rowPath?: MemberPath['tuple'], columnPath?: MemberPath['tuple']): DataRecord[]`  | Underlying records contributing to a cell.            |
| `getGrid`     | `(): PivotGrid`                                                                    | The computed grid (rebuilt lazily when dirty).        |

#### Events

`PivotEngine` emits the events in [`PivotEventMap`](#core-types). Subscribe via
the inherited `on` / `once`, unsubscribe via the returned disposer or `off`.

```ts
const engine = new PivotEngine(config);
const off = engine.on('reportChange', (report) => render(engine.getGrid()));
engine.on('cellDoubleClick', ({ cell, records }) => showDetail(records));
off(); // unsubscribe
```

### `buildGrid`

Pure, stateless builder. Use it directly for one-shot rendering without the
engine's mutation API.

```ts
function buildGrid(dataset: Dataset, config: PivotConfiguration): PivotGrid;
```

```ts
import { Dataset, buildGrid } from '@pvotly/core';

const dataset = new Dataset({ data: records });
const grid = buildGrid(dataset, {
  dataSource: { data: records },
  slice: {
    rows: [{ uniqueName: 'Country' }],
    columns: [{ uniqueName: 'Category' }],
    measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }],
  },
});
```

### `Dataset`

Normalized, queryable view over a data source. Owns type inference, value
normalization, date-part resolution, member enumeration and captions.

```ts
class Dataset {
  readonly records: DataRecord[];
  get fields(): string[];

  constructor(config: DataSourceConfig);

  parseName(uniqueName: string): { field: string; part?: DatePart };
  fieldType(field: string): FieldType;
  resolveValue(record: DataRecord, uniqueName: string): DataValue;
  memberCaption(uniqueName: string, value: DataValue): string;
  fieldCaption(uniqueName: string): string;
  getMembers(uniqueName: string): DataValue[];
  listFields(): FieldInfo[];
}
```

#### `FieldInfo`

```ts
interface FieldInfo {
  uniqueName: string;   // identity used by the slice config: base field, or `field.part`
  field: string;        // underlying source field name
  part?: DatePart;      // date part, when this is a derived date field
  caption: string;
  type: FieldType;
  isMeasure: boolean;   // numeric field usable on the Values axis
  isDimension: boolean; // usable as a row/column/filter dimension
  dateParts?: DatePart[];
  aggregation?: AggregationType;
  format?: string;
}
```

### `EventEmitter`

Minimal, dependency-free typed emitter. `PivotEngine` extends it.

```ts
class EventEmitter {
  on<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): () => void;
  once<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): () => void;
  off<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): void;
  emit<K extends PivotEventName>(event: K, payload: PivotEventMap[K]): void;
  clear(): void;
}
```

### Utility functions

| Export             | Signature                                                              |
| ------------------ | --------------------------------------------------------------------- |
| `compareValues`    | `(a: DataValue, b: DataValue): number` — total ordering, nulls last.  |
| `createAggregator` | `(aggregation: AggregationType): Aggregator`                          |
| `formatValue`      | `(value: number \| DataValue, format?: NumberFormat): string`        |
| `resolveFormat`    | `(format: NumberFormat): NumberFormat` — fill in defaults.            |
| `compileFormula`   | `(formula: string): CompiledFormula` — compile a calculated measure.  |
| `resolveCellStyle` | `(value, measure, conditions?): CellStyle \| undefined`               |
| `parseCsv`         | `(csv: string, options?: CsvParseOptions): DataRecord[]`             |
| `inferFieldType`   | `(records, field): FieldType`                                         |
| `datePartValue` / `datePartCaption` | date-part extraction helpers used to build hierarchies. |

<a id="core-types"></a>

### Types

The engine programs against the type contract in `types.ts`. Key interfaces:

#### Data

```ts
type DataValue = string | number | boolean | Date | null | undefined;
type DataRecord = Record<string, DataValue>;
type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

type DatePart =
  | 'year' | 'quarter' | 'month' | 'monthName' | 'week'
  | 'dayOfMonth' | 'weekday' | 'date' | 'hour' | 'minute' | 'second';

interface DataSourceConfig {
  data?: DataRecord[];        // in-memory array of records
  matrix?: DataValue[][];     // array-of-arrays; first row is the header
  csv?: string;               // raw CSV text to parse
  csvOptions?: CsvParseOptions;
  mapping?: FieldMap;         // field type/caption overrides
}

interface FieldMapping {
  caption?: string;
  type?: FieldType;
  dateParts?: DatePart[];
  visible?: boolean;
  isMeasure?: boolean;
  aggregation?: AggregationType;
  format?: string;
}
type FieldMap = Record<string, FieldMapping>;
```

#### Aggregation

```ts
type AggregationType =
  | 'sum' | 'count' | 'distinctCount' | 'average' | 'median'
  | 'min' | 'max' | 'product' | 'first' | 'last'
  | 'stdev' | 'stdevp' | 'var' | 'varp' | 'none';

type ShowDataAs =
  | 'raw'
  | 'percentOfGrandTotal' | 'percentOfRowTotal' | 'percentOfColumnTotal'
  | 'percentOfParentRowTotal' | 'percentOfParentColumnTotal'
  | 'runningTotalInRow' | 'runningTotalInColumn'
  | 'rankInRow' | 'rankInColumn'
  | 'differenceFromPrevRow' | 'differenceFromPrevColumn';
```

#### Slice (the report definition)

```ts
type SortDirection = 'asc' | 'desc' | 'unsorted';

interface SliceField {
  uniqueName: string;   // source field name, or `field.part` for a date part
  caption?: string;
  sort?: SortDirection;
  filter?: FieldFilter;
}

interface MeasureConfig {
  uniqueName: string;
  caption?: string;
  aggregation?: AggregationType;
  showDataAs?: ShowDataAs;
  format?: string;
  formula?: string;            // calculated-measure formula
  grandTotalCaption?: string;
  active?: boolean;
}

interface Slice {
  rows?: SliceField[];
  columns?: SliceField[];
  measures?: MeasureConfig[];
  reportFilters?: SliceField[];
  expands?: ExpandsConfig;
  drills?: DrillsConfig;
  sorting?: SortingConfig;
  flatSort?: Array<{ uniqueName: string; sort: SortDirection }>;
}

interface MemberPath {
  tuple: Array<{ uniqueName: string; value: DataValue }>;
}
```

#### Filters

```ts
type FieldFilter = MemberFilter | ValueFilter | LabelFilter | QueryFilter;

interface MemberFilter { type: 'members'; include?: DataValue[]; exclude?: DataValue[]; }
interface ValueFilter  { type: 'value'; measure: string; aggregation?: AggregationType; query: ValueQuery; }
interface LabelFilter  { type: 'label'; query: LabelQuery; }
interface QueryFilter  { type: 'query'; query: Record<string, DataValue>; }
```

#### Options

```ts
type GridType = 'compact' | 'classic' | 'flat';

interface GridOptions {
  type?: GridType;
  showGrandTotals?: 'on' | 'off' | 'rows' | 'columns';
  showTotals?: 'on' | 'off' | 'rows' | 'columns';
  showHeaders?: boolean;
  showFilter?: boolean;
  title?: string;
}

interface PivotOptions {
  grid?: GridOptions;
  configuratorActive?: boolean;
  configuratorButton?: boolean;
  showAggregationLabels?: boolean;
  defaultAggregation?: AggregationType;
  virtualization?: boolean;
  drillThrough?: boolean;
  readOnly?: boolean;
  datePattern?: string;
  dateTimePattern?: string;
}
```

#### The report

```ts
interface PivotConfiguration {
  dataSource: DataSourceConfig;
  slice?: Slice;
  options?: PivotOptions;
  formats?: NumberFormat[];
  conditions?: ConditionalFormat[];
  localization?: Localization;
}
```

#### Computed output model

```ts
interface PivotGrid {
  rowTree: HeaderNode[];
  columnTree: HeaderNode[];
  rowLeaves: HeaderNode[];     // flattened, ordered visible row leaves
  columnLeaves: HeaderNode[];  // flattened, ordered visible column leaves
  measures: MeasureConfig[];
  getCell: (rowPath: HeaderNode, colPath: HeaderNode, measure: MeasureConfig) => PivotCell;
  body: PivotCell[][];
  meta: GridMeta;
}

interface HeaderNode {
  uniqueName: string;
  value: DataValue;
  caption: string;
  level: number;
  path: Array<{ uniqueName: string; value: DataValue }>;
  children: HeaderNode[];
  expanded: boolean;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  leafCount: number;
}

interface PivotCell {
  value: number | DataValue;        // raw aggregated value (before "show as")
  displayValue: number | DataValue; // after "show value as"
  formatted: string;
  measure: string;
  rowPath: Array<{ uniqueName: string; value: DataValue }>;
  columnPath: Array<{ uniqueName: string; value: DataValue }>;
  isTotal: boolean;
  isGrandTotal: boolean;
  style?: CellStyle;
}

interface GridMeta {
  type: GridType;
  rowFieldCount: number;
  columnFieldCount: number;
  measureCount: number;
  totalRows: number;
  totalColumns: number;
}
```

#### Events

```ts
type PivotEventMap = {
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

type PivotEventName = keyof PivotEventMap;
```

---

## `@pvotly/web`

The DOM widget built on `@pvotly/core`. Import the stylesheet once.

```ts
import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';
```

### Public exports

| Export                                                                      | Kind     |
| --------------------------------------------------------------------------- | -------- |
| `PivotTable`                                                                | class    |
| `applyTheme`, `setThemeTokens`                                              | function |
| `renderGrid`, `mountFieldList`, `mountToolbar`                              | function |
| `openFilterDialog`, `openFormatDialog`, `openConditionalDialog`             | function |
| `exportToCSV`, `exportToHTML`, `exportToJSON`, `exportToExcel`             | function |
| `serializeExport`, `downloadExport`, `printGrid`, `gridToMatrix`            | function |
| `PivotTableOptions`, `PivotContext`, `ThemeName`, `ExportFormat`, `ExportOptions` | type |
| All of `@pvotly/core`                                                     | re-export |

### `PivotTable`

The all-in-one pivot widget. Owns a `PivotEngine`, builds the layout
(toolbar / field list / grid), and re-renders on every state change.

```ts
interface PivotTableOptions extends PivotConfiguration {
  toolbar?: boolean;            // show the toolbar (default true)
  fieldList?: boolean;          // show the drag-and-drop field-list panel (default true)
  theme?: ThemeName;            // theme name (default 'light')
  height?: string | number;     // CSS height (e.g. 500 or '60vh')
  width?: string | number;      // CSS width
}

class PivotTable {
  readonly engine: PivotEngine;
  get element(): HTMLElement;   // the root element of the widget

  constructor(target: string | HTMLElement, options: PivotTableOptions);
}
```

| Method             | Signature                                                                          | Description                                    |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `refresh`          | `(): void`                                                                        | Force an immediate re-render.                   |
| `getConfiguration` | `(): PivotConfiguration`                                                          | Current report (delegates to the engine).       |
| `setConfiguration` | `(config: PivotConfiguration): void`                                             | Replace the report and re-render.               |
| `on`               | `<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): () => void` | Subscribe to engine events.       |
| `off`              | `<K extends PivotEventName>(event: K, handler: (payload: PivotEventMap[K]) => void): void` | Unsubscribe.                              |
| `setTheme`         | `(theme: ThemeName): void`                                                        | Switch theme.                                   |
| `setThemeTokens`   | `(tokens: Record<string, string>): void`                                          | Override theme CSS tokens at runtime.           |
| `toggleFieldList`  | `(show?: boolean): void`                                                          | Show/hide the field-list panel.                 |
| `toggleFullscreen` | `(): Promise<void>`                                                              | Enter/exit fullscreen.                          |
| `exportTo`         | `(format: ExportFormat, options?: ExportOptions): void`                          | Trigger a browser download.                     |
| `print`            | `(title?: string): void`                                                          | Open the print dialog (for PDF).                |
| `closeDialog`      | `(): void`                                                                        | Close any open dialog.                          |
| `destroy`          | `(): void`                                                                        | Tear down the widget and listeners.             |

```ts
const pivot = new PivotTable('#app', {
  dataSource: { data },
  slice: {
    rows: [{ uniqueName: 'Country' }],
    columns: [{ uniqueName: 'Category' }],
    measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }],
  },
  theme: 'dark',
  height: 600,
});

pivot.on('cellDoubleClick', ({ records }) => console.log(records));
pivot.exportTo('csv', { filename: 'report' });
```

### Theming

```ts
function applyTheme(root: HTMLElement, theme: ThemeName): void;
function setThemeTokens(root: HTMLElement, tokens: Record<string, string>): void;

type ThemeName = 'light' | 'dark' | (string & {});
```

### Export functions

All export functions operate on a [`PivotGrid`](#core-types) (obtained via
`engine.getGrid()`).

```ts
type ExportFormat = 'csv' | 'html' | 'json' | 'excel';

interface ExportOptions {
  filename?: string;
  raw?: boolean; // use raw numeric values instead of formatted strings
}
```

| Function          | Signature                                                                 | Description                                       |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `gridToMatrix`    | `(grid: PivotGrid, raw?: boolean): (string \| number \| null)[][]`        | 2D matrix (header row + body rows) of the grid.   |
| `exportToCSV`     | `(grid: PivotGrid, options?: ExportOptions): string`                      | Serialize to CSV text.                            |
| `exportToHTML`    | `(grid: PivotGrid, options?: ExportOptions): string`                      | Serialize to an HTML `<table>`.                   |
| `exportToJSON`    | `(grid: PivotGrid, options?: ExportOptions): string`                      | Serialize to a JSON array of records.             |
| `exportToExcel`   | `(grid: PivotGrid, options?: ExportOptions): string`                      | Excel-compatible (SpreadsheetML / `.xls`) markup. |
| `serializeExport` | `(grid: PivotGrid, format: ExportFormat, options?: ExportOptions): string` | Serialize to the chosen format.                 |
| `downloadExport`  | `(grid: PivotGrid, format: ExportFormat, options?: ExportOptions): void`  | Trigger a browser download (no-op server-side).   |
| `printGrid`       | `(grid: PivotGrid, title?: string): void`                                 | Open the browser print dialog (for PDF).          |

### Lower-level UI mounters

| Function                | Signature                                                              | Description                              |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `renderGrid`            | `(ctx: PivotContext, host: HTMLElement): void`                        | Render the grid into a host element.     |
| `mountFieldList`        | `(ctx: PivotContext, host: HTMLElement): void`                        | Mount the drag-and-drop field list.      |
| `mountToolbar`          | `(ctx: PivotContext, host: HTMLElement): void`                        | Mount the toolbar.                       |
| `openFilterDialog`      | `(ctx: PivotContext, uniqueName: string): void`                       | Open the member/value/label filter dialog. |
| `openFormatDialog`      | `(ctx: PivotContext, uniqueName: string): void`                       | Open the number-format dialog.           |
| `openConditionalDialog` | `(ctx: PivotContext): void`                                           | Open the conditional-formatting dialog.  |

`PivotContext` is the shared object passed to mounters; it carries the
`engine`, the owning `table`, and `refresh` / `openDialog` / `closeDialog`
helpers.

---

## `@pvotly/react`

Declarative React bindings. Import the `@pvotly/web` stylesheet once in your
app.

```tsx
import { PivotTable, usePivotEngine } from '@pvotly/react';
import '@pvotly/web/styles.css';
```

### Public exports

| Export                              | Kind          |
| ----------------------------------- | ------------- |
| `PivotTable`                        | component     |
| `usePivotEngine`                    | hook          |
| `PivotTableProps`, `PivotTableHandle` | type        |
| All of `@pvotly/core`            | re-export     |

### `<PivotTable />`

A `forwardRef` component wrapping the `@pvotly/web` widget. Props extend
[`PivotTableOptions`](#pvotly-web) plus event handlers and styling.

```ts
interface PivotTableProps extends PivotTableOptions {
  className?: string;
  style?: CSSProperties;

  onReady?: () => void;
  onReportChange?: (config: PivotEventMap['reportChange']) => void;
  onDataChange?: (payload: PivotEventMap['dataChange']) => void;
  onCellClick?: (payload: PivotEventMap['cellClick']) => void;
  onCellDoubleClick?: (payload: PivotEventMap['cellDoubleClick']) => void;
  onFilterChange?: (payload: PivotEventMap['filterChange']) => void;
  onSortChange?: (payload: PivotEventMap['sortChange']) => void;
  onDrillThrough?: (payload: PivotEventMap['drillThrough']) => void;
  onError?: (payload: PivotEventMap['error']) => void;
}
```

The component's `ref` exposes a `PivotTableHandle` for imperative control:

```ts
interface PivotTableHandle {
  readonly engine: PivotEngine;        // underlying engine
  readonly instance: WebPivotTable;    // underlying @pvotly/web widget
  getConfiguration(): PivotConfiguration;
  setConfiguration(config: PivotConfiguration): void;
  exportTo(format: ExportFormat, options?: ExportOptions): void;
  print(title?: string): void;
  refresh(): void;
}
```

```tsx
import { useRef } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import '@pvotly/web/styles.css';

function Report({ data }) {
  const ref = useRef<PivotTableHandle>(null);
  return (
    <>
      <button onClick={() => ref.current?.exportTo('csv')}>Export</button>
      <PivotTable
        ref={ref}
        dataSource={{ data }}
        slice={{
          rows: [{ uniqueName: 'Country' }],
          measures: [{ uniqueName: 'Sales' }],
        }}
        onCellClick={({ cell }) => console.log(cell)}
        style={{ height: 600 }}
      />
    </>
  );
}
```

### `usePivotEngine`

Headless hook: owns a `PivotEngine` and returns the live computed grid,
re-rendering whenever the report changes. Use it to build a fully custom
renderer without the bundled DOM UI.

```ts
function usePivotEngine(config: PivotConfiguration): {
  engine: PivotEngine;
  grid: PivotGrid;
};
```

```tsx
function CustomGrid({ data }) {
  const { engine, grid } = usePivotEngine({
    dataSource: { data },
    slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
  });

  return (
    <table>
      <tbody>
        {grid.rowLeaves.map((row) => (
          <tr key={row.caption}>
            <th>{row.caption}</th>
            {grid.columnLeaves.map((col) =>
              grid.measures.map((m) => (
                <td key={`${col.caption}-${m.uniqueName}`}>
                  {grid.getCell(row, col, m).formatted}
                </td>
              )),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```
