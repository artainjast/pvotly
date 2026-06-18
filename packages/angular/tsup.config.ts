import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@angular/core', '@pvotly/core', '@pvotly/web'],
  target: 'es2020',
  esbuildOptions(options) {
    // Angular decorators rely on class/function names being preserved at runtime
    // (DI tokens, reflection). Keep them intact through minify/transform.
    options.keepNames = true;
  },
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
