# @pvotly/react

Declarative React bindings for [pvotly](https://github.com/artainjast/pivot-table) — a `<PivotTable />` component that wraps the `@pvotly/web` widget, plus a headless `usePivotEngine` hook for building your own renderer.

- **Version:** 0.1.0
- **License:** MIT

## Installation

```bash
npm install @pvotly/react @pvotly/web @pvotly/core
```

`react` and `react-dom` are peer dependencies (React `>=17`):

```bash
npm install react react-dom
```

## Stylesheet

The component renders the bundled `@pvotly/web` widget, so you must import its stylesheet **once** in your application (for example in your root entry file):

```ts
import '@pvotly/web/styles.css';
```

Without this import the table will render unstyled.

## `<PivotTable />`

A declarative wrapper. It owns a `@pvotly/web` widget instance for its lifetime, pushes prop changes into it, and bridges widget events to React callbacks.

```tsx
import { PivotTable } from '@pvotly/react';
import '@pvotly/web/styles.css';

const data = [
  { Country: 'USA', Category: 'Cars', Sales: 1200 },
  { Country: 'USA', Category: 'Bikes', Sales: 400 },
  { Country: 'Canada', Category: 'Cars', Sales: 900 },
];

export function Report() {
  return (
    <PivotTable
      dataSource={{ data }}
      slice={{
        rows: [{ uniqueName: 'Country' }],
        columns: [{ uniqueName: 'Category' }],
        measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
      }}
      height={500}
      onCellClick={({ cell }) => console.log(cell.formatted)}
    />
  );
}
```

### Props

`PivotTableProps` extends the widget's `PivotTableOptions` (which itself extends `PivotConfiguration`) and adds React event callbacks plus `className` / `style`.

| Prop | Type | Description |
| --- | --- | --- |
| `dataSource` | `DataSourceConfig` | **Required.** Input data: in-memory `data`, `matrix` (array-of-arrays), or `csv` text (with optional `csvOptions`, `mapping`). |
| `slice` | `Slice` | Report definition: `rows`, `columns`, `measures`, `reportFilters`, `expands`, `drills`, `sorting`. |
| `options` | `PivotOptions` | Grid behavior (grid `type`, totals, headers, etc.). |
| `formats` | `NumberFormat[]` | Named number formats referenced by `MeasureConfig.format`. |
| `conditions` | `ConditionalFormat[]` | Conditional cell styling rules. |
| `localization` | `Localization` | Caption / label overrides. |
| `theme` | `'light' \| 'dark' \| string` | Theme name (default `'light'`). Updated in place without a full reset. |
| `toolbar` | `boolean` | Show the toolbar (default `true`). |
| `fieldList` | `boolean` | Show the drag-and-drop field-list panel (default `true`). |
| `height` | `string \| number` | CSS height for the widget (e.g. `500` or `'60vh'`). |
| `width` | `string \| number` | CSS width. |
| `className` | `string` | Class applied to the host `<div>`. |
| `style` | `CSSProperties` | Inline style applied to the host `<div>`. |

> Changing `dataSource`, `slice`, `options`, `formats`, `conditions`, or `localization` re-applies the configuration to the widget. Changing `theme` updates the theme without rebuilding.

### Event callbacks

Each callback receives the matching `PivotEventMap` payload.

| Prop | Payload |
| --- | --- |
| `onReady` | `void` |
| `onReportChange` | `PivotConfiguration` |
| `onDataChange` | `{ records: number }` |
| `onCellClick` | `{ cell: PivotCell }` |
| `onCellDoubleClick` | `{ cell: PivotCell; records: DataRecord[] }` |
| `onFilterChange` | `{ field: string; filter?: FieldFilter }` |
| `onSortChange` | `{ field: string; direction: SortDirection }` |
| `onDrillThrough` | `{ cell: PivotCell; records: DataRecord[] }` |
| `onError` | `{ message: string; error?: unknown }` |

Handlers are read from the latest render, so you can pass inline closures without re-subscribing.

### Ref handle

Attach a ref to access the widget imperatively. The ref exposes a `PivotTableHandle`:

```tsx
import { useRef } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';

export function ReportWithControls() {
  const ref = useRef<PivotTableHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.exportTo('csv', { filename: 'report' })}>
        Export CSV
      </button>
      <button onClick={() => ref.current?.print('Sales report')}>Print</button>
      <button onClick={() => ref.current?.refresh()}>Refresh</button>

      <PivotTable
        ref={ref}
        dataSource={{ data }}
        slice={{ rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] }}
      />
    </>
  );
}
```

| Member | Signature | Description |
| --- | --- | --- |
| `engine` | `PivotEngine` (readonly) | The underlying core engine, for advanced imperative control. |
| `instance` | `PivotTable` (readonly) | The underlying `@pvotly/web` widget instance. |
| `getConfiguration` | `() => PivotConfiguration` | Read the current configuration. |
| `setConfiguration` | `(config: PivotConfiguration) => void` | Replace the configuration. |
| `exportTo` | `(format: ExportFormat, options?: ExportOptions) => void` | Export the grid. `format` is `'csv' \| 'html' \| 'json' \| 'excel'`; `options` accepts `{ filename?, raw? }`. |
| `print` | `(title?: string) => void` | Open the browser print dialog for the current grid. |
| `refresh` | `() => void` | Force an immediate re-render. |

## `usePivotEngine` (headless)

A headless hook that owns a `PivotEngine` and returns the live computed `PivotGrid`, re-rendering whenever the report changes. Use it to build a fully custom renderer without the bundled DOM UI. (No stylesheet import is required for the headless path.)

```tsx
import { usePivotEngine } from '@pvotly/react';

export function CustomGrid() {
  const { engine, grid } = usePivotEngine({
    dataSource: { data },
    slice: {
      rows: [{ uniqueName: 'Country' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
    },
  });

  return (
    <table>
      <tbody>
        {grid.rowLeaves.map((rowLeaf, r) => (
          <tr key={r}>
            <th>{rowLeaf.caption}</th>
            {grid.columnLeaves.map((colLeaf, c) =>
              grid.measures.map((measure, m) => {
                const cell = grid.getCell(rowLeaf, colLeaf, measure);
                return <td key={`${c}-${m}`}>{cell.formatted}</td>;
              }),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Signature**

```ts
function usePivotEngine(config: PivotConfiguration): {
  engine: PivotEngine;
  grid: PivotGrid;
};
```

- `engine` — the `PivotEngine` instance (created once and reused across renders).
- `grid` — the current `PivotGrid`: `rowTree`, `columnTree`, `rowLeaves`, `columnLeaves`, `measures`, a `getCell(rowLeaf, colLeaf, measure)` lookup, a `body` matrix, and `meta`.

The hook subscribes to the engine's `reportChange` event and re-applies `config` when it changes, so updating the passed configuration object updates the returned `grid`.

## Exports

```ts
import {
  PivotTable,
  usePivotEngine,
  type PivotTableProps,
  type PivotTableHandle,
} from '@pvotly/react';
```

The package also re-exports the `@pvotly/core` types (`PivotConfiguration`, `PivotGrid`, `PivotCell`, `Slice`, `DataSourceConfig`, etc.) for convenience.

## License

MIT
