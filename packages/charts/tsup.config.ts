import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Keep the engine external (consumers already install it); chart.js is an
  // optional peer that is never imported at runtime by this package.
  external: ['@pvotly/core', 'chart.js'],
  target: 'es2020',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
