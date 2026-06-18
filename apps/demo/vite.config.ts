import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Alias the bare package specifiers to source so the docs site hot-reloads
// against the live library code (subpath imports like
// `@pvotly/web/src/styles/...` bypass these regex aliases and resolve via
// the pnpm workspace symlinks).
// `base` is `/pvotly/` for production builds so assets resolve under the
// GitHub Pages project path (artainjast.github.io/pvotly/); root for dev/e2e.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pvotly/' : '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@pvotly\/core$/, replacement: src('../../packages/core/src/index.ts') },
      { find: /^@pvotly\/web$/, replacement: src('../../packages/web/src/index.ts') },
      { find: /^@pvotly\/react$/, replacement: src('../../packages/react/src/index.ts') },
      { find: /^@pvotly\/charts$/, replacement: src('../../packages/charts/src/index.ts') },
    ],
  },
  server: { port: 5173 },
}));
