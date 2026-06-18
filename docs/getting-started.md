# Getting Started with pvotly

pvotly is a fully customizable, framework-agnostic pivot table engine and UI.
It computes crosstab reports (rows × columns × measures) from your data and
renders them with an interactive grid, a drag-and-drop field list, filtering,
conditional formatting and export.

This guide walks you through installation, the three packages, your first React
and vanilla pivot, where data comes from, and a tour of the UI.

- Version: `0.1.0`
- License: MIT

## Installation

Install the package(s) you need with your package manager of choice.

```bash
# Vanilla / framework-agnostic
npm install @pvotly/web

# React
npm install @pvotly/react

# Engine only (headless, no UI)
npm install @pvotly/core
```

```bash
# pnpm
pnpm add @pvotly/web
# yarn
yarn add @pvotly/web
```

`@pvotly/react` declares `react` and `react-dom` (`>=17`) as peer
dependencies, so make sure those are installed in your app.

## The three packages

pvotly ships as a small monorepo of layered packages. Each builds on the one
below it, and every package re-exports the one(s) it depends on, so a single
import statement is usually enough.

| Package | What it is | When to use it |
| --- | --- | --- |
| `@pvotly/core` | The framework-agnostic engine: data model, type inference, aggregation, filtering, sorting, formatting and calculated measures. Zero dependencies, no DOM. | You want a headless engine and will render the grid yourself, or you need the computation in a non-browser environment (Node, a worker, tests). |
| `@pvotly/web` | A framework-agnostic UI built on `@pvotly/core`: toolbar, drag-and-drop field list, grid renderer, dialogs, themes and export. Mounts to any DOM node. | You are using plain JavaScript/TypeScript, or any framework other than React, and want the full out-of-the-box widget. |
| `@pvotly/react` | A declarative `<PivotTable />` component plus a `usePivotEngine` hook, wrapping `@pvotly/web`. | You are building a React app. |

Because of the re-exports:

- `@pvotly/web` re-exports everything from `@pvotly/core`.
- `@pvotly/react` re-exports everything from `@pvotly/core`.

So you can import the `PivotConfiguration` type, the `PivotEngine` class, helpers
like `parseCsv`, etc. directly from the top-level package you already depend on.

## Importing styles

The UI ships its CSS as a separate, side-effect-free stylesheet. Import it
**once** in your application entry point (it is the same file regardless of
whether you use the React or vanilla package):

```ts
import '@pvotly/web/styles.css';
```

The stylesheet includes the base widget styles and the built-in `light` and
`dark` themes. If you forget this import the widget will render unstyled.

## Your first React pivot

```tsx
import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

const data = [
  { country: 'USA', category: 'Cars', revenue: 100, units: 2 },
  { country: 'USA', category: 'Bikes', revenue: 50, units: 5 },
  { country: 'Canada', category: 'Cars', revenue: 300, units: 4 },
  { country: 'Canada', category: 'Bikes', revenue: 80, units: 8 },
];

export default function App() {
  return (
    <PivotTable
      height={460}
      dataSource={{ data }}
      slice={{
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      }}
      onCellClick={({ cell }) => console.log(cell)}
    />
  );
}
```

The `<PivotTable />` props are the full `PivotConfiguration`
(`dataSource`, `slice`, `options`, `formats`, `conditions`, `localization`) plus
UI options (`toolbar`, `fieldList`, `theme`, `height`, `width`), a `className`
and `style`, and event handlers (`onReady`, `onReportChange`, `onCellClick`,
`onCellDoubleClick`, `onFilterChange`, `onSortChange`, `onDrillThrough`,
`onError`).

The component is declarative: when you change props (e.g. swap the `slice`), the
underlying widget reconfigures automatically.

### Imperative access via a ref

For imperative control (export, print, reading the live configuration), attach a
ref. The handle exposes the underlying `engine` and `instance`, plus
`getConfiguration`, `setConfiguration`, `exportTo`, `print` and `refresh`:

```tsx
import { useRef } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';

function Report() {
  const ref = useRef<PivotTableHandle>(null);
  return (
    <>
      <button onClick={() => ref.current?.exportTo('csv')}>Export CSV</button>
      <PivotTable
        ref={ref}
        dataSource={{ data }}
        slice={{ rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] }}
      />
    </>
  );
}
```

### Headless: bring your own renderer

If you want the engine but not the bundled UI, use the `usePivotEngine` hook. It
owns a `PivotEngine`, recomputes on every report change, and hands you the
computed `grid`:

```tsx
import { usePivotEngine } from '@pvotly/react';

function CustomTable() {
  const { grid } = usePivotEngine({
    dataSource: { data },
    slice: {
      rows: [{ uniqueName: 'country' }],
      measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
    },
  });

  return (
    <table>
      <thead>
        <tr>
          <th />
          {grid.columnLeaves.flatMap((col, c) =>
            grid.measures.map((m) => (
              <th key={`${c}-${m.uniqueName}`}>{m.caption ?? m.uniqueName}</th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {grid.rowLeaves.map((row, r) => (
          <tr key={r}>
            <th>{row.caption}</th>
            {grid.columnLeaves.flatMap((col, c) =>
              grid.measures.map((m) => (
                <td key={`${c}-${m.uniqueName}`}>{grid.getCell(row, col, m).formatted}</td>
              )),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Your first vanilla pivot

`@pvotly/web` exports a `PivotTable` class you instantiate against a DOM node
(a CSS selector or an `HTMLElement`):

```ts
import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';

const data = [
  { country: 'USA', category: 'Cars', revenue: 100, units: 2 },
  { country: 'Canada', category: 'Bikes', revenue: 80, units: 8 },
];

const pivot = new PivotTable('#app', {
  height: 460,
  dataSource: { data },
  slice: {
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  },
  options: { grid: { type: 'compact' } },
});

// Subscribe to events; `on` returns an unsubscribe function.
const off = pivot.on('cellClick', ({ cell }) => console.log(cell));

// Imperative API
pivot.exportTo('csv');
pivot.print('Sales report');
pivot.setTheme('dark');

// Clean up when you're done.
off();
pivot.destroy();
```

The constructor accepts the full `PivotConfiguration` plus the UI-only options
`toolbar` (default `true`), `fieldList` (default `true`), `theme` (default
`'light'`), `height` and `width`. Methods include `on` / `off`,
`getConfiguration` / `setConfiguration`, `setTheme`, `setThemeTokens`,
`toggleFieldList`, `toggleFullscreen`, `exportTo`, `print`, `refresh` and
`destroy`. The live `engine` is available as `pivot.engine`.

### Headless engine (no UI at all)

When you need only the computation, use the `PivotEngine` from
`@pvotly/core`:

```ts
import { PivotEngine } from '@pvotly/core';

const engine = new PivotEngine({
  dataSource: { data },
  slice: {
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  },
});

const grid = engine.getGrid();
// grid.rowLeaves, grid.columnLeaves, grid.getCell(row, col, measure), grid.body
```

The engine is stateful: methods such as `addToRows`, `addToColumns`,
`addToValues`, `setFilter`, `sortField`, `expand` and `collapse` mutate the
report and emit a `reportChange` event; call `getGrid()` again to read the
recomputed result. For a one-shot, stateless build use the pure `buildGrid`
function instead.

## Where data comes from

Every configuration has a `dataSource`. Provide exactly one of three forms.

### 1. `data` — array of record objects

The most common form: a flat array of objects keyed by field name.

```ts
dataSource: {
  data: [
    { country: 'USA', category: 'Cars', revenue: 100, units: 2 },
    { country: 'Canada', category: 'Bikes', revenue: 80, units: 8 },
  ],
}
```

### 2. `matrix` — array of arrays

The **first row is the header**: its cells become the field names that `slice`
references. Every following row is one positionally-aligned record.

```ts
dataSource: {
  matrix: [
    ['Region', 'Product', 'Sales', 'Qty'], // header defines field names
    ['North', 'Widget', 1200, 30],
    ['South', 'Gadget', 1500, 25],
  ],
}
```

### 3. `csv` — raw CSV text

Pass a CSV string and pvotly parses it (handling quoted fields, escaped
quotes and embedded newlines). Tune parsing with `csvOptions`:

```ts
dataSource: {
  csv: `country,category,units,revenue
USA,Cars,4,12000
Canada,Cars,3,9000`,
  // Optional — these are the defaults:
  csvOptions: { delimiter: ',', header: true, dynamicTyping: true },
}
```

With `dynamicTyping` on (the default), numeric, boolean and `null` strings are
coerced to real values so measures can aggregate them. Other `csvOptions` are
`quote` (default `"`) and `trim` (default `true`). When `header` is `false`,
columns are named `column1`, `column2`, ….

### Field types and overrides

Whatever the source, pvotly infers each field's logical type (`string`,
`number`, `boolean`, `date`, `datetime`). Numeric fields are usable as measures;
all fields can be dimensions. You can override types, captions, default
aggregation/format, visibility, or expand a date field into hierarchical parts
via `dataSource.mapping`:

```ts
dataSource: {
  data,
  mapping: {
    revenue: { caption: 'Revenue', aggregation: 'sum' },
    date: { type: 'date', dateParts: ['year', 'quarter', 'month'] },
  },
}
```

Date parts are referenced in the slice as `field.part`, e.g.
`{ uniqueName: 'date.year' }`.

## A tour of the UI

The `@pvotly/web` widget (and therefore the React `<PivotTable />`) is laid
out as a toolbar on top, with the grid and the field list side by side below.

### Toolbar

The toolbar (shown unless `toolbar: false`) provides:

- **Fields** — toggle the drag-and-drop field-list panel.
- **Format** — open the number-format dialog for measures.
- **Conditional** — open the conditional-formatting dialog (style cells by value).
- **Layout** — a select to switch the grid `type` between `Compact`, `Classic`
  and `Flat`.
- **Export** — a menu with To CSV, To Excel, To HTML, To JSON and Print / PDF.
- **Fullscreen** — expand the widget to fill the screen.

### Field list (drag and drop)

The field-list panel (shown unless `fieldList: false`) lists all available
fields at the top and four drop areas below: **Report Filters**, **Columns**,
**Rows** and **Values**.

- **Drag** a field chip into any area to place it; drop position determines the
  order. Dropping back onto the available list removes it from the report.
- **Double-click** an available field to add it quickly (measures go to Values,
  everything else to Rows).
- On a **Rows/Columns** chip, the sort button cycles ascending → descending →
  unsorted; the filter button opens the filter dialog.
- On a **Values** chip, a dropdown picks the aggregation (`sum`, `count`,
  `average`, `min`, `max`, `distinctCount`, `median`, and more). Calculated
  measures show an `ƒx` marker instead.
- The remove button on any chip takes the field off its axis.

### Expand / collapse

When you nest multiple fields on an axis, each header group gets a toggle
control. Clicking it drills the member down (expand) or up (collapse). This maps
to the engine's `expand` / `collapse` methods and is reflected in the
configuration's `slice.expands` / `slice.drills`. The engine also offers
`expandAll()` and `collapseAll()`.

### Filters

Open a field's filter dialog from its chip's filter button. pvotly supports
several filter kinds on the `slice` field's `filter`:

- **Member** filters — include or exclude specific member values.
- **Value** filters — keep top/bottom N members by a measure, or threshold
  comparisons (greater, less, between, …).
- **Label** filters — match member captions (contains, beginsWith, regex, …).

Fields placed in **Report Filters** filter the whole report without appearing on
the grid axes. A chip with an active filter is highlighted.

### Cell interaction and export

- **Click** a body cell to fire a `cellClick` event.
- **Double-click** a body cell to drill through: it emits `cellDoubleClick` and
  `drillThrough` with the underlying source records that contributed to the cell.
- **Export** the visible grid from the toolbar menu, or imperatively via
  `exportTo(format, options)` where `format` is `'csv' | 'html' | 'json' |
  'excel'`. Options are `filename` (default `pivot`) and `raw` (export raw
  numeric values instead of formatted strings). `print(title?)` opens a
  print-friendly window suitable for PDF.

## Theming

Switch between the built-in `light` and `dark` themes with the `theme` option
(or `setTheme` at runtime). Override individual design tokens with CSS custom
properties via `setThemeTokens`:

```ts
pivot.setTheme('dark');
pivot.setThemeTokens({ accent: '#7c3aed' }); // sets --ph-accent
```

## Next steps

- Add **calculated measures** with a `formula` on a `MeasureConfig`.
- Apply **conditional formatting** through the `conditions` array.
- Use **"show value as"** transforms (`percentOfGrandTotal`, `runningTotalInRow`,
  `rankInColumn`, …) via a measure's `showDataAs`.
- Configure **totals** and **subtotals** through `options.grid.showGrandTotals`
  and `options.grid.showTotals`.

All of these are typed on the `PivotConfiguration` exported from
`@pvotly/core` (and re-exported from `@pvotly/web` and `@pvotly/react`).
