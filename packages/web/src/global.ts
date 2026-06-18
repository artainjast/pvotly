/**
 * Standalone browser/UMD entry for @pvotly/web.
 *
 * This module re-exports the entire public surface of `./index` so that tsup can
 * bundle it (together with @pvotly/core and the stylesheet) into a single,
 * self-contained IIFE that attaches a global `Pvotly` object.
 *
 * @example
 * ```html
 * <link rel="stylesheet" href="pvotly.global.css" />
 * <script src="pvotly.global.js"></script>
 * <script>
 *   new Pvotly.PivotTable('#app', { dataSource: { data } });
 * </script>
 * ```
 */
export * from './index';
