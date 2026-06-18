# Using pvotly from a CDN (no build step)

`@pvotly/web` ships a **self-contained browser build** that bundles `@pvotly/core`
in, so a single `<script>` tag gives you the full widget with **zero** other
dependencies.

Two files are emitted into the package's `dist/` (and therefore served by any
npm CDN such as [unpkg](https://unpkg.com) or [jsDelivr](https://jsdelivr.com)):

| File                       | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `dist/pvotly.global.js`   | Self-contained script exposing a global `Pvotly`. |
| `dist/pvotly.global.css`  | The widget stylesheet (themes included).           |

## Quick start (`<script>` tag)

```html
<!doctype html>
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://unpkg.com/@pvotly/web/dist/pvotly.global.css"
    />
  </head>
  <body>
    <div id="app" style="height: 500px"></div>

    <script src="https://unpkg.com/@pvotly/web/dist/pvotly.global.js"></script>
    <script>
      // Everything from `@pvotly/web` (and re-exported `@pvotly/core`) lives
      // under the global `Pvotly` object.
      const { PivotTable } = Pvotly;

      new PivotTable('#app', {
        dataSource: {
          data: [
            { Country: 'USA', Category: 'Cars', Sales: 100 },
            { Country: 'USA', Category: 'Bikes', Sales: 50 },
            { Country: 'Canada', Category: 'Cars', Sales: 300 },
          ],
        },
        slice: {
          rows: [{ uniqueName: 'Country' }],
          columns: [{ uniqueName: 'Category' }],
          measures: [{ uniqueName: 'Sales', aggregation: 'sum' }],
        },
      });
    </script>
  </body>
</html>
```

Pin a version for production (recommended), e.g.
`https://unpkg.com/@pvotly/web@0.1.0/dist/pvotly.global.js`.

## What's on the `Pvotly` global?

The global mirrors the package's public API. Notably:

- `Pvotly.PivotTable` — the all-in-one widget class.
- `Pvotly.PivotEngine` — the headless engine (re-exported from `@pvotly/core`).
- Theme/export/format helpers (`applyTheme`, `exportToCSV`, `formatValue`, …).

```html
<script src="https://unpkg.com/@pvotly/web/dist/pvotly.global.js"></script>
<script>
  const engine = new Pvotly.PivotEngine({
    dataSource: { data: rows },
    slice: { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Sales' }] },
  });
  console.log(engine.getGrid());
</script>
```

## Module CDNs (ESM `import`)

Because the package also publishes standard ESM, you can skip the global build
entirely and import the module form from an ESM-aware CDN:

```html
<script type="module">
  import { PivotTable } from 'https://esm.sh/@pvotly/web';
  // styles still need to be loaded once:
  // <link rel="stylesheet" href="https://esm.sh/@pvotly/web/styles.css" />
</script>
```

## AMD / RequireJS consumers

> [!NOTE]
> The current `pvotly.global.js` is an **IIFE** (it only assigns a browser
> global). It is **not** a true UMD bundle, so loaders that probe for
> `define.amd` (RequireJS) or `module.exports` (CommonJS via `<script>`) will
> not detect it and will fall back to the global. For `<script>`-tag and
> `esm.sh`/`skypack` usage this is a non-issue.
>
> If first-class AMD/CommonJS-via-CDN support is required, the **`packages/web`
> build config** must emit a UMD wrapper. See
> [the handoff note](#handoff-true-umd-output-owned-by-the-web-package) below.

### Handoff: true UMD output (owned by the `packages/web` package)

This change lives in `packages/web/tsup.config.ts`, which is **owned by the web
package** and is intentionally not modified here. To add a true UMD build,
the web package should add a UMD output. tsup's bundled formats are
`esm | cjs | iife` only, so UMD needs either:

1. A small extra Rollup/`@rollup/plugin-*` pass with `output.format: 'umd'` and
   `name: 'Pvotly'`, emitting `dist/pvotly.umd.js`; **or**
2. A post-build step that wraps the existing IIFE in a UMD preamble.

Suggested package.json `exports` additions once the file exists:

```jsonc
{
  "exports": {
    "./global": "./dist/pvotly.global.js",
    "./umd": "./dist/pvotly.umd.js"
  }
}
```

No wrapper or charts package depends on this; it is purely an additive
enhancement for AMD/CommonJS CDN consumers.
