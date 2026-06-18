import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@pvotly/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@pvotly/web': fileURLToPath(new URL('../web/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'vue',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/index.ts'],
    },
  },
});
