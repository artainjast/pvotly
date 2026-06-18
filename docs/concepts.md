# pvotly Concepts

A conceptual guide to the pvotly report model and the engine that turns it
into a grid. Everything here maps directly to the public type contract in
`@pvotly/core` (`packages/core/src/types.ts`), version `0.1.0`, MIT licensed.

pvotly is framework agnostic: `@pvotly/core` holds the data model and
engine, `@pvotly/web` renders it, and `@pvotly/react` wraps it as a
component. This document covers the core model only.

## The report

A complete, serializable pivot configuration is a `PivotConfiguration` (also
called the "report"):

```ts
import type { PivotConfiguration } from '@pvotly/core';

const report: PivotConfiguration = {
  dataSource: { data: records },
  slice: {
    /* what to show */
  },
  options: {
    /* how to render */
  },
  formats: [
    /* named number formats */
  ],
  conditions: [
    /* conditional formatting rules */
  ],
  localization: {
    /* captions */
  },
};
```

The report is consumed either by the stateful `PivotEngine` or by the one-shot
pure `buildGrid` function:

```ts
import { PivotEngine, buildGrid } from '@pvotly/core';

// Stateful: owns the report, applies mutations, emits events, caches the grid.
const engine = new PivotEngine(report);
const grid = engine.getGrid();

// Stateless: build a grid in one call from a Dataset + report.
import { Dataset } from '@pvotly/core';
const dataset = new Dataset(report.dataSource);
const grid2 = buildGrid(dataset, report);
```

## The slice model

The `Slice` is the report definition: it says which fields go on which axis,
which measures to compute, and how to filter, sort, expand and collapse them.

```ts
import type { Slice } from '@pvotly/core';

const slice: Slice = {
  rows: [{ uniqueName: 'Country' }, { uniqueName: 'City' }],
  columns: [{ uniqueName: 'Category' }],
  measures: [
    { uniqueName: 'Revenue', aggregation: 'sum' },
    { uniqueName: 'Orders', aggregation: 'count' },
  ],
  reportFilters: [{ uniqueName: 'Year' }],
  expands: { expandAll: false },
  drills: {},
  sorting: {},
  flatSort: [],
};
```

### Rows and columns

`rows` and `columns` are arrays of `SliceField`. The order of fields defines the
header hierarchy (the first field is the top level). A `SliceField` carries a
source field name, an optional caption, a member-level sort, and a member filter:

```ts
interface SliceField {
  /** Source field name. For a date part, use `field.part` (e.g. `Date.month`). */
  uniqueName: string;
  caption?: string;
  sort?: SortDirection; // 'asc' | 'desc' | 'unsorted'
  filter?: FieldFilter;
}
```

### Measures (values)

`measures` are `MeasureConfig` entries placed on the Values axis. Each is either
a plain aggregated field or a calculated measure (see below):

```ts
interface MeasureConfig {
  uniqueName: string;
  caption?: string;
  aggregation?: AggregationType; // base reducer; ignored when `formula` is set
  showDataAs?: ShowDataAs; // "show value as"; defaults to 'raw'
  format?: string; // named NumberFormat
  formula?: string; // calculated-measure expression
  grandTotalCaption?: string;
  active?: boolean;
}
```

### Report filters

`reportFilters` are `SliceField` entries that filter the whole report without
appearing as rows or columns. They behave exactly like row/column field filters
but apply globally to the dataset before the grid is built.

## Aggregations

Each measure reduces the records that fall into a cell to a single value using an
`AggregationType`:

```ts
type AggregationType =
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
  | 'stdev' // sample standard deviation
  | 'stdevp' // population standard deviation
  | 'var' // sample variance
  | 'varp' // population variance
  | 'none'; // raw value (flat view / single record)
```

Notes on behavior:

- `sum`, `average`, `min`, `max`, `product`, `median`, and the variance/stdev
  reducers ignore non-numeric and empty values; booleans coerce to `1`/`0`.
- `count` tallies all records in the cell; `distinctCount` counts distinct
  non-empty values.
- Sample variance/stdev (`var`, `stdev`) return `0` when fewer than two values
  are present; population variants (`varp`, `stdevp`) divide by `n`.
- `none` and `last` return the last raw value; `first` returns the first.

The default aggregation when a field is dropped onto Values without one is
governed by `PivotOptions.defaultAggregation` (numeric measure fields default to
`sum`, others to `count`). You can resolve a reducer directly:

```ts
import { createAggregator, AGGREGATION_LABELS } from '@pvotly/core';

const agg = createAggregator('average');
agg.push(10, record);
agg.push(20, record);
agg.value(); // 15

AGGREGATION_LABELS.distinctCount; // 'Distinct Count'
```

## Calculated measures

A calculated measure has a `formula` instead of (or overriding) an
`aggregation`. The formula is compiled by `compileFormula` and evaluated per
cell. Reference aggregations as function calls over source fields:

```ts
const measures: MeasureConfig[] = [
  {
    uniqueName: 'avgPrice',
    caption: 'Average Price',
    formula: "sum('revenue') / sum('units')",
  },
];
```

### Formula grammar

The grammar is whitespace-insensitive:

```
expr    := term (('+' | '-') term)*
term    := factor (('*' | '/') factor)*
factor  := number | '(' expr ')' | '-' factor | call
call    := ident '(' [ string ] ')'
```

- `ident` is an aggregation function name. The string argument (single or double
  quoted) is the source field; `count()` may omit the argument.
- Supported function names (case-insensitive), with aliases: `sum`, `count`,
  `distinctCount`, `average` (`avg`, `mean`), `median`, `min`, `max`, `product`,
  `first`, `last`, `stdev`, `stdevp`, `var`, `varp`.
- Operators `+ - * /`, unary minus, and parentheses are supported with standard
  precedence.
- Division by zero yields `null` (a blank/error cell); any `null` operand
  propagates as `null`.

```ts
import { compileFormula } from '@pvotly/core';

const compiled = compileFormula("sum('revenue') * 1.2 - sum('cost')");
compiled.references; // [{ aggregation: 'sum', field: 'revenue' }, { aggregation: 'sum', field: 'cost' }]
compiled.evaluate((agg, field) => /* look up the aggregate */ 0);
```

Invalid syntax throws a `SyntaxError` at compile time.

## Show value as

On top of the base aggregation, a measure can post-process its values once the
full grid exists (these transforms need totals and sibling cells):

```ts
type ShowDataAs =
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
```

```ts
const measure: MeasureConfig = {
  uniqueName: 'Revenue',
  aggregation: 'sum',
  showDataAs: 'percentOfColumnTotal',
};
```

Each `PivotCell` exposes both the pre-transform `value` and the post-transform
`displayValue`, plus the `formatted` string. `percentOf*` transforms render as
percentages automatically.

## Filters

A field can carry one `FieldFilter`, a union of four kinds:

```ts
type FieldFilter = MemberFilter | ValueFilter | LabelFilter | QueryFilter;
```

### Member filter

Include or exclude an explicit set of member values. If `include` is present,
`exclude` is ignored:

```ts
const filter: MemberFilter = {
  type: 'members',
  include: ['USA', 'Canada'],
};
```

### Value filter

Keep top/bottom N members ranked by a measure, or apply a numeric threshold.
Value filters are applied to the axis after aggregation (not at the record
level):

```ts
const filter: ValueFilter = {
  type: 'value',
  measure: 'Revenue',
  aggregation: 'sum',
  query: { op: 'top', count: 5 },
};
```

`ValueQuery` operators: `top`, `bottom` (with `count`); `equal`, `notEqual`,
`greater`, `greaterEqual`, `less`, `lessEqual` (with `value`); `between`,
`notBetween` (with `from`/`to`).

### Label filter

A string predicate over member captions (case-insensitive, except `regex`):

```ts
const filter: LabelFilter = {
  type: 'label',
  query: { op: 'beginsWith', value: 'A' },
};
```

`LabelQuery` operators: `contains`, `notContains`, `beginsWith`, `endsWith`,
`equal`, `notEqual`, `regex`.

### Query filter

An arbitrary predicate map, used for numeric and date ranges on members:

```ts
const filter: QueryFilter = {
  type: 'query',
  query: { greaterEqual: 100, lessEqual: 1000 },
};
```

Recognized keys include `min`/`greaterEqual`, `max`/`lessEqual`, `greater`,
`less`, `equal`, and the date comparators `after` / `before`.

Member, label and query filters are record-level (combined with AND) and run
before aggregation; value filters run on the axis afterward.

## Sorting

Two independent sorting mechanisms exist.

### Member sort

Each row/column `SliceField` sorts its own members alphabetically/numerically via
`sort: 'asc' | 'desc' | 'unsorted'`:

```ts
const rows: SliceField[] = [{ uniqueName: 'Country', sort: 'asc' }];
```

### Sort by value

An entire axis can be ordered by the values in a particular opposite-axis tuple
(or the grand total when `tuple` is omitted) via `Slice.sorting`:

```ts
const sorting: SortingConfig = {
  // Order the rows axis by a column's values.
  row: {
    direction: 'desc',
    measure: 'Revenue',
    tuple: [{ uniqueName: 'Category', value: 'Bikes' }],
  },
  // Order the columns axis by a row's values.
  column: { direction: 'asc', measure: 'Orders' },
};
```

For the flat grid layout, column order is controlled by `Slice.flatSort`.

## Expand / collapse (expands & drills)

Header nodes can be drilled into (expanded) or drilled up (collapsed) per axis.
Two parallel configs track this:

```ts
interface ExpandsConfig {
  expandAll?: boolean;
  rows?: MemberPath[];
  columns?: MemberPath[];
}

interface DrillsConfig {
  drillAll?: boolean;
  rows?: MemberPath[];
  columns?: MemberPath[];
}
```

A `MemberPath` identifies a node by its tuple of member values from the root:

```ts
const path: MemberPath = {
  tuple: [
    { uniqueName: 'Country', value: 'USA' },
    { uniqueName: 'City', value: 'Austin' },
  ],
};
```

`expandAll` / `drillAll` set the default for every node; the per-axis path lists
are the explicit exceptions. The `PivotEngine` exposes imperative helpers that
keep `expands` and `drills` consistent:

```ts
engine.expand('rows', path); // remove from drills, add to expands
engine.collapse('rows', path); // remove from expands, add to drills
engine.expandAll();
engine.collapseAll();
```

## Totals and subtotals

Grand totals and subtotals are controlled in `GridOptions`:

```ts
interface GridOptions {
  type?: GridType; // 'compact' | 'classic' | 'flat'
  showGrandTotals?: 'on' | 'off' | 'rows' | 'columns';
  showTotals?: 'on' | 'off' | 'rows' | 'columns'; // subtotals
  showHeaders?: boolean;
  showFilter?: boolean;
  title?: string; // empty top-left corner caption
}
```

- `showGrandTotals` adds a grand-total node to the row and/or column axis. Its
  caption comes from `Localization.grandTotal` (default `"Grand Total"`).
- `showTotals` controls subtotals for nested (expanded) groups. The behavior
  differs by layout (see below).

Computed header nodes expose `isTotal` and `isGrandTotal`, and each `PivotCell`
carries the same flags so renderers can style total rows/columns.

## Grid layouts

`GridType` selects how the header tree is flattened into visible lines:

```ts
type GridType = 'compact' | 'classic' | 'flat';
```

- **compact** (default): pre-order walk. Every node emits one line; an expanded
  parent emits its own subtotal line plus its descendants. A collapsed or leaf
  node shows the aggregate over all its descendants.
- **classic**: leaves are emitted at full depth; each expanded group appends a
  trailing subtotal line when `showTotals` is enabled.
- **flat**: only the deepest leaves are emitted, with no subtotals.

The flattening helpers are exported for custom renderers:

```ts
import { flatten, flattenCompact, flattenClassic, flattenFlat } from '@pvotly/core';
```

## Number formats

Named formats live in `PivotConfiguration.formats` and are referenced by a
measure's `format` field (matching on `NumberFormat.name`; `''` is the default):

```ts
const formats: NumberFormat[] = [
  {
    name: 'currency',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    currencySymbol: '$',
    currencySymbolAlign: 'left',
    negativeFormat: 'parentheses', // (1,234.00)
    nullValue: '—',
  },
];

const measure: MeasureConfig = { uniqueName: 'Revenue', aggregation: 'sum', format: 'currency' };
```

Key fields: `decimalPlaces` / `maxDecimalPlaces`, `decimalSeparator`,
`thousandsSeparator` (set `''` to disable grouping), `currencySymbol` /
`currencySymbolAlign`, `isPercent` (multiplies by 100 and appends `%`),
`negativeFormat` (`'minus'` | `'parentheses'` | `'redMinus'`), `nullValue`,
`infinityValue`, `dateTimePattern` (for date measures), and `textAlign`.

```ts
import { formatValue, resolveFormat, formatDate, DEFAULT_FORMAT } from '@pvotly/core';

formatValue(-1234.5, formats[0]); // "($1,234.50)"
formatDate(new Date(2024, 0, 5), 'yyyy-MM-dd'); // "2024-01-05"
```

The date pattern tokens are `yyyy`, `yy`, `MM`, `dd`, `HH`, `mm`, `ss`.

## Conditional formatting

`PivotConfiguration.conditions` is an ordered list of `ConditionalFormat` rules.
Each rule optionally targets a measure, tests every matching cell, and merges an
inline `CellStyle` when it matches. Later matching rules win (last-wins, like a
spreadsheet):

```ts
const conditions: ConditionalFormat[] = [
  {
    measure: 'Revenue',
    condition: { op: '>', value: 10000 },
    format: { backgroundColor: '#e6ffed', color: '#036400', fontWeight: 'bold' },
  },
  {
    measure: 'Revenue',
    condition: { op: '<', value: 0 },
    format: { color: 'red' },
  },
];
```

`ConditionExpr` operators: `=`, `!=` (number or string), `>`, `>=`, `<`, `<=`
(numeric), `between` (`from`/`to`), `contains` (substring, case-insensitive),
`isTrue`, `isFalse`. The resolved style appears on `PivotCell.style`; you can
also compute it directly:

```ts
import { resolveCellStyle } from '@pvotly/core';

resolveCellStyle(12000, 'Revenue', conditions); // { backgroundColor: '#e6ffed', ... }
```

`CellStyle` fields: `backgroundColor`, `color`, `fontFamily`, `fontSize`,
`fontWeight`, `fontStyle`, `textAlign`.

## Date parts

A date or datetime field can be expanded into hierarchical parts, turning a
single field into multiple drillable levels (e.g. Year > Quarter > Month). Parts
are declared in the field mapping:

```ts
const report: PivotConfiguration = {
  dataSource: {
    data: records,
    mapping: {
      OrderDate: { type: 'date', dateParts: ['year', 'quarter', 'month'] },
    },
  },
  slice: {
    rows: [
      { uniqueName: 'OrderDate.year' },
      { uniqueName: 'OrderDate.quarter' },
      { uniqueName: 'OrderDate.month' },
    ],
  },
};
```

Each part is addressed on an axis with the `field.part` form in `uniqueName`.
Available `DatePart` values:

```ts
type DatePart =
  | 'year'
  | 'quarter' // 1-4, captioned "Q1".."Q4"
  | 'month' // 1-12, captioned by month name
  | 'monthName' // "January".."December"
  | 'week' // ISO week 1-53
  | 'dayOfMonth'
  | 'weekday' // 0-6, captioned "Sunday".."Saturday"
  | 'date' // "YYYY-MM-DD"
  | 'hour'
  | 'minute'
  | 'second';
```

Numeric parts (year, month number, week, etc.) sort naturally; named parts
(`monthName`, captions for `month`/`quarter`/`weekday`) are produced by the
caption resolver. Helpers are exported for custom logic:

```ts
import { datePartValue, datePartCaption, toDate } from '@pvotly/core';

const d = toDate('2024-03-15');
datePartValue(d!, 'quarter'); // 1
datePartCaption(1, 'quarter'); // "Q1"
```

## The computed grid

Building a report produces a `PivotGrid` for renderers to consume. It exposes the
`rowTree` / `columnTree` header hierarchies, the flattened visible `rowLeaves` /
`columnLeaves`, the resolved `measures`, a `body` matrix of `PivotCell`s in
visual order, a `getCell(rowNode, colNode, measure)` lookup, and `meta`
describing dimensions. Each `PivotCell` carries the raw `value`, the
post-transform `displayValue`, the `formatted` string, its `rowPath` /
`columnPath`, the `isTotal` / `isGrandTotal` flags, and any resolved `style`.
