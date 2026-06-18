# @pvotly/vue

Declarative Vue 3 bindings for [pvotly](https://github.com/artainjast/pivot-table) — a `<PivotTable />` component that wraps the `@pvotly/web` widget.

- **Version:** 0.1.0
- **License:** MIT

## Installation

```bash
npm install @pvotly/vue @pvotly/web @pvotly/core
```

`vue` is a peer dependency (Vue `>=3`):

```bash
npm install vue
```

## Stylesheet

Import the bundled `@pvotly/web` stylesheet **once** in your app entry:

```ts
import '@pvotly/web/styles.css';
```

## Usage

```vue
<script setup lang="ts">
import { PivotTable } from '@pvotly/vue';
import '@pvotly/web/styles.css';

const data = [
  { Country: 'USA', Category: 'Cars', Sales: 1200 },
  { Country: 'USA', Category: 'Bikes', Sales: 400 },
  { Country: 'Canada', Category: 'Cars', Sales: 900 },
];

const slice = {
  rows: [{ uniqueName: 'Country' }],
  columns: [{ uniqueName: 'Category' }],
  measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
};

function onCellClick(payload) {
  console.log(payload.cell.formatted);
}
</script>

<template>
  <PivotTable
    :data-source="{ data }"
    :slice="slice"
    :height="500"
    @cell-click="onCellClick"
  />
</template>
```

### Props

The component accepts every `PivotTableOptions` field as a prop:
`dataSource`, `slice`, `options`, `formats`, `conditions`, `localization`,
`theme`, `tokens`, `actionBar`, `toolbar`, `fieldList`, `height`, `width`.

Changing `dataSource`, `slice`, `options`, `formats`, `conditions`, or
`localization` re-applies the configuration. `theme`, `tokens`, and `actionBar`
update in place without a full reset.

### Events

Each engine event is forwarded as a Vue event with its payload untouched:
`ready`, `reportChange`, `dataChange`, `cellClick`, `cellDoubleClick`,
`filterChange`, `sortChange`, `drillThrough`, `error`.

### Imperative access

Use a template ref to reach the underlying widget and engine:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PivotTable } from '@pvotly/vue';

const pivot = ref();

function exportCsv() {
  pivot.value.instance.exportTo('csv', { filename: 'report' });
}
</script>

<template>
  <button @click="exportCsv">Export CSV</button>
  <PivotTable ref="pivot" :data-source="{ data }" :slice="slice" />
</template>
```

The ref exposes `instance` (the `@pvotly/web` `PivotTable`) and `engine`
(the `@pvotly/core` `PivotEngine`).

## License

MIT
