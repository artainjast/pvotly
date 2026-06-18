import { defineConfig } from 'tsup';

export default defineConfig([
  // Primary library build: ESM + CJS with types, engine kept external.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    // Keep the engine external so it isn't duplicated; consumers install both.
    external: ['@pvotly/core'],
    // Emit a sibling stylesheet (dist/index.css) instead of injecting at runtime.
    injectStyle: false,
    target: 'es2020',
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.js' };
    },
  },
  // Standalone browser build: a self-contained IIFE exposing a global `Pvotly`.
  // @pvotly/core is bundled IN so the single <script> tag has no dependencies.
  {
    entry: { 'pvotly.global': 'src/global.ts' },
    format: ['iife'],
    globalName: 'Pvotly',
    // Bundle everything (do NOT mark @pvotly/core external) so the script is self-contained.
    noExternal: ['@pvotly/core'],
    dts: false,
    sourcemap: true,
    // Do not wipe the primary build's output.
    clean: false,
    minify: true,
    treeshake: true,
    // Emit a sibling stylesheet (dist/pvotly.global.css) instead of injecting at runtime.
    injectStyle: false,
    target: 'es2020',
    outDir: 'dist',
    outExtension() {
      return { js: '.js' };
    },
  },
]);
