# @pvotly/web

A framework-agnostic, drag-and-drop pivot table UI built on top of [`@pvotly/core`](../core). It owns a `PivotEngine`, renders the grid, toolbar and field-list panel, and re-renders automatically whenever the report changes. No framework required — it works with plain DOM.

- Drag-and-drop field list (rows / columns / values / report filters)
- Sortable, expandable grid with subtotals and grand totals
- Filtering, number formatting and conditional formatting dialogs
- Export to CSV, JSON, HTML and Excel, plus print-to-PDF
- Light / dark / custom themes via CSS variables

## Install

```sh
npm install @pvotly/web @pvotly/core
```

`@pvotly/core` is a peer of the engine and is re-exported from `@pvotly/web`, so a single import gives you both the widget and the engine types.

## Usage

```ts
import { PivotTable } from '@pvotly/web';
import '@pvotly/web/styles.css';

const pivot = new PivotTable('#app', {
  dataSource: {
    data: [
      { Country: 'USA', Category: 'Cars', Revenue: 1200 },
      { Country: 'USA', Category: 'Bikes', Revenue: 400 },
      { Country: 'UK', Category: 'Cars', Revenue: 900 },
    ],
  },
  slice: {
    rows: [{ uniqueName: 'Country' }],
    columns: [{ uniqueName: 'Category' }],
    measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }],
  },
});
```

The first argument is a CSS selector string or an `HTMLElement`. The stylesheet (`@pvotly/web/styles.css`) is required for layout and theming.

## Options

`new PivotTable(target, options)` takes a `PivotTableOptions` object. It extends `PivotConfiguration` from `@pvotly/core`, so every engine configuration field is accepted alongside a few widget-only properties.

### Widget options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `toolbar` | `boolean` | `true` | Show the toolbar. |
| `fieldList` | `boolean` | `true` | Show the drag-and-drop field-list panel. |
| `theme` | `ThemeName` (`'light' \| 'dark' \| string`) | `'light'` | Initial theme, applied as `data-ph-theme`. |
| `height` | `string \| number` | `520px` | CSS height of the widget. A number is treated as pixels. |
| `width` | `string \| number` | — | CSS width. A number is treated as pixels. |

### Engine configuration (`PivotConfiguration`)

| Field | Type | Description |
| --- | --- | --- |
| `dataSource` | `DataSourceConfig` | Required. The data to pivot. |
| `slice` | `Slice` | Rows, columns, measures, report filters, sorting and drill state. |
| `options` | `PivotOptions` | Engine behaviour (default aggregation, totals, etc.). |
| `formats` | `NumberFormat[]` | Named number formats referenced by measures. |
| `conditions` | `ConditionalFormat[]` | Conditional formatting rules. |
| `localization` | `Localization` | Caption / label overrides. |

`dataSource` accepts in-memory records (`data`), an array-of-arrays (`matrix`), or raw `csv` text:

```ts
new PivotTable('#app', {
  dataSource: { csv: 'Country,Revenue\nUSA,1200\nUK,900' },
  slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }] },
  theme: 'dark',
  height: '60vh',
  fieldList: false,
});
```

See [`@pvotly/core`](../core) for the full shape of `Slice`, `MeasureConfig`, `PivotOptions`, `NumberFormat` and `ConditionalFormat`.

## Methods

The `PivotTable` instance exposes the following public API.

| Method | Signature | Description |
| --- | --- | --- |
| `getConfiguration` | `() => PivotConfiguration` | Current configuration from the engine. |
| `setConfiguration` | `(config: PivotConfiguration) => void` | Replace the configuration and re-render. |
| `on` | `(event, handler) => () => void` | Subscribe to an event. Returns an unsubscribe function. |
| `off` | `(event, handler) => void` | Remove a previously registered handler. |
| `setTheme` | `(theme: ThemeName) => void` | Switch the active theme. |
| `setThemeTokens` | `(tokens: Record<string, string>) => void` | Override theme tokens at runtime (keys without the `--ph-` prefix). |
| `toggleFieldList` | `(show?: boolean) => void` | Show/hide the field list. Toggles when `show` is omitted. |
| `toggleFullscreen` | `() => Promise<void>` | Enter or exit fullscreen for the widget. |
| `exportTo` | `(format: ExportFormat, options?: ExportOptions) => void` | Export and download the current grid. |
| `print` | `(title?: string) => void` | Open the browser print dialog scoped to the table (for PDF). |
| `refresh` | `() => void` | Force an immediate re-render. |
| `closeDialog` | `() => void` | Close any open dialog (filter / format / conditional). |
| `destroy` | `() => void` | Unsubscribe, clear the engine and empty the root element. |

The instance also exposes two read-only accessors: `engine` (the underlying `PivotEngine`) and `element` (the widget's root `HTMLElement`).

```ts
pivot.setTheme('dark');
pivot.setThemeTokens({ accent: '#e11d48', radius: '12px' });
pivot.toggleFieldList(false);
pivot.exportTo('csv', { filename: 'sales' });
pivot.print('Sales by Country');

const config = pivot.getConfiguration();
pivot.destroy();
```

## Events

`on` / `off` proxy directly to the engine's event bus. `on` returns an unsubscribe function.

```ts
const unsubscribe = pivot.on('cellClick', ({ cell }) => {
  console.log(cell.formatted);
});

unsubscribe(); // or pivot.off('cellClick', handler)
```

| Event | Payload |
| --- | --- |
| `ready` | `void` |
| `reportChange` | `PivotConfiguration` |
| `dataChange` | `{ records: number }` |
| `cellClick` | `{ cell: PivotCell }` |
| `cellDoubleClick` | `{ cell: PivotCell; records: DataRecord[] }` |
| `filterChange` | `{ field: string; filter?: FieldFilter }` |
| `sortChange` | `{ field: string; direction: SortDirection }` |
| `drillThrough` | `{ cell: PivotCell; records: DataRecord[] }` |
| `error` | `{ message: string; error?: unknown }` |

## Export

`exportTo(format, options)` serializes the visible grid and triggers a browser download. Outside the browser it is a no-op.

| Format | Output |
| --- | --- |
| `'csv'` | Comma-separated values (`.csv`). |
| `'json'` | Array of record objects (`.json`). |
| `'html'` | Standalone HTML `<table>` (`.html`). |
| `'excel'` | Excel-compatible SpreadsheetML (`.xls`). |

`ExportOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `filename` | `string` | `'pivot'` | Download filename (without extension). |
| `raw` | `boolean` | format-dependent | Use raw numeric values instead of formatted strings. JSON defaults to `true`; others default to `false`. |

```ts
pivot.exportTo('excel', { filename: 'q1-report' });
pivot.exportTo('json', { raw: true });
pivot.print('Q1 Report'); // print dialog for PDF export
```

The lower-level export helpers are also exported for custom pipelines: `exportToCSV`, `exportToJSON`, `exportToHTML`, `exportToExcel`, `serializeExport`, `downloadExport`, `printGrid` and `gridToMatrix`.

## Theming

Themes are driven entirely by CSS custom properties on the widget root, scoped by the `data-ph-theme` attribute. `light` and `dark` ship out of the box (plus a `minimal` variant in the stylesheet).

Set the initial theme via the `theme` option, or switch at runtime with `setTheme`:

```ts
const pivot = new PivotTable('#app', { /* ... */ theme: 'dark' });
pivot.setTheme('light');
```

### Override tokens at runtime

`setThemeTokens` writes CSS variables onto the root. Keys are token names **without** the `--ph-` prefix:

```ts
pivot.setThemeTokens({
  accent: '#e11d48',
  radius: '10px',
  'bg-header': '#0f172a',
});
```

### Available tokens

| Token | Purpose |
| --- | --- |
| `--ph-font` | Base font family. |
| `--ph-fg` / `--ph-fg-muted` | Foreground and muted text colors. |
| `--ph-bg` / `--ph-bg-alt` / `--ph-bg-header` | Surface, alternate and header backgrounds. |
| `--ph-border` / `--ph-border-strong` | Border colors. |
| `--ph-accent` / `--ph-accent-fg` | Accent color and its foreground. |
| `--ph-total-bg` / `--ph-grand-bg` | Subtotal and grand-total backgrounds. |
| `--ph-hover` | Hover background. |
| `--ph-shadow` | Dialog / popover shadow. |
| `--ph-radius` | Corner radius. |
| `--ph-height` | Widget height (also set by the `height` option). |

### Custom themes

Define a custom theme by overriding tokens under a `[data-ph-theme]` selector, then activate it by name:

```css
.ph-root[data-ph-theme='brand'] {
  --ph-accent: #7c3aed;
  --ph-bg-header: #f5f3ff;
  --ph-radius: 12px;
}
```

```ts
pivot.setTheme('brand');
```

## License

MIT
