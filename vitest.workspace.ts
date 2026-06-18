import { defineWorkspace } from 'vitest/config';

// Each package owns its own vitest.config.ts (with the alias mapping internal
// @pvotly/* deps to their source). The workspace just aggregates them so a
// single `pnpm test` at the root runs every package's unit suite.
export default defineWorkspace([
  'packages/core',
  'packages/web',
  'packages/react',
  'packages/vue',
  'packages/svelte',
  'packages/charts',
]);
