# Contributing to pvotly

Thanks for your interest in contributing to pvotly — a fully customizable,
framework-agnostic pivot table engine and UI. This guide explains how to set up
the repository, where the code lives, and the conventions we follow.

By participating, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).

## Prerequisites

- **Node.js** `>=18` (see the `engines` field in `package.json`).
- **pnpm** — this is a pnpm workspace; npm and yarn are not supported. The repo
  pins a version via the `packageManager` field, so the easiest way to get the
  right one is [Corepack](https://nodejs.org/api/corepack.html):

  ```bash
  corepack enable
  ```

  Corepack will install the pinned pnpm version automatically the first time you
  run a `pnpm` command.

## Setup

Clone the repository and install all workspace dependencies from the root:

```bash
pnpm install
```

This installs dependencies for every package and links the internal
`@pvotly/*` packages together via `workspace:*`.

## Repository layout

```
.
├── packages/
│   ├── core/     # @pvotly/core  — framework-agnostic engine (zero deps)
│   ├── web/      # @pvotly/web   — vanilla DOM UI built on core
│   └── react/    # @pvotly/react — declarative React bindings
├── apps/
│   └── demo/     # @pvotly/demo  — interactive playground (Vite, private)
└── e2e/          # Playwright end-to-end specs against the demo app
```

The dependency direction is one-way: `react` depends on `web`, and `web`
depends on `core`. `core` has no runtime dependencies. The published packages
are versioned together (`fixed` in the changesets config), currently at
`0.1.0`. The demo app is private and is never published.

Both `@pvotly/web` and `@pvotly/react` re-export everything from
`@pvotly/core`, so consumers can import the engine and the UI from a single
package.

## Common commands

Run these from the repository root unless noted otherwise.

| Command | Description |
| --- | --- |
| `pnpm build` | Build all publishable packages (`packages/*`) with tsup. |
| `pnpm dev` | Start the demo app (Vite) for local development. |
| `pnpm test` | Run all unit tests once (Vitest, across the workspace). |
| `pnpm test:watch` | Run unit tests in watch mode. |
| `pnpm test:cov` | Run unit tests with V8 coverage. |
| `pnpm test:e2e` | Run Playwright end-to-end tests. |
| `pnpm test:e2e:ui` | Run Playwright tests in interactive UI mode. |
| `pnpm typecheck` | Type-check every package with `tsc --noEmit`. |
| `pnpm lint` | Lint the repository with ESLint. |
| `pnpm lint:fix` | Lint and auto-fix where possible. |
| `pnpm format` | Format the repository with Prettier. |
| `pnpm format:check` | Check formatting without writing changes. |
| `pnpm clean` | Remove build output and caches across packages. |

To run a script against a single package, use pnpm's filter flag, e.g.:

```bash
pnpm --filter @pvotly/core run test
pnpm --filter @pvotly/web run build
```

## Development workflow

1. Create a branch off `main`.
2. Make your change. If it touches a published package, add a changeset (see
   [Releases](#releases-changesets)).
3. Before opening a pull request, make sure the full check suite passes:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. Open a pull request against `main`.

### Working against source (not built output)

Each package owns a `vitest.config.ts` that aliases the internal `@pvotly/*`
dependencies to their `src/` (not `dist/`). This means you can run tests and the
demo against your latest source without rebuilding. The root
`vitest.workspace.ts` aggregates these configs so a single `pnpm test` runs
every package's unit suite.

## Testing conventions

### Unit tests (Vitest)

- Place unit tests next to the code they cover, using a `.test.ts` /
  `.test.tsx` suffix (for example `packages/web/src/PivotTable.test.ts`,
  `packages/react/src/PivotTable.test.tsx`).
- `@pvotly/core` is pure and DOM-free; keep its tests free of DOM
  dependencies. `@pvotly/web` and `@pvotly/react` run under jsdom and use
  `@testing-library/react` / `@testing-library/user-event` where appropriate.
- Write tests against the public API. For example, a core engine test:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { PivotEngine } from '@pvotly/core';

  describe('PivotEngine', () => {
    it('aggregates revenue by country and category', () => {
      const engine = new PivotEngine({
        dataSource: {
          data: [
            { Country: 'USA', Category: 'A', Revenue: 100 },
            { Country: 'USA', Category: 'B', Revenue: 50 },
          ],
        },
        slice: {
          rows: [{ uniqueName: 'Country' }],
          columns: [{ uniqueName: 'Category' }],
          measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }],
        },
      });

      const grid = engine.getGrid();
      expect(grid.rowLeaves.length).toBeGreaterThan(0);
    });
  });
  ```

- Run the suite with `pnpm test`, watch with `pnpm test:watch`, and check
  coverage with `pnpm test:cov`.

### End-to-end tests (Playwright)

- E2E specs live in `e2e/` with a `.spec.ts` suffix.
- They drive the demo app, which Playwright starts automatically via its
  `webServer` config (`pnpm --filter @pvotly/demo run dev` on
  `http://localhost:5173`). You do not need to start the demo yourself.
- Tests run on Chromium (Desktop Chrome). Prefer `data-testid` selectors, which
  the demo app exposes for navigation and panels.
- Run them with `pnpm test:e2e`, or `pnpm test:e2e:ui` for the interactive
  runner.

## Code style

Formatting is handled by **Prettier** and linting by **ESLint**; both run in CI.

- Prettier config (`.prettierrc`): semicolons, single quotes, trailing commas
  (`all`), 100-character print width, 2-space indentation, always-parenthesized
  arrow params. Run `pnpm format` (or `pnpm format:check`) to apply or verify.
- ESLint config (`eslint.config.js`) uses the flat config with
  `@eslint/js` recommended rules plus `typescript-eslint` recommended rules.
  Unused variables are warnings unless prefixed with `_`. Run `pnpm lint` (or
  `pnpm lint:fix`).
- The codebase is TypeScript-first and ESM (`"type": "module"`). Keep
  `@pvotly/core` dependency-free, and respect the package layering described
  above.

## Releases (changesets)

We use [Changesets](https://github.com/changesets/changesets) to manage versions
and changelogs. The three published packages (`@pvotly/core`,
`@pvotly/web`, `@pvotly/react`) are versioned together; the demo app is
ignored.

If your change affects a published package, add a changeset describing it:

```bash
pnpm changeset
```

Follow the prompts to select the bump type (patch / minor / major) and write a
short, user-facing summary. Commit the generated file under `.changeset/` along
with your change.

Maintainers cut releases by applying the accumulated changesets and publishing:

```bash
pnpm changeset version   # bumps versions and updates changelogs
pnpm release             # builds all packages, then `changeset publish`
```

You generally only need to run `pnpm changeset` to add a changeset; the
versioning and publishing steps are handled during release.

## Questions

If something is unclear or you hit a setup issue, please open an issue. Thanks
for contributing to pvotly!
