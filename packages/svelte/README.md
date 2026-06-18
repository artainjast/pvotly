# @pvotly/svelte

Svelte bindings for [pvotly](https://github.com/artainjast/pivot-table). Ships a Svelte **action** — `use:pvotly` — that mounts the `@pvotly/web` widget onto any element. The action is pure TypeScript, so it needs no Svelte compiler step and works with any Svelte 4+ project (and SvelteKit).

- **Version:** 0.1.0
- **License:** MIT

## Installation

```bash
npm install @pvotly/svelte @pvotly/web @pvotly/core
```

`svelte` is an optional peer dependency (Svelte `>=4`).

## Stylesheet

The action renders the bundled `@pvotly/web` widget, so import its stylesheet **once** in your app:

```ts
import '@pvotly/web/styles.css';
```

Without this import the table will render unstyled.

## `use:pvotly`

Attach the action to a host element and pass the widget options. It creates a `@pvotly/web` `PivotTable` for the element's lifetime, applies updated options reactively, and tears the widget down on unmount.

```svelte
<script lang="ts">
  import { pvotly, type PivotTableOptions } from '@pvotly/svelte';
  import '@pvotly/web/styles.css';

  const data = [
    { Country: 'USA', Category: 'Cars', Sales: 1200 },
    { Country: 'USA', Category: 'Bikes', Sales: 400 },
    { Country: 'Canada', Category: 'Cars', Sales: 900 },
  ];

  const options: PivotTableOptions = {
    dataSource: { data },
    slice: {
      rows: [{ uniqueName: 'Country' }],
      columns: [{ uniqueName: 'Category' }],
      measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
    },
    height: 500,
  };
</script>

<div use:pvotly={options} />
```

### Reactive updates

Svelte calls the action's `update` hook whenever the passed options change. The
action re-applies the configuration and, when present, the `tokens`, `actionBar`,
and `theme` options:

```svelte
<script lang="ts">
  import { pvotly, type PivotTableOptions } from '@pvotly/svelte';

  let theme: 'light' | 'dark' = 'light';
  $: options = {
    dataSource: { data },
    slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
    theme,
  } satisfies PivotTableOptions;
</script>

<button on:click={() => (theme = theme === 'light' ? 'dark' : 'light')}>Toggle theme</button>
<div use:pvotly={options} />
```

## Imperative control

For full imperative access (export, print, the engine, etc.), construct a
`@pvotly/web` `PivotTable` directly — `@pvotly/svelte` re-exports it:

```svelte
<script lang="ts">
  import { PivotTable } from '@pvotly/svelte';
  import { onMount, onDestroy } from 'svelte';

  let host: HTMLDivElement;
  let pivot: PivotTable;

  onMount(() => {
    pivot = new PivotTable(host, {
      dataSource: { data },
      slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
    });
  });
  onDestroy(() => pivot?.destroy());
</script>

<button on:click={() => pivot.exportTo('csv', { filename: 'report' })}>Export CSV</button>
<div bind:this={host} />
```

## Exports

```ts
import { pvotly, PivotTable, type PivotTableOptions } from '@pvotly/svelte';
```

The package also re-exports everything from `@pvotly/web` (which in turn
re-exports `@pvotly/core`), so a single import covers the widget and engine types.

## License

MIT
