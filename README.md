# pvotly

**A fully customizable, framework-agnostic pivot table engine and UI.**

pvotly turns flat records into interactive cross-tabs: drag fields onto Rows,
Columns and Values, aggregate, filter, sort, format and export — in plain
JavaScript, in React, or fully headless with no UI at all.

## Features

- **Framework-agnostic engine** — a pure data model in `@pvotly/core` you can drive from anything.
- **Drag-and-drop field list** — arrange Rows, Columns, Values and Filters interactively.
- **Aggregations** — `sum`, `count`, `distinctCount`, `average`, `median`, `min`, `max`, `product`, `first`, `last`, `stdev`, `stdevp`, `var`, `varp`, plus **calculated measures** via formulas.
- **Show value as** — `% of grand/row/column/parent total`, running totals, rank, and difference from previous.
- **Filters & sorting** — member, value (top/bottom N, thresholds), and label filters; member sort and sort-by-value on either axis.
- **Totals & subtotals** — grand totals and subtotals, toggleable per axis.
- **Conditional formatting** — style cells by comparison rules, scoped per measure.
- **Multiple grid layouts** — `compact`, `classic`, and `flat`.
- **Date grouping** — expand a date field into Year › Quarter › Month › … hierarchies.
- **Multiple data sources** — in-memory objects, array-of-arrays matrices, or raw CSV text.
- **Export** — CSV, Excel, HTML, JSON, and print.
- **Theming** — built-in light/dark themes plus customizable design tokens.
- **React wrapper** — a declarative `<PivotTable />` with hooks and an imperative ref.
- **Headless usage** — compute a grid with the engine and render it however you like.
- **Fully typed** — first-class TypeScript types for the entire configuration and output model.
- **Zero dependencies** in the core engine.

## Packages

| Package | Description |
| --- | --- |
| [`@pvotly/core`](packages/core) | Framework-agnostic pivot engine: data model, aggregation, filtering, sorting, formatting, calculated measures. Zero dependencies. |
| [`@pvotly/web`](packages/web) | Framework-agnostic pivot UI: drag-and-drop field list, grid renderer, filters, conditional formatting, export, themes. |
| [`@pvotly/react`](packages/react) | React wrapper — a declarative `<PivotTable />` component with hooks and refs. |

All packages are published at version `0.1.0`.

## Install

**React:**

```bash
pnpm add @pvotly/react @pvotly/web
# or
npm install @pvotly/react @pvotly/web
```

**Vanilla / framework-agnostic:**

```bash
pnpm add @pvotly/web
# or
npm install @pvotly/web
```

> `@pvotly/web` (and `@pvotly/react`, which depends on it) re-exports
> everything from `@pvotly/core`, so you usually only need one import.
> Install `@pvotly/core` on its own for purely headless usage.

## Quick start

### React

```tsx
import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

const SALES = [
  { country: 'USA', category: 'Phones', revenue: 1200 },
  { country: 'USA', category: 'Tablets', revenue: 800 },
  { country: 'Germany', category: 'Phones', revenue: 950 },
];

export default function App() {
  return (
    <PivotTable
      dataSource={{ data: SALES }}
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

### Vanilla JavaScript

```ts
import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';

const pivot = new PivotTable('#app', {
  dataSource: { data: SALES },
  slice: {
    rows: [{ uniqueName: 'country' }, { uniqueName: 'channel' }],
    columns: [{ uniqueName: 'category' }],
    measures: [
      { uniqueName: 'revenue', aggregation: 'sum' },
      { uniqueName: 'units', aggregation: 'sum' },
    ],
  },
  options: { grid: { type: 'compact' } },
});

pivot.on('cellClick', ({ cell }) => console.log(cell));
```

### Headless (engine only)

```ts
import { PivotEngine } from '@pvotly/core';

const engine = new PivotEngine({
  dataSource: { data: SALES },
  slice: {
    rows: [{ uniqueName: 'country' }],
    columns: [{ uniqueName: 'category' }],
    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
  },
});

const grid = engine.getGrid(); // render however you like
```

## Configuration (report) shape

Everything is described by a single, serializable `PivotConfiguration` object —
the same shape the engine, the web widget, and the React component all accept:

```ts
interface PivotConfiguration {
  dataSource: DataSourceConfig;   // data | matrix | csv (+ field mapping)
  slice?: Slice;                  // rows, columns, measures, reportFilters, sorting, expands/drills
  options?: PivotOptions;         // grid layout, totals, virtualization, drill-through, ...
  formats?: NumberFormat[];       // named number/date formats
  conditions?: ConditionalFormat[]; // conditional cell styling
  localization?: Localization;    // captions & labels
}
```

- **`dataSource`** — provide exactly one of `data` (array of records), `matrix`
  (array-of-arrays with a header row), or `csv` (raw text, with `csvOptions`).
  Use `mapping` to override field captions, types, and date parts.
- **`slice`** — the report definition: `rows`, `columns`, `measures` (including
  calculated ones via `formula`), `reportFilters`, `sorting`, and `expands` / `drills`.
- **`options`** — `grid.type` (`compact` / `classic` / `flat`), `showGrandTotals`,
  `showTotals`, `virtualization`, `drillThrough`, `readOnly`, and more.
- **`formats`** — named `NumberFormat` entries referenced by `measure.format`.
- **`conditions`** — `ConditionalFormat` rules that style cells by comparison.

The full, documented type contract lives in
[`packages/core/src/types.ts`](packages/core/src/types.ts).

## Documentation & demo

- Docs: see the [`docs/`](docs) directory and the typed source in
  [`packages/core/src/types.ts`](packages/core/src/types.ts).
- Live demo: run `pnpm dev` to start the demo app (under [`apps/demo`](apps/demo)),
  which showcases every feature — basic pivots, calculated measures, show-value-as,
  conditional formatting, filtering, sorting, dates, CSV/matrix sources, theming,
  drill-through, headless and vanilla usage.

## Development

This is a [pnpm](https://pnpm.io) workspace monorepo.

```bash
pnpm install     # install dependencies
pnpm build       # build all packages
pnpm dev         # run the demo app
pnpm test        # run unit tests (Vitest)
pnpm test:e2e    # run end-to-end tests (Playwright)
```

Other useful scripts: `pnpm typecheck`, `pnpm lint`, and `pnpm format`.

## License

[MIT](LICENSE) © pvotly contributors
